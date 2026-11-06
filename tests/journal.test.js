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
      push('user/message', { content: [{ type: 'text', text: 'injected context' }], source: { kind: 'runtime' } })
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
  for (const cmd of ['node --test tests/*.test.js', 'pnpm test', 'npm run e2e', 'node e2e/checkout.e2e.mjs', './run-tests.sh', 'pytest -q', 'python3 tools/verify_schema.py']) assert.ok(TEST_COMMAND.test(cmd), cmd)
  for (const cmd of ['head -40 e2e/checkout.e2e.mjs', 'ls tests', 'cat tests/a.test.js', 'git status']) assert.ok(!TEST_COMMAND.test(cmd), cmd)
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
    t.step('a', [{ name: 'skill', args: { name: 'code-review' } }])
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
      t.step('rev', [{ name: 'skill', args: { name: 'code-review' } }])
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
  b.turn(3, '审一下', (t) => t.step('r', [{ name: 'skill', args: { name: 'code-review' } }]))
  b.turn(4, '改', (t) => t.step('f', [edit('/w/a.js', 'b', 'c')]))
  b.turn(5, '再审', (t) => t.step('r', [{ name: 'skill', args: { name: 'code-review' } }]))
  b.turn(6, '再审一轮', (t) => t.step('r', [{ name: 'skill', args: { name: 'code-review' } }]))
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
  b.turn(1, '把 README 翻成英文', (t) => t.step('好的。**1. 标题** 已翻译（见 [README.md:1](README.md#L1)）\n- 第二段'))
  const journal = buildJournal(collect(b.events))
  assert.deepEqual(journal.turnLog.map((t) => [t.turn, t.user]), [[1, '把 README 翻成英文']])
  assert.equal(journal.turnLog[0].reply, undefined)
})

test('parseReply keeps the cleaned-up ask, and the outline prompt prefers it over the raw message', () => {
  const s = parseReply('{"ask":"给按钮换个颜色","segments":[{"kind":"fix","from":1,"to":1}],"decisions":[],"open":[]}')
  assert.equal(s.ask, '给按钮换个颜色')
  const facts = collect(log().turn(1, '已完成\n别的会话：示例待办 A\n第 1 轮\n给按钮换个颜色', (t) => t.step('x')).events)
  const prompt = buildOutlinePrompt(facts, { 1: s })
  assert.match(prompt, /用户要的是「给按钮换个颜色」/)
  assert.doesNotMatch(prompt, /示例待办 A/)
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

/** Fake clock + timers: advance(ms) fires due timers in order. */
function fakeTime() {
  let t = 0
  const timers = new Map()
  let next = 1
  return {
    now: () => t,
    setTimer: (fn, ms) => { const h = next++; timers.set(h, { at: t + ms, fn }); return h },
    clearTimer: (h) => { timers.delete(h) },
    pending: () => timers.size,
    async advance(ms) {
      const end = t + ms
      for (;;) {
        const due = [...timers].filter(([, v]) => v.at <= end).sort((x, y) => x[1].at - y[1].at)[0]
        if (due === undefined) break
        timers.delete(due[0]); t = due[1].at; due[1].fn()
        for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r))
      }
      t = end
    },
  }
}

test('auto-updater follows only the session whose turn ended, until nothing is in progress', async () => {
  const { createAutoUpdater } = await import('../lib/autoupdate.js')
  const clock = fakeTime()
  const reads = []
  let work = 2 // reads that still report work in progress
  const updater = createAutoUpdater({
    read: async (id, lang, options) => { reads.push([id, lang, options?.fresh]); return work-- > 0 ? { pending: 1 } : { pending: 0, outlining: false, retrying: 0 } },
    ...clock,
  })
  updater.onSessionEvent({ id: 's1', header: {} }, { type: 'assistant/message' })
  updater.onSessionEvent({ id: 'child', header: { delegationDepth: 1 } }, { type: 'turn/end' })
  assert.equal(clock.pending(), 0)
  updater.onSessionEvent({ id: 's1', header: { delegationDepth: 0 } }, { type: 'turn/end' })
  updater.onSessionEvent({ id: 's1', header: {} }, { type: 'turn/end' }) // debounced
  await clock.advance(60_000)
  assert.deepEqual(reads, [['s1', 'zh', true], ['s1', 'zh', true], ['s1', 'zh', true]])
  assert.deepEqual(updater.following(), []) // stopped once idle
})

