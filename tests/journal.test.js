import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { activityLog, collect, lineDelta, TEST_COMMAND } from '../lib/collector.js'
import { buildJournal, normalizeSegments, ruleSegments } from '../lib/journal.js'
import { buildPrompt, contextFor, createSummarizer, parseReply, SUMMARY_VERSION, SYSTEM_PROMPT, withLang } from '../lib/summarizer.js'
import { buildOutlinePrompt, OUTLINE_PROMPT, outlineBasis, parseOutline } from '../lib/outline.js'
import { createSummaryStore, normalizeLang, validSessionId } from '../lib/store.js'
import { createHandler, createJournalReader } from '../lib/webapi.js'
import { streamText } from '../lib/index.js'

/** A tiny event-log builder. */
function log() {
  const events = [{ type: 'session', cwd: '/w' }]
  let seq = 1
  let time = 1000
  let callN = 0
  const push = (type, data) => events.push({ type, seq: seq++, time: (time += 1000), data })
  const api = {
    events,
    turn(n, user, build, outcome = 'completed') {
      push('turn/start', { turn: n })
      push('user/message', { content: [{ type: 'text', text: user }], source: { kind: 'user' } })
      push('user/message', { content: [{ type: 'text', text: 'memory blob' }], source: { kind: 'memory' } })
      let step = 0
      build({
        step(text, calls = []) {
          step++
          push('assistant/message', { turn: n, step, message: { content: [{ type: 'text', text }] } })
          for (const call of calls) {
            const callId = `c${++callN}`
            push('tool/call', { turn: n, step, callId, name: call.name, arguments: JSON.stringify(call.args ?? {}) })
            if (call.exit !== undefined) push('job/settled', { toolCall: { callId }, detail: `exit code: ${call.exit}` })
            push('tool/result', { turn: n, step, message: { toolCallId: callId, isError: call.error === true, content: [{ type: 'text', text: call.out ?? '' }] }, meta: call.meta })
          }
        },
      })
      if (outcome !== null) push('turn/end', { turn: n, reason: { kind: outcome } })
      return api
    },
  }
  return api
}

const edit = (path, oldText, newText) => ({ name: 'edit', args: { file_path: path, old_string: oldText, new_string: newText }, meta: { operation: 'update', path, diffs: [{ oldText, newText }] } })
const write = (path, content) => ({ name: 'write', args: { file_path: path, content }, meta: { operation: 'create', path, diffs: [] } })
const bash = (command, exit = 0, description) => ({ name: 'bash', args: { command, description }, exit })

test('lineDelta counts only changed lines', () => {
  assert.deepEqual(lineDelta('a\nb\nc', 'a\nB\nc'), { added: 1, removed: 1 })
  assert.deepEqual(lineDelta('a\nc', 'a\nb\nc'), { added: 1, removed: 0 })
  assert.deepEqual(lineDelta('', 'x\ny'), { added: 2, removed: 0 })
})

test('TEST_COMMAND matches test runs, not reads of test files', () => {
  for (const cmd of ['node --test tests/*.test.js', 'pnpm test', 'npm run e2e', 'cd /tmp && timeout 120 node ui-check.mjs', './scripts/smoke.sh', 'pytest -q', 'bash scripts/doctor.sh']) assert.ok(TEST_COMMAND.test(cmd), cmd)
  for (const cmd of ['head -40 /tmp/ui-check.mjs', 'ls tests', 'cat tests/a.test.js', 'git status']) assert.ok(!TEST_COMMAND.test(cmd), cmd)
})

