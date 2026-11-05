/**
 * The journal: per-turn facts (collector.js) plus optional per-turn
 * summaries (summarizer.js) folded into what the panel shows: the goal,
 * where the work is now, a phase timeline with numbered rounds, the files
 * that changed, and what is still open.
 *
 * Phase kinds are a fixed set so rounds stay countable; the summarizer may
 * only pick from it. Without a summary a turn falls back to rule-based
 * segments from each step's activity tag.
 * @module dsh-session-journal/journal
 */

/** Phase kinds in display vocabulary. */
export const PHASE_KINDS = ['requirement', 'research', 'design', 'implement', 'review', 'fix', 'test', 'debug', 'deliver', 'discuss', 'other']

/** Kinds whose repeated rounds are numbered. */
const ROUNDED = new Set(['review', 'fix', 'test', 'debug', 'deliver', 'implement', 'design'])

const clip = (text, max) => {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/**
 * Markdown to plain text for previews: links keep their label, images and
 * code fences go, emphasis, inline-code and heading marks are dropped.
 */
export function plainText(markdown) {
  return String(markdown ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__|~~)(.+?)\1/g, '$2')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\|/g, ' ')
}

/**
 * Rule-based segments of one turn, deliberately coarse. Only three step
 * kinds cut a turn: a review, an edit, and a test run. Read-only steps
 * belong to whatever segment they sit in. A test run followed by another
 * edit (before the next review) is part of implementing, so a test segment
 * only stands for the checks after the last edit. An edit after any review
 * earlier in the session is a fix. A turn with no cutting step is research
 * when it used three or more tools, otherwise discussion.
 * @param {import('./collector.js').Turn} turn
 * @param {{ reviewed: boolean }} state - mutable: whether a review happened before.
 */
export function ruleSegments(turn, state) {
  const last = Math.max(1, turn.steps.at(-1)?.step ?? 1)
  const hard = []
  for (const step of turn.steps) {
    if (step.reviews.length > 0) hard.push({ step: step.step, kind: 'review' })
    else if (step.edits.length > 0) hard.push({ step: step.step, kind: 'edit' })
    else if (step.tests.length > 0) hard.push({ step: step.step, kind: 'test' })
  }
  if (hard.length === 0) {
    const calls = turn.steps.reduce((n, step) => n + step.calls.length, 0)
    return [{ kind: calls >= 3 ? 'research' : 'discuss', from: 1, to: last, title: '', summary: '' }]
  }
  // A test with a later edit and no review in between is part of the edit run.
  for (let i = 0; i < hard.length; i++) {
    if (hard[i].kind !== 'test') continue
    for (let j = i + 1; j < hard.length && hard[j].kind !== 'review'; j++) {
      if (hard[j].kind === 'edit') {
        hard[i].kind = 'edit'
        break
      }
    }
  }
  const segments = []
  for (const mark of hard) {
    let kind = mark.kind
    if (kind === 'review') state.reviewed = true
    if (kind === 'edit') kind = state.reviewed ? 'fix' : 'implement'
    const prev = segments.at(-1)
    if (prev !== undefined && prev.kind === kind) continue
    if (prev !== undefined) prev.to = mark.step - 1
    segments.push({ kind, from: segments.length === 0 ? 1 : mark.step, to: last })
  }
  return segments.map((seg) => ({ ...seg, title: '', summary: '' }))
}

/**
 * Validate one summarizer segment list against the turn's step range.
 * Segments without usable step numbers are spread evenly over the steps
 * (the order is still right; only the boundaries are guessed).
 */
export function normalizeSegments(segments, turn) {
  if (!Array.isArray(segments) || segments.length === 0) return undefined
  const last = Math.max(1, turn.steps.at(-1)?.step ?? 1)
  const usable = segments.filter((seg) => seg !== null && typeof seg === 'object').slice(0, Math.max(1, last))
  if (usable.length === 0) return undefined
  const numbered = usable.every((seg) => Number.isInteger(seg.from) && Number.isInteger(seg.to))
  const out = []
  let next = 1
  usable.forEach((raw, i) => {
    const kind = PHASE_KINDS.includes(raw?.kind) ? raw.kind : 'other'
    let from
    let to
    if (numbered) {
      from = Math.max(next, raw.from)
      to = Math.min(last, Math.max(from, raw.to))
    } else {
      from = next
      to = i === usable.length - 1 ? last : Math.max(from, Math.round(((i + 1) * last) / usable.length))
    }
    if (from > last) return
    out.push({ kind, from, to, title: clip(raw?.title, 40), summary: clip(raw?.summary, 240) })
    next = to + 1
  })
  if (out.length === 0) return undefined
  out.at(-1).to = last
  return foldWrapUp(out)
}