test('auto-updater keeps polling through a failed summary until its retry lands, and gives up after maxFollowMs', async () => {
  const { createAutoUpdater } = await import('../lib/autoupdate.js')
  const clock = fakeTime()
  let reads = 0
  // retrying stays > 0 for 60 s, as when a summary failed and waits for its back-off.
  const updater = createAutoUpdater({ read: async () => { reads++; return { pending: 0, retrying: clock.now() < 62_000 ? 1 : 0 } }, ...clock })
  updater.onSessionEvent({ id: 's1', header: {} }, { type: 'turn/end' })
  await clock.advance(70_000)
  assert.ok(reads >= 12, `polled through the back-off (${reads} reads)`)
  assert.deepEqual(updater.following(), [])
  // A session whose state never changes is dropped after maxIdleMs.
  const stuck = createAutoUpdater({ read: async () => ({ pending: 1 }), maxIdleMs: 20_000, ...clock })
  stuck.onSessionEvent({ id: 's2', header: {} }, { type: 'turn/end' })
  await clock.advance(40_000)
  assert.deepEqual(stuck.following(), [])
  // Progress keeps a long backfill followed past maxIdleMs, up to maxFollowMs.
  let left = 30
  const backfill = createAutoUpdater({ read: async () => ({ pending: left > 0 ? left-- : 0 }), maxIdleMs: 20_000, maxFollowMs: 120_000, ...clock })
  backfill.onSessionEvent({ id: 's3', header: {} }, { type: 'turn/end' })
  await clock.advance(100_000)
  assert.equal(left, 10) // 20 polls of 5 s, every one with progress
  assert.deepEqual(backfill.following(), ['s3'])
  await clock.advance(60_000)
  assert.deepEqual(backfill.following(), []) // total cap reached
})

test('auto-updater: a turn end during a slow read reads again instead of losing the follow', async () => {
  const { createAutoUpdater } = await import('../lib/autoupdate.js')
  const clock = fakeTime()
  const calls = []
  let release
  const updater = createAutoUpdater({
    read: (id, lang) => {
      calls.push(calls.length + 1)
      if (calls.length === 1) return new Promise((r) => { release = () => r({ pending: 0 }) }) // slow, sees the old log
      return Promise.resolve(calls.length === 2 ? { pending: 1 } : { pending: 0 })
    },
    ...clock,
  })
  updater.onSessionEvent({ id: 's1', header: {} }, { type: 'turn/end' })
  await clock.advance(1_500) // read 1 starts and hangs
  updater.onSessionEvent({ id: 's1', header: {} }, { type: 'turn/end' })
  await clock.advance(5_000)
  assert.equal(calls.length, 1) // no second concurrent read
  release(); await new Promise((r) => setImmediate(r))
  await clock.advance(30_000)
  assert.deepEqual(calls, [1, 2, 3]) // re-read after the turn end, polled while busy, then idle
  assert.deepEqual(updater.following(), [])
})

test('auto-updater fixes the language when a follow starts and persists the last viewed one', async () => {
  const { createAutoUpdater } = await import('../lib/autoupdate.js')
  const clock = fakeTime()
  const langs = []
  const saved = []
  const updater = createAutoUpdater({ read: async (id, lang) => { langs.push(lang); return { pending: langs.length < 3 ? 1 : 0 } }, defaultLang: () => 'en', onLangViewed: (l) => saved.push(l), ...clock })
  updater.onSessionEvent({ id: 'fresh', header: {} }, { type: 'turn/end' })
  await clock.advance(2_000)
  updater.noteView('other', 'zh') // switching language elsewhere mid-follow
  await clock.advance(30_000)
  assert.deepEqual(langs, ['en', 'en', 'en'])
  assert.deepEqual(saved, ['zh'])
})

test('auto-updater language: last viewed for the session, else the stored cache, else the last viewed anywhere', async () => {
  const { createAutoUpdater } = await import('../lib/autoupdate.js')
  const clock = fakeTime()
  const langs = []
  const updater = createAutoUpdater({ read: async (id, lang) => { langs.push([id, lang]); return {} }, storedLang: async (id) => (id === 'cached-en' ? 'en' : undefined), ...clock })
  updater.noteView('viewed', 'en')
  updater.noteView('viewed', 'xx-junk') // normalized: zh
  updater.noteView('other', 'en')
  for (const id of ['viewed', 'cached-en', 'fresh']) updater.onSessionEvent({ id, header: {} }, { type: 'turn/end' })
  await clock.advance(5_000)
  assert.deepEqual(langs.sort(), [['cached-en', 'en'], ['fresh', 'en'], ['viewed', 'zh']])
})

test('auto-updater dispose stops timers and in-flight follow-ups', async () => {
  const { createAutoUpdater } = await import('../lib/autoupdate.js')
  const clock = fakeTime()
  let reads = 0
  const updater = createAutoUpdater({ read: async () => { reads++; return { pending: 1 } }, ...clock })
  updater.onSessionEvent({ id: 's1', header: {} }, { type: 'turn/end' })
  await clock.advance(2_000)
  updater.dispose()
  await clock.advance(60_000)
  assert.equal(reads, 1)
  assert.equal(clock.pending(), 0)
  updater.onSessionEvent({ id: 's1', header: {} }, { type: 'turn/end' })
  assert.equal(clock.pending(), 0)
})