test('collect keeps only what the user typed and tallies edits and tests', () => {
  const { events } = log().turn(1, '做个插件', (t) => {
    t.step('看看代码', [{ name: 'read', args: { file_path: '/w/a.js' } }])
    t.step('写', [write('/w/a.js', 'x\ny\nz\n'), edit('/w/b.js', 'a\nb', 'a\nB\nC')])
    t.step('测', [bash('node --test', 1, 'Run tests'), bash('node --test', 0, 'Run tests')])
    t.step('好了')
  })
  const facts = collect(events)
  assert.equal(facts.cwd, '/w')
  assert.equal(facts.turns.length, 1)
  const [turn] = facts.turns
  assert.equal(turn.user, '做个插件')
  assert.equal(turn.assistant, '好了')
  assert.deepEqual(turn.steps[1].edits, [
    { path: '/w/a.js', op: 'create', added: 3, removed: 0 },
    { path: '/w/b.js', op: 'update', added: 2, removed: 1 },
  ])
  assert.deepEqual(turn.steps[2].tests.map((x) => x.ok), [false, true])
  assert.match(activityLog(turn), /#2 \[implement\] write \/w\/a\.js; edit \/w\/b\.js/)
})

test('failed edits and failed bash calls are recorded as failures, not changes', () => {
  const { events } = log().turn(1, 'go', (t) => {
    t.step('x', [{ ...edit('/w/a.js', 'a', 'b'), error: true }, bash('ls', 2)])
  })
  const [turn] = collect(events).turns
  assert.equal(turn.steps[0].edits.length, 0)
  assert.equal(turn.steps[0].calls[1].ok, false)
})

test('a user message queued before its turn starts still lands on that turn', () => {
  const events = [
    { type: 'user/message', seq: 1, time: 1, data: { content: [{ type: 'text', text: '先排队的' }], source: { kind: 'user' } } },
    { type: 'turn/start', seq: 2, time: 2, data: { turn: 1 } },
    { type: 'assistant/message', seq: 3, time: 3, data: { turn: 1, step: 1, message: { content: [{ type: 'text', text: 'ok' }] } } },
    { type: 'turn/end', seq: 4, time: 4, data: { turn: 1, reason: { kind: 'completed' } } },
  ]
  assert.equal(collect(events).turns[0].user, '先排队的')
})

test('reviews are detected from review skills and review-like delegations', () => {
  const { events } = log().turn(1, '审一下', (t) => {
    t.step('a', [{ name: 'skill', args: { name: 'critical-review' } }])
    t.step('b', [{ name: 'subagent', args: { description: 'Independent code review', prompt: '...' } }])
    t.step('c', [{ name: 'subagent', args: { description: 'Port the parser', prompt: 'write code' } }])
  })
  const [turn] = collect(events).turns
  assert.deepEqual(turn.steps.map((s) => s.reviews.length), [1, 1, 0])
})

test('rule segments: tests before the last edit are part of implementing, edits after a review are fixes', () => {
  const { events } = log()
    .turn(1, '实现', (t) => {
      t.step('r', [{ name: 'read', args: { file_path: 'x' } }])
      t.step('e', [edit('/w/a.js', 'a', 'b')])
      t.step('t', [bash('node --test', 1)])
      t.step('e2', [edit('/w/a.js', 'b', 'c')])
      t.step('t2', [bash('node --test', 0)])
      t.step('done')
    })
    .turn(2, '审', (t) => {
      t.step('rev', [{ name: 'skill', args: { name: 'critical-review' } }])
      t.step('fix', [edit('/w/a.js', 'c', 'd')])
    })
  const facts = collect(events)
  const state = { reviewed: false }
  assert.deepEqual(ruleSegments(facts.turns[0], state).map((s) => [s.kind, s.from, s.to]), [['implement', 1, 4], ['test', 5, 6]])
  assert.deepEqual(ruleSegments(facts.turns[1], state).map((s) => [s.kind, s.from, s.to]), [['review', 1, 1], ['fix', 2, 2]])
})

test('a turn without edits, tests or reviews is research or discussion by tool count', () => {
  const { events } = log()
    .turn(1, '问个问题', (t) => t.step('答'))
    .turn(2, '查一下', (t) => t.step('查', [{ name: 'grep', args: {} }, { name: 'read', args: {} }, { name: 'web_search', args: {} }]))
  const facts = collect(events)
  assert.equal(ruleSegments(facts.turns[0], { reviewed: false })[0].kind, 'discuss')
  assert.equal(ruleSegments(facts.turns[1], { reviewed: false })[0].kind, 'research')
})

test('buildJournal numbers repeated phases and merges adjacent equal ones across turns', () => {
  const b = log()
  b.turn(1, '需求是这样', (t) => t.step('明白'))
  b.turn(2, '那就做', (t) => t.step('e', [edit('/w/a.js', 'a', 'b')]))
  b.turn(3, '审一下', (t) => t.step('r', [{ name: 'skill', args: { name: 'critical-review' } }]))
  b.turn(4, '改', (t) => t.step('f', [edit('/w/a.js', 'b', 'c')]))
  b.turn(5, '再审', (t) => t.step('r', [{ name: 'skill', args: { name: 'critical-review' } }]))
  b.turn(6, '再审一轮', (t) => t.step('r', [{ name: 'skill', args: { name: 'critical-review' } }]))
  const journal = buildJournal(collect(b.events))
  assert.deepEqual(journal.phases.map((p) => [p.kind, p.round ?? null, p.turns]), [
    ['discuss', null, [1, 1]],
    ['implement', null, [2, 2]],
    ['review', 1, [3, 3]],
    ['fix', null, [4, 4]],
    ['review', 2, [5, 6]],
  ])
  assert.equal(journal.goal, '需求是这样')
  assert.equal(journal.files.length, 1)
  assert.deepEqual([journal.files[0].added, journal.files[0].removed], [2, 2])
  assert.equal(journal.running, false)
})

test('buildJournal prefers summaries and reports progress, current phase and open items', () => {
  const b = log()
  b.turn(1, '做', (t) => {
    t.step('a', [edit('/w/a.js', 'a', 'b')])
    t.step('b', [bash('node --test', 1, 'Run tests')])
  })
  b.turn(2, '继续', (t) => t.step('c', [{ name: 'todo_write', args: { todos: [{ content: '补文档', status: 'pending' }, { content: 'x', status: 'completed' }] } }]), null)
  const facts = collect(b.events)
  const summaries = {
    1: { segments: [{ kind: 'design', from: 1, to: 1, title: '定方案', summary: '选 A' }, { kind: 'test', from: 2, to: 2, title: '跑测试', summary: '1 条失败' }], decisions: ['选 A 不选 B'], open: ['修失败的测试'], goal: '做一个插件' },
  }
  const journal = buildJournal(facts, summaries)
  assert.equal(journal.goal, '做一个插件')
  assert.equal(journal.goalSource, 'summary')
  assert.deepEqual(journal.summarized, { done: 1, total: 1 })
  assert.equal(journal.phases[0].kind, 'design')
  assert.equal(journal.phases[0].notes[0].title, '定方案')
  assert.equal(journal.phases[1].tests.failed, 1)
  assert.equal(journal.running, true)
  assert.equal(journal.phases.at(-1).active, true)
  assert.deepEqual(journal.decisions.map((d) => d.text), ['选 A 不选 B'])
  assert.deepEqual(journal.open.map((o) => o.source), ['todo', 'test', 'summary'])
})

test('normalizeSegments repairs ranges and spreads unnumbered segments', () => {
  const turn = { steps: [1, 2, 3, 4, 5, 6].map((step) => ({ step })) }
  assert.deepEqual(normalizeSegments([{ kind: 'x', from: 1, to: 2 }, { kind: 'test', from: 2, to: 99 }], turn).map((s) => [s.kind, s.from, s.to]), [['other', 1, 2], ['test', 3, 6]])
  assert.deepEqual(normalizeSegments([{ kind: 'research' }, { kind: 'implement' }, { kind: 'test' }], turn).map((s) => [s.from, s.to]), [[1, 2], [3, 4], [5, 6]])
  assert.equal(normalizeSegments([], turn), undefined)
})

test('parseReply tolerates fences and rejects junk', () => {
  const reply = '```json\n{"segments":[{"kind":"implement","from":1,"to":3,"title":"写代码","summary":"ok"}],"decisions":["a",""],"open":[],"goal":" g "}\n```'
  assert.deepEqual(parseReply(reply), { segments: [{ kind: 'implement', from: 1, to: 3, title: '写代码', summary: 'ok' }], decisions: ['a'], open: [], goal: 'g' })
  assert.equal(parseReply('no json here'), undefined)
  assert.equal(parseReply('{"segments": "nope"}'), undefined)
  assert.equal(parseReply('{"segments":[{"kind":"weird"}]}').segments[0].kind, 'other')
})

test('buildPrompt carries the user request, the activity log and the previous turns', () => {
  const b = log()
  b.turn(1, '第一件事', (t) => t.step('a'))
  b.turn(2, '第二件事', (t) => t.step('b', [edit('/w/a.js', 'a', 'b')]))
  const facts = collect(b.events)
  const prompt = buildPrompt(facts.turns[1], contextFor(facts.turns, 1))
  assert.match(prompt, /第 1 轮：用户说「第一件事」/)
  assert.match(prompt, /用户：第二件事/)
  assert.match(prompt, /#1 \[implement\] edit \/w\/a\.js/)
})

test('summarizer summarizes each finished turn once and skips running ones', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sj-'))
  try {
    const store = createSummaryStore(dir)
    let calls = 0
    const complete = async () => {
      calls++
      return '{"segments":[{"kind":"discuss","from":1,"to":1,"title":"t","summary":"s"}],"decisions":[],"open":[]}'
    }
    const summarizer = createSummarizer({ complete, store })
    const b = log()
    b.turn(1, 'a', (t) => t.step('x'))
    b.turn(2, 'b', (t) => t.step('y'), null)
    const facts = collect(b.events)
    assert.equal(summarizer.enqueue('s1', facts.turns, await store.get('s1')), 1)
    await new Promise((resolve) => setTimeout(resolve, 20))
    const cached = await store.get('s1')
    assert.equal(cached[1].version, SUMMARY_VERSION)
    assert.equal(summarizer.enqueue('s1', facts.turns, cached), 0)
    assert.equal(calls, 1)
    const onDisk = JSON.parse(await readFile(join(dir, 's1.json'), 'utf8'))
    assert.equal(onDisk[1].segments[0].title, 't')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('summarizer gives up on a turn after three failures', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sj-'))
  try {
    const store = createSummaryStore(dir)
    const realNow = Date.now
    let now = 1_000_000
    Date.now = () => now
    try {
      const summarizer = createSummarizer({ complete: async () => 'garbage', store, logger: {} })
      const facts = collect(log().turn(1, 'a', (t) => t.step('x')).events)
      for (let i = 0; i < 3; i++) {
        summarizer.enqueue('s1', facts.turns, {})
        await new Promise((resolve) => setTimeout(resolve, 10))
        now += 61_000
      }
      assert.equal(summarizer.enqueue('s1', facts.turns, {}), 0)
      assert.deepEqual(summarizer.failedTurns('s1'), [1])
    } finally {
      Date.now = realNow
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('store serializes concurrent writes and rejects unsafe ids', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sj-'))
  try {
    const store = createSummaryStore(dir)
    await Promise.all([1, 2, 3, 4].map((n) => store.put('s1', n, { n })))
    assert.deepEqual(Object.keys(await createSummaryStore(dir).get('s1')).sort(), ['1', '2', '3', '4'])
    assert.equal(validSessionId('../etc/passwd'), false)
    assert.equal(validSessionId('session-00000000-0000-4000-8000-000000000000'), true)
    await assert.rejects(store.put('../x', 1, {}))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

/** A fake response for the handler. */
function fakeRes() {
  const res = { status: 0, body: '', headersSent: false }
  res.writeHead = (status) => { res.status = status; res.headersSent = true }
  res.end = (body) => { res.body = body ?? '' }
  return res
}

test('handler: fence, routing, validation and not-found mapping', async () => {
  const b = log().turn(1, 'hi', (t) => t.step('ok'))
  const store = { get: async () => ({}) }
  const read = createJournalReader({ readEvents: async (id) => { if (id === 'missing') throw new Error('session not found'); return b.events }, store })
  const handler = createHandler({ read, authorize: (req) => req.headers.cookie === 'ok' })

  let res = fakeRes()
  await handler({ url: '/plugins/session-journal/api/journal?session=s1', method: 'GET', headers: {} }, res)
  assert.equal(res.status, 0) // the fence answered (fake: nothing written)

  res = fakeRes()
  await handler({ url: '/plugins/session-journal/api/journal?session=s1', method: 'GET', headers: { cookie: 'ok' } }, res)
  assert.equal(res.status, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.summarizer, 'off')
  assert.equal(body.phases[0].kind, 'discuss')

  for (const [url, method, status] of [
    ['/plugins/session-journal/api/journal', 'GET', 400],
    ['/plugins/session-journal/api/journal?session=../x', 'GET', 400],
    ['/plugins/session-journal/api/journal?session=s1', 'POST', 405],
    ['/plugins/session-journal/api/other', 'GET', 404],
    ['/plugins/session-journal/api/journal?session=missing', 'GET', 404],
  ]) {
    res = fakeRes()
    await handler({ url, method, headers: { cookie: 'ok' } }, res)
    assert.equal(res.status, status, `${method} ${url}`)
  }
})

test('streamText joins text deltas and throws on error finishes', async () => {
  async function* ok() {
    yield { type: 'reasoning-delta', index: 0, text: 'hmm' }
    yield { type: 'text-delta', index: 1, text: '{"a":' }
    yield { type: 'text-delta', index: 1, text: '1}' }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
  assert.equal(await streamText(ok()), '{"a":1}')
  async function* bad() {
    yield { type: 'finish', reason: { kind: 'error', failure: { message: 'boom' } } }
  }
  await assert.rejects(streamText(bad()), /boom/)
})

test('discussion folds into the phase before it, research continues a discussion', () => {
  const b = log()
  b.turn(1, '问一下', (t) => t.step('答'))
  b.turn(2, '查查', (t) => t.step('查', [{ name: 'grep', args: {} }, { name: 'read', args: {} }, { name: 'glob', args: {} }]))
  b.turn(3, '为什么', (t) => t.step('因为'))
  b.turn(4, '做吧', (t) => t.step('e', [edit('/w/a.js', 'a', 'b')]))
  b.turn(5, '好的谢谢', (t) => t.step('不客气'))
  const journal = buildJournal(collect(b.events))
  assert.deepEqual(journal.phases.map((p) => [p.kind, p.turns]), [['research', [1, 3]], ['implement', [4, 5]]])
})

test('a summarized turn closing with a report keeps one phase', () => {
  const turn = { steps: [1, 2, 3, 4].map((step) => ({ step })) }
  const segs = normalizeSegments([{ kind: 'test', from: 1, to: 3, title: 'a', summary: 'x' }, { kind: 'discuss', from: 4, to: 4, title: '回复', summary: 'y' }], turn)
  assert.deepEqual(segs.map((s) => [s.kind, s.from, s.to]), [['test', 1, 4]])
})


test('parseOutline keeps known turns, gives each turn to one item, and fills defaults', () => {
  const reply = 'x {"items":[{"title":"A","turns":[1,2,9],"status":"active","result":"r","decisions":["d"],"open":["o"]},{"title":"B","turns":[2,3],"status":"weird"},{"title":"C","turns":[42]}],"now":"n","waiting":"w"} y'
  const outline = parseOutline(reply, [1, 2, 3])
  assert.deepEqual(outline.items.map((i) => [i.title, i.turns, i.status]), [['A', [1, 2], 'active'], ['B', [3], 'done']])
  assert.equal(outline.now, 'n')
  assert.equal(outline.waiting, 'w')
  assert.equal(parseOutline('{"items":[]}', [1]), undefined)
  assert.equal(parseOutline('nope', [1]), undefined)
})

test('outlineBasis waits for every finished turn and changes when a summary changes', () => {
  const b = log()
  b.turn(1, 'a', (t) => t.step('x'))
  b.turn(2, 'b', (t) => t.step('y'))
  b.turn(3, 'c', (t) => t.step('z'), null)
  const facts = collect(b.events)
  assert.equal(outlineBasis(facts, { 1: { at: 1 } }), undefined)
  const basis = outlineBasis(facts, { 1: { at: 1 }, 2: { at: 2 } })
  assert.match(basis, /^v\d+\|1:1:1,2:1:2$/)
  assert.notEqual(outlineBasis(facts, { 1: { at: 1 }, 2: { at: 3 } }), basis)
  assert.equal(typeof outlineBasis(facts, { 1: { at: 1 } }, [2]), 'string') // failed turn does not block
})

test('buildOutlinePrompt lists every turn with its request, segments and facts', () => {
  const b = log()
  b.turn(1, '做个插件', (t) => t.step('e', [edit('/w/a.js', 'a', 'b')]))
  b.turn(2, '继续', (t) => t.step('t', [bash('node --test', 0)]), null)
  const facts = collect(b.events)
  const prompt = buildOutlinePrompt(facts, { 1: { segments: [{ kind: 'implement', from: 1, to: 1, title: '写插件', summary: '新增 a.js' }], decisions: ['用 A'], open: [] } })
  assert.match(prompt, /第 1 轮：用户说「做个插件」/)
  assert.match(prompt, /做了：实现「写插件」/)
  assert.match(prompt, /定下：用 A/)
  assert.match(prompt, /第 2 轮（进行中）/)
  assert.match(prompt, /事实：测试 1 过 0 败/)
})

test('buildJournal groups phases and files by work item; new turns join the previous item', () => {
  const b = log()
  b.turn(1, '做插件 A', (t) => t.step('e', [edit('/w/a.js', 'a', 'b')]))
  b.turn(2, '另一件事：修 B', (t) => t.step('e', [edit('/w/b.js', 'a', 'b')]))
  b.turn(3, '回到 A', (t) => t.step('t', [bash('node --test', 0)]))
  b.turn(4, '继续', (t) => t.step('e', [edit('/w/a.js', 'b', 'c')]), null)
  const outline = { items: [{ title: 'A', goal: 'ga', turns: [1, 3], status: 'done', result: 'ra', decisions: [], open: ['oa'] }, { title: 'B', goal: 'gb', turns: [2], status: 'done', result: 'rb', decisions: [], open: [] }], now: 'n', waiting: '' }
  const journal = buildJournal(collect(b.events), {}, { outline })
  assert.deepEqual(journal.items.map((i) => [i.title, i.turns, i.status, i.fileCount]), [['A', [1, 3, 4], 'active', 1], ['B', [2], 'done', 1]])
  // A phase never spans two items.
  for (const phase of journal.phases) assert.ok(journal.items.some((i) => i.phaseIds.includes(phase.id)))
  assert.equal(journal.now, 'n')
  // With an outline, stale summary leftovers are not repeated at the top.
  assert.equal(journal.open.filter((o) => o.source === 'summary').length, 0)
})

test('without an outline the whole session is one item', () => {
  const b = log()
  b.turn(1, 'x', (t) => t.step('e', [edit('/w/a.js', 'a', 'b')]))
  const journal = buildJournal(collect(b.events))
  assert.equal(journal.items.length, 1)
  assert.equal(journal.items[0].title, '')
  assert.equal(journal.items[0].status, 'done')
})

test('summarizer computes an outline once per basis', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sj-'))
  try {
    const store = createSummaryStore(dir)
    let calls = 0
    const complete = async () => { calls++; return '{"items":[{"title":"T","turns":[1],"status":"done","result":"r"}],"now":"n","waiting":""}' }
    const summarizer = createSummarizer({ complete, store })
    const facts = collect(log().turn(1, 'a', (t) => t.step('x')).events)
    assert.equal(summarizer.enqueueOutline('s1', facts, {}, undefined, 'v1|a'), true)
    await new Promise((resolve) => setTimeout(resolve, 20))
    const outline = await store.getOutline('s1')
    assert.equal(outline.basis, 'v1|a')
    assert.equal(outline.items[0].title, 'T')
    assert.equal(summarizer.enqueueOutline('s1', facts, {}, outline, 'v1|a'), false)
    assert.equal(calls, 1)
    assert.deepEqual(await store.get('s1'), {}) // the outline row is not a turn
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('turnLog gives every turn a one-line plain-text request and no reply text', () => {
  const b = log()
  b.turn(1, '旧变量能删吗', (t) => t.step('可以。**1. 旧的 `OLD_*` 变量**（见 [settings.py:10](x/settings.py#L10)）\n- 第二点'))
  const journal = buildJournal(collect(b.events))
  assert.deepEqual(journal.turnLog.map((t) => [t.turn, t.user]), [[1, '旧变量能删吗']])
  assert.equal(journal.turnLog[0].reply, undefined)
})

test('parseReply keeps the cleaned-up ask, and the outline prompt prefers it over the raw message', () => {
  const s = parseReply('{"ask":"修看板详情","segments":[{"kind":"fix","from":1,"to":1}],"decisions":[],"open":[]}')
  assert.equal(s.ask, '修看板详情')
  const facts = collect(log().turn(1, '已完成\n别的会话：要不要换数据库\n第 1 轮\n看板打不开', (t) => t.step('x')).events)
  const prompt = buildOutlinePrompt(facts, { 1: s })
  assert.match(prompt, /用户要的是「修看板详情」/)
  assert.doesNotMatch(prompt, /换数据库/)
})


test('withLang fills every placeholder for both languages', () => {
  for (const prompt of [SYSTEM_PROMPT, OUTLINE_PROMPT]) {
    for (const lang of ['zh', 'en', 'fr']) {
      const filled = withLang(prompt, lang)
      assert.doesNotMatch(filled, /\{\{[A-Z_]+\}\}/, `${lang} leaves a placeholder`)
    }
    assert.match(withLang(prompt, 'zh'), /用中文/)
    assert.match(withLang(prompt, 'en'), /^OUTPUT LANGUAGE: English/)
    assert.equal(withLang(prompt, 'fr'), withLang(prompt, 'zh'))
  }
  assert.match(withLang(SYSTEM_PROMPT, 'en'), /"title":"Check sidebar extension API"/)
})

test('store keeps one cache per summary language; zh keeps the old file name', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sj-'))
  try {
    const store = createSummaryStore(dir)
    await store.put('s1', 1, { v: 'zh' })
    await store.put('s1', 1, { v: 'en' }, 'en')
    await store.put('s1', 'outline', { items: [] }, 'en')
    assert.equal((await store.get('s1')).at, undefined)
    assert.equal((await store.get('s1'))['1'].v, 'zh')
    assert.equal((await store.get('s1', 'en'))['1'].v, 'en')
    assert.equal(await store.getOutline('s1'), undefined)
    assert.deepEqual(await store.getOutline('s1', 'en'), { items: [] })
    assert.equal(JSON.parse(await readFile(join(dir, 's1.json'), 'utf8'))['1'].v, 'zh')
    assert.equal(JSON.parse(await readFile(join(dir, 's1.en.json'), 'utf8'))['1'].v, 'en')
    assert.equal(normalizeLang('ja'), 'zh')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('summarizer queues and fails per language independently', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sj-'))
  try {
    const store = createSummaryStore(dir)
    const seen = []
    const complete = async (system) => { seen.push(system.startsWith('OUTPUT LANGUAGE') ? 'en' : 'zh'); return '{"segments":[{"kind":"discuss","from":1,"to":1}],"decisions":[],"open":[]}' }
    const summarizer = createSummarizer({ complete, store })
    const facts = collect(log().turn(1, 'a', (t) => t.step('x')).events)
    summarizer.enqueue('s1', facts.turns, {}, 'zh')
    summarizer.enqueue('s1', facts.turns, {}, 'en')
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.deepEqual(seen.sort(), ['en', 'zh'])
    assert.equal(Object.keys(await store.get('s1', 'en')).length, 1)
    assert.equal(Object.keys(await store.get('s1', 'zh')).length, 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('handler passes the lang query through and the reader reports it', async () => {
  const b = log().turn(1, 'hi', (t) => t.step('ok'))
  const asked = []
  const store = { get: async (id, lang) => { asked.push(lang); return {} }, getOutline: async () => undefined }
  const read = createJournalReader({ readEvents: async () => b.events, store })
  const handler = createHandler({ read, authorize: () => true })
  const res = fakeRes()
  await handler({ url: '/plugins/session-journal/api/journal?session=s1&lang=en', method: 'GET', headers: {} }, res)
  assert.equal(JSON.parse(res.body).lang, 'en')
  const res2 = fakeRes()
  await handler({ url: '/plugins/session-journal/api/journal?session=s1', method: 'GET', headers: {} }, res2)
  assert.equal(JSON.parse(res2.body).lang, 'zh')
  assert.deepEqual(asked, ['en', 'zh'])
})

test('collect picks up the session model from the request header', () => {
  const events = [
    { type: 'session', cwd: '/w' },
    { type: 'request/header', data: { header: { config: { provider: 'p1', model: 'm1', maxTokens: 10 } } } },
  ]
  assert.deepEqual(collect(events).model, { provider: 'p1', model: 'm1' })
  assert.equal(collect([{ type: 'session', cwd: '/w' }]).model, undefined)
})

test('pickRoute: a full override wins, otherwise the session route', async () => {
  const { pickRoute } = await import('../lib/index.js')
  const session = { provider: 'p1', model: 'm1' }
  assert.deepEqual(pickRoute({ provider: 'p2', model: 'm2' }, session), { provider: 'p2', model: 'm2' })
  assert.deepEqual(pickRoute({ provider: undefined, model: undefined }, session), session)
  assert.deepEqual(pickRoute({ provider: 'p2', model: undefined }, session), session)
  assert.equal(pickRoute({}, undefined), undefined)
})

test('summarizer passes the session route to complete', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sj-'))
  try {
    const store = createSummaryStore(dir)
    const routes = []
    const complete = async (system, user, opts) => { routes.push(opts.route); return '{"segments":[{"kind":"discuss","from":1,"to":1}],"decisions":[],"open":[]}' }
    const summarizer = createSummarizer({ complete, store })
    const facts = collect(log().turn(1, 'a', (t) => t.step('x')).events)
    summarizer.enqueue('s1', facts.turns, {}, 'zh', { provider: 'p1', model: 'm1' })
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.deepEqual(routes, [{ provider: 'p1', model: 'm1' }])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})


test('research detection covers generic MCP lookup tools; skills count as reviews by name', () => {
  const b = log()
  b.turn(1, 'look around', (t) => {
    t.step('s', [{ name: 'mcp__docs__search_pages', args: {} }, { name: 'read', args: {} }])
    t.step('r', [{ name: 'skill', args: { name: 'code-review' } }])
    t.step('w', [{ name: 'mcp__tracker__create_issue', args: {} }])
  })
  const kinds = collect(b.events).turns[0].steps.map((s) => s.kind)
  assert.deepEqual(kinds, ['research', 'review', 'other'])
})