/**
 * Fold a turn's discussion segments that follow other work (the agent
 * reporting back) into the segment before them: that is the end of the
 * work, not a phase of its own. Adjacent same-kind segments merge too.
 */
export function foldWrapUp(segments) {
  const out = []
  for (const seg of segments) {
    const prev = out.at(-1)
    if (prev !== undefined && (prev.kind === seg.kind || seg.kind === 'discuss')) {
      prev.to = seg.to
      if (prev.kind === seg.kind && seg.summary !== '') prev.summary = prev.summary === '' ? seg.summary : `${prev.summary} ${seg.summary}`
      continue
    }
    out.push({ ...seg })
  }
  return out
}

const emptyTally = () => ({ files: new Map(), added: 0, removed: 0, testsPassed: 0, testsFailed: 0, failures: [], reviews: [] })

/**
 * Whether a new segment continues the previous phase instead of starting
 * one. Same kinds merge. A discussion continues whatever came before it
 * (answering questions about work is part of that work), and research
 * continues a discussion or research (back-and-forth while working out
 * what to do is one investigation, not alternating phases).
 */
export function mergesInto(prevKind, kind) {
  if (prevKind === kind) return true
  if (kind === 'discuss' || kind === 'other') return true
  if (kind === 'research' && prevKind === 'discuss') return true
  return false
}

/** Add the facts of steps [from, to] of a turn into a tally. */
function tallySteps(tally, turn, from, to) {
  for (const step of turn.steps) {
    if (step.step < from || step.step > to) continue
    for (const edit of step.edits) {
      tally.added += edit.added
      tally.removed += edit.removed
      tally.files.set(edit.path, true)
    }
    for (const test of step.tests) {
      if (test.ok) tally.testsPassed++
      else {
        tally.testsFailed++
        tally.failures.push(test.label)
      }
    }
    for (const review of step.reviews) tally.reviews.push(review.label)
  }
}

/**
 * Which outline item each turn belongs to. Turns the outline has not seen
 * (newer than it) join the item of the turn before them.
 * @returns {Map<number, number>} turn → item index (0 without an outline)
 */
export function itemOwners(outline, turnNumbers) {
  const owner = new Map()
  ;(outline?.items ?? []).forEach((item, index) => { for (const n of item.turns) owner.set(n, index) })
  let last = 0
  for (const n of turnNumbers) {
    if (owner.has(n)) last = owner.get(n)
    else owner.set(n, last)
  }
  return owner
}

/**
 * Fold collected facts and cached summaries into the journal.
 * @param {ReturnType<import('./collector.js').collect>} facts
 * @param {Record<number, { segments?: any[], decisions?: string[], open?: string[], goal?: string }>} summaries - by turn.
 * @param {{ sessionId?: string, outline?: ReturnType<typeof import('./outline.js').parseOutline> }} [options]
 */