test('reader reports retrying failures; a failure next to a success, or several at once, are retried by the next reads', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sj-'))
  try {
    const store = createSummaryStore(dir)
    let t = 0
    let failing = new Set([1, 3])
    const complete = async (system, user) => {
      if (system.includes('整理员')) return '{"items":[{"title":"T","turns":[1,2,3],"status":"done","result":"r"}],"now":"n","waiting":""}'
      const turn = Number(user.match(/第 (\d+) 轮，共/)?.[1])
      if (failing.has(turn)) throw new Error('timeout')
      return '{"segments":[{"kind":"discuss","from":1,"to":1}],"decisions":[],"open":[]}'
    }
    const summarizer = createSummarizer({ complete, store, now: () => t })
    const b = log()
    for (const n of [1, 2, 3]) b.turn(n, `ask ${n}`, (x) => x.step('s'))
    const read = createJournalReader({ readEvents: async () => b.events, store, summarizer, now: () => t })
    const settle = () => new Promise((r) => setTimeout(r, 40))
    let j = await read('s1', 'zh', { fresh: true }); await settle()
    j = await read('s1', 'zh', { fresh: true })
    assert.equal(j.retrying, 2) // turns 1 and 3 failed; turn 2 succeeded
    assert.equal(j.outlining, false) // outline waits for every summary
    failing = new Set()
    t += 61_000 // back-off over
    j = await read('s1', 'zh', { fresh: true }); await settle()
    j = await read('s1', 'zh', { fresh: true }); await settle()
    j = await read('s1', 'zh', { fresh: true })
    assert.equal(j.retrying, 0)
    assert.ok(j.outlineAt !== undefined, 'outline done after the retries')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a finished turn with no steps does not block the outline', () => {
  const facts = { turns: [{ turn: 1, end: 5, steps: [{}] }, { turn: 2, end: 9, steps: [] }] }
  assert.match(outlineBasis(facts, { 1: { at: 1 } }), /^v\d+\|1:1:1$/)
})

test('summarizer dispose drops queued work and stops writing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sj-'))
  try {
    const store = createSummaryStore(dir)
    let release
    const gate = new Promise((r) => { release = r })
    let signals = []
    const complete = async (system, user, opts) => { signals.push(opts.signal); await gate; return '{"segments":[{"kind":"discuss","from":1,"to":1}],"decisions":[],"open":[]}' }
    const summarizer = createSummarizer({ complete, store, concurrency: 1 })
    const b = log()
    for (const n of [1, 2, 3]) b.turn(n, `ask ${n}`, (x) => x.step('s'))
    summarizer.enqueue('s1', collect(b.events).turns, {})
    await new Promise((r) => setTimeout(r, 10))
    summarizer.dispose()
    assert.equal(signals.length, 1)
    assert.equal(signals[0].aborted, true)
    release()
    await new Promise((r) => setTimeout(r, 30))
    assert.deepEqual(await store.get('s1'), {})
    assert.equal(summarizer.enqueue('s1', collect(b.events).turns, {}), 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('reader with fresh: true bypasses the short facts cache', async () => {
  let reads = 0
  const read = createJournalReader({ readEvents: async () => { reads++; return log().turn(1, 'a', (t) => t.step('x')).events }, store: { get: async () => ({}), getOutline: async () => undefined } })
  await read('s1'); await read('s1')
  assert.equal(reads, 1)
  await read('s1', undefined, { fresh: true })
  assert.equal(reads, 2)
})

test('tool detection is generic: spawn_* plugins delegate, *_search/*_expand plugin tools look things up', () => {
  const b = log()
  b.turn(1, 'look and delegate', (t) => {
    t.step('s', [{ name: 'notes_search', args: {} }, { name: 'history-expand', args: {} }, { name: 'mcp__wiki__wiki-search', args: {} }])
    t.step('d', [{ name: 'spawn_helper', args: { description: 'review the diff' } }])
    t.step('w', [{ name: 'notes_write', args: {} }])
  })
  const steps = collect(b.events).turns[0].steps
  assert.deepEqual(steps.map((s) => s.kind), ['research', 'review', 'other'])
})

test('lookup detection reads whole words and rejects names that also change things', () => {
  const kindOf = (name) => collect(log().turn(1, 'x', (t) => t.step('s', [{ name, args: {} }])).events).turns[0].steps[0].kind
  for (const name of ['notes_search', 'mcp__docs__get_page', 'mcp__gh__searchCode', 'mcp__wiki__wiki-search', 'list_agents', 'get_goal', 'job_list'])
    assert.equal(kindOf(name), 'research', name)
  for (const name of ['find_and_replace', 'search_replace', 'get_or_create', 'read_write_file', 'mcp__memory__forget', 'mcp__x__create_widget', 'mcp__x__set_target', 'mcp__x__delete_budget', 'mcp__sheets__update_spreadsheet', 'mcp__slack__reply_to_thread', 'update_goal', 'job_kill', 'schedule_create', 'spawn_process'])
    assert.equal(kindOf(name), 'other', name)
})

test('prompts define an open item as unfinished requested work or an unanswered question', () => {
  for (const prompt of [OUTLINE_PROMPT, SYSTEM_PROMPT]) assert.match(prompt, /只有两种事算没解决/)
  assert.match(OUTLINE_PROMPT, /done（已完成：用户要的做完了，哪怕后面还在等别人审批、回复或任务跑完）/)
  for (const prompt of [OUTLINE_PROMPT, SYSTEM_PROMPT]) for (const kind of ['等别人或外部流程的', '顺带提的风险', '没查到', '交给别的会话']) assert.ok(prompt.includes(kind), kind)
})