export function buildJournal(facts, summaries = {}, options = {}) {
  const ruleState = { reviewed: false }
  const phases = []
  const files = new Map()
  let goal
  const decisions = []
  let summarizedTurns = 0
  let summarizableTurns = 0
  const owner = itemOwners(options.outline, facts.turns.map((turn) => turn.turn))

  for (const turn of facts.turns) {
    const done = turn.end !== undefined
    if (done) summarizableTurns++
    const summary = done ? summaries[turn.turn] : undefined
    const llm = summary === undefined ? undefined : normalizeSegments(summary.segments, turn)
    // Keep the rule state moving even for summarized turns so a later
    // unsummarized turn still knows whether a review happened.
    const rules = ruleSegments(turn, ruleState)
    if (llm !== undefined) {
      summarizedTurns++
      if (llm.some((seg) => seg.kind === 'review')) ruleState.reviewed = true
    }
    const segments = llm ?? rules
    if (typeof summary?.goal === 'string' && summary.goal.trim() !== '') goal = clip(summary.goal, 120)
    for (const d of summary?.decisions ?? []) {
      if (typeof d === 'string' && d.trim() !== '') decisions.push({ turn: turn.turn, text: clip(d, 160) })
    }
    segments.forEach((seg, i) => {
      const fromStep = turn.steps.find((s) => s.step >= seg.from)
      const start = i === 0 ? turn.start : (fromStep?.time ?? turn.start)
      const nextSeg = segments[i + 1]
      const endStep = nextSeg === undefined ? undefined : turn.steps.find((s) => s.step >= nextSeg.from)
      const end = nextSeg === undefined ? turn.end : (endStep?.time ?? turn.end)
      const prev = phases.at(-1)
      const item = owner.get(turn.turn) ?? 0
      let phase
      // Phases never span two work items: switching to another item starts a new phase.
      if (prev !== undefined && prev.item === item && mergesInto(prev.kind, seg.kind)) {
        phase = prev
        if (seg.kind === 'research' && prev.kind === 'discuss') phase.kind = 'research'
      } else {
        phase = { kind: seg.kind, item, start, end, turns: [turn.turn, turn.turn], notes: [], tally: emptyTally(), userAsks: [] }
        phases.push(phase)
      }
      phase.end = end
      phase.turns[1] = turn.turn
      if (i === 0 && turn.user !== '') phase.userAsks.push({ turn: turn.turn, text: clip(turn.user, 200) })
      if (seg.summary !== '' || seg.title !== '') phase.notes.push({ turn: turn.turn, title: seg.title, text: seg.summary })
      tallySteps(phase.tally, turn, seg.from, seg.to)
      for (const step of turn.steps) {
        if (step.step < seg.from || step.step > seg.to) continue
        for (const edit of step.edits) {
          const row = files.get(edit.path) ?? { path: edit.path, added: 0, removed: 0, created: false, phases: new Set(), lastTime: 0 }
          row.added += edit.added
          row.removed += edit.removed
          row.created ||= edit.op === 'create'
          row.phases.add(phases.length - 1)
          row.lastTime = Math.max(row.lastTime, step.time ?? 0)
          files.set(edit.path, row)
        }
      }
    })
  }

  // Number repeated rounds of the kinds whose count matters ("审阅 #2",
  // "测试 #3") within each work item; research and discussion recur
  // constantly and stay unnumbered.
  const seen = {}
  const totals = {}
  const roundKey = (phase) => `${phase.item}:${phase.kind}`
  for (const phase of phases) totals[roundKey(phase)] = (totals[roundKey(phase)] ?? 0) + 1
  const lastTurn = facts.turns.at(-1)
  const running = lastTurn !== undefined && lastTurn.end === undefined
  const outPhases = phases.map((phase, index) => {
    const key = roundKey(phase)
    seen[key] = (seen[key] ?? 0) + 1
    const { tally } = phase
    return {
      id: index,
      kind: phase.kind,
      item: phase.item,
      round: ROUNDED.has(phase.kind) && totals[key] > 1 ? seen[key] : undefined,
      start: phase.start,
      end: phase.end,
      turns: phase.turns,
      active: running && index === phases.length - 1,
      notes: phase.notes,
      userAsks: phase.userAsks,
      edits: { files: tally.files.size, added: tally.added, removed: tally.removed },
      tests: { passed: tally.testsPassed, failed: tally.testsFailed, failures: [...new Set(tally.failures)].slice(0, 5) },
      reviews: tally.reviews,
    }
  })

  // Open items. With an outline, each work item carries its own open list
  // (the outline saw the whole session, so later fixes are already taken
  // out); only a recent todo list is added here. Without one: unfinished
  // todos, tests whose latest run failed, and the newest summary's leftovers.
  const open = []
  const recentTodos = facts.todosTurn !== undefined && lastTurn !== undefined && lastTurn.turn - facts.todosTurn <= 1
  for (const todo of facts.todos ?? []) {
    if ((options.outline === undefined || recentTodos) && todo?.status !== 'completed' && typeof todo?.content === 'string') open.push({ source: 'todo', text: clip(todo.content, 160), status: todo.status })
  }
  const latestTest = new Map()
  for (const turn of facts.turns) for (const step of turn.steps) for (const test of step.tests) latestTest.set(test.label, test.ok)
  if (options.outline === undefined) {
    for (const [label, ok] of latestTest) if (!ok) open.push({ source: 'test', text: label })
    const lastSummarized = [...facts.turns].reverse().find((turn) => summaries[turn.turn] !== undefined)
    for (const item of lastSummarized === undefined ? [] : summaries[lastSummarized.turn].open ?? []) {
      if (typeof item === 'string' && item.trim() !== '') open.push({ source: 'summary', text: clip(item, 160) })
    }
  }

  const allFiles = [...files.values()]
    .map((row) => ({ ...row, phases: [...row.phases] }))
    .sort((a, b) => b.lastTime - a.lastTime)
  const firstAsk = facts.turns.find((turn) => turn.user !== '')?.user
  const tests = { passed: 0, failed: 0 }
  for (const ok of latestTest.values()) ok ? tests.passed++ : tests.failed++
  const current = outPhases.at(-1)
  const items = buildItems(options.outline, facts, outPhases, allFiles, running)
  return {
    sessionId: options.sessionId,
    title: facts.title,
    cwd: facts.cwd,
    goal: goal ?? clip(firstAsk ?? facts.title ?? '', 120),
    goalSource: goal === undefined ? 'first-message' : 'summary',
    running,
    current: current === undefined ? undefined : { kind: current.kind, round: current.round, since: current.start },
    now: options.outline?.now ?? '',
    waiting: options.outline?.waiting ?? '',
    stats: {
      turns: facts.turns.length,
      startedAt: facts.turns[0]?.start,
      lastAt: lastTurn?.end ?? lastTurn?.steps.at(-1)?.time ?? lastTurn?.start,
      files: allFiles.length,
      added: allFiles.reduce((n, f) => n + f.added, 0),
      removed: allFiles.reduce((n, f) => n + f.removed, 0),
      tests,
    },
    summarized: { done: summarizedTurns, total: summarizableTurns },
    items,
    // Per turn: what the user asked (one line, an index into the chat; the
    // panel jumps there rather than showing the turn) and how it ended.
    turnLog: facts.turns.map((turn) => ({
      turn: turn.turn,
      start: turn.start,
      end: turn.end,
      outcome: turn.outcome,
      user: clip(plainText(turn.user), 160),
      // For turns with no human message (auto-resume, a subagent notice):
      // what the summary says the turn was about.
      about: clip(summaries[turn.turn]?.ask ?? summaries[turn.turn]?.segments?.find((seg) => seg?.title)?.title ?? '', 160),
    })),
    phases: outPhases,
    files: allFiles,
    decisions: decisions.slice(-12),
    open,
  }
}

const STATUS_ORDER = { active: 0, blocked: 1, done: 2, dropped: 3 }

/**
 * Work items: the outline's grouping of turns by purpose, each with the
 * phases, files and facts of its turns. Turns the outline has not seen yet
 * (newer than it, or the turn running now) join the item of the turn
 * before them, so a fresh turn shows up without waiting for a new outline.
 * Without an outline every turn falls into one item named after the goal.
 */
export function buildItems(outline, facts, phases, files, running) {
  const turnNumbers = facts.turns.map((turn) => turn.turn)
  const raw = outline?.items?.length ? outline.items : [{ title: '', goal: '', turns: turnNumbers, status: running ? 'active' : 'done', result: '', decisions: [], open: [] }]
  const owner = itemOwners(outline, turnNumbers)
  const lastTurn = turnNumbers.at(-1)
  const items = raw.map((item, index) => {
    const turns = turnNumbers.filter((n) => owner.get(n) === index)
    const turnSet = new Set(turns)
    const own = phases.filter((phase) => phase.item === index)
    const itemFiles = files.filter((file) => file.phases.some((id) => own.some((phase) => phase.id === id)))
    const tally = { added: 0, removed: 0, passed: 0, failed: 0, reviews: 0 }
    for (const phase of own) {
      tally.added += phase.edits.added
      tally.removed += phase.edits.removed
      tally.passed += phase.tests.passed
      tally.failed += phase.tests.failed
      tally.reviews += phase.reviews.length
    }
    const live = running && turnSet.has(lastTurn)
    return {
      id: index,
      title: item.title,
      goal: item.goal,
      status: live ? 'active' : item.status,
      result: item.result,
      decisions: item.decisions,
      open: item.open,
      turns,
      start: own[0]?.start,
      end: own.at(-1)?.end,
      phaseIds: own.map((phase) => phase.id),
      fileCount: itemFiles.length,
      stats: tally,
    }
  }).filter((item) => item.turns.length > 0)
  return items.sort((a, b) => (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || ((b.end ?? 0) - (a.end ?? 0)))
}
