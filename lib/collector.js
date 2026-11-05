/**
 * Facts from one session's event log, no model calls: per turn, the user's
 * prompt, the final assistant text, and one compact record per step (what
 * tools ran, which files changed and by how many lines, which test commands
 * passed or failed, which review agents ran). Everything here is
 * deterministic, so the journal still renders when no summarizer model is
 * configured or the call fails.
 *
 * Input is the raw event array (`sessionQuery.readSession(id).events`): the
 * log is append-only, so events shadowed by compaction are still present.
 * @module dsh-session-journal/collector
 */

/**
 * Bash commands that count as running tests: a test runner, or a script
 * whose name says check/test/e2e/verify/smoke being executed (merely
 * reading or listing such a file does not count).
 */
export const TEST_COMMAND = /(\bnode\s+--test\b|\b(?:npm|pnpm|yarn)\s+(?:run\s+)?(?:test|e2e|smoke)\b|\bpytest\b|\bjest\b|\bvitest\b|\bmocha\b|\bplaywright\s+test\b|\bgo\s+test\b|\bcargo\s+test\b|(?:\b(?:node|bash|sh|python3?|tsx|deno\s+run)\s+(?:-\S+\s+)*|\.\/)[\w./~-]*(?:check|test|e2e|verify|smoke|doctor)[\w.-]*\.(?:mjs|cjs|js|ts|sh|py)\b)/i

/** Prompts of delegated work, and skill names, that count as a review. */
const REVIEW_PROMPT = /review|审阅|审查|评审|批判|挑刺|critic|audit|找茬|红队/i

/** Tools that delegate work to another agent. */
const DELEGATION_TOOLS = new Set(['subagent', 'subagent_fork', 'spawn_teammate', 'spawn_teammate_with_model', 'workflow'])

/** Read-only investigation tools. */
const RESEARCH_TOOLS = new Set(['read', 'grep', 'glob', 'web_search', 'web_fetch', 'ctx_search', 'ctx_expand', 'read_image', 'list_mcp_resources', 'list_mcp_resource_templates', 'read_mcp_resource'])

/** MCP tools (`mcp__<server>__<tool>`) whose name says they only look things up. */
const MCP_RESEARCH = /^mcp__.+__.*(search|fetch|read|get|list|query|find|lookup)/i

const isResearchTool = (name) => RESEARCH_TOOLS.has(name) || MCP_RESEARCH.test(name)

const lineCount = (text) => {
  if (typeof text !== 'string' || text === '') return 0
  const n = text.split('\n').length
  return text.endsWith('\n') ? n - 1 : n
}

/**
 * Line delta of one replacement: lines shared at the start and end of the
 * old and new text are context, the rest counts as removed / added.
 * @returns {{ added: number, removed: number }}
 */
export function lineDelta(oldText, newText) {
  const a = typeof oldText === 'string' && oldText !== '' ? oldText.split('\n') : []
  const b = typeof newText === 'string' && newText !== '' ? newText.split('\n') : []
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  return { added: b.length - head - tail, removed: a.length - head - tail }
}

const parseArgs = (raw) => {
  if (raw !== null && typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return {} }
}

/** Plain text of a message content array (text blocks only). */
export function textOf(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.filter((block) => block?.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('')
}

const clip = (text, max) => {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/** Exit code from a job detail (`exit code: 3`) or a tool result marker. */
function exitCodeOf(detail, resultText) {
  const fromDetail = /exit code: (-?\d+)/.exec(detail ?? '')
  if (fromDetail) return Number(fromDetail[1])
  const fromText = /\[exit code: (-?\d+)\]/.exec(resultText ?? '')
  if (fromText) return Number(fromText[1])
  if (/signal:/.test(detail ?? '')) return -1
  return undefined
}

/** One-line description of a tool call for the activity log. */
function describeCall(name, args) {
  switch (name) {
    case 'bash': return `bash: ${clip(args.description || args.command, 100)}`
    case 'edit':
    case 'write':
    case 'read': return `${name} ${args.file_path ?? ''}`
    case 'grep': return `grep ${clip(args.pattern, 60)}`
    case 'glob': return `glob ${clip(args.pattern, 60)}`
    case 'skill': return `skill ${args.name ?? ''}`
    case 'web_search': return `web_search ${clip(Array.isArray(args.queries) ? args.queries.join(' | ') : '', 80)}`
    case 'web_fetch': return `web_fetch ${clip(args.url, 80)}`
    case 'todo_write': return 'todo_write'
    case 'ask_user_question': return `ask_user: ${clip(args.questions?.[0]?.question, 80)}`
    default:
      if (DELEGATION_TOOLS.has(name)) return `${name}: ${clip(args.description || args.name || args.meta?.name || args.prompt, 80)}`
      return name
  }
}

/** Rule-based activity tag of a step (the summarizer refines these). */
export function stepKind(step) {
  if (step.reviews.length > 0) return 'review'
  if (step.tests.length > 0) return 'test'
  if (step.edits.length > 0) return 'implement'
  if (step.asked) return 'discuss'
  if (step.tools.length > 0 && step.tools.every((t) => isResearchTool(t) || t === 'bash' || t === 'skill' || t === 'todo_write')) return 'research'
  if (step.tools.length === 0) return 'discuss'
  return 'other'
}

/**
 * Collect per-turn facts from a session's raw events.
 * @param {any[]} events - raw session events in seq order.
 * @returns {{ cwd: string | undefined, title: string | undefined, model: { provider: string, model: string } | undefined, turns: Turn[], todos: { content: string, status: string }[] }}
 */
export function collect(events) {
  const turns = new Map()
  const callIndex = new Map() // callId → { step, call }
  const jobByCall = new Map() // callId → job detail
  let cwd
  let title
  let model
  let todos = []
  let todosTurn
  let pendingUser = []

  const turnOf = (n) => {
    let turn = turns.get(n)
    if (turn === undefined) {
      turn = { turn: n, start: undefined, end: undefined, outcome: undefined, user: '', assistant: '', steps: new Map() }
      turns.set(n, turn)
    }
    return turn
  }
  const stepOf = (turn, n) => {
    let step = turn.steps.get(n)
    if (step === undefined) {
      step = { step: n, time: undefined, tools: [], calls: [], edits: [], tests: [], reviews: [], asked: false, text: '' }
      turn.steps.set(n, step)
    }
    return step
  }

  let currentTurn
  for (const event of events) {
    const data = event?.data ?? {}
    switch (event?.type) {
      case 'session':
        cwd = event.cwd ?? cwd
        break
      case 'request/header': {
        // The session's own model: the summarizer's default route.
        const config = data.header?.config
        if (typeof config?.provider === 'string' && typeof config?.model === 'string') model = { provider: config.provider, model: config.model }
        break
      }
      case 'session/title':
        if (typeof data.title === 'string') title = data.title
        break
      case 'turn/start': {
        currentTurn = turnOf(data.turn)
        currentTurn.start = event.time
        break
      }
      case 'turn/end': {
        const turn = turnOf(data.turn)
        turn.end = event.time
        turn.outcome = data.reason?.kind ?? 'completed'
        break
      }
      case 'user/message': {
        // Only what the human typed; injected context (memory, runtime, time,
        // skill catalogs, subagent notices) is not the user's request.
        if (data.source?.kind !== 'user') break
        const text = textOf(data.content).trim()
        if (text === '') break
        if (currentTurn !== undefined && currentTurn.end === undefined) {
          currentTurn.user = currentTurn.user === '' ? text : `${currentTurn.user}\n${text}`
        } else {
          pendingUser.push(text)
        }
        break
      }
      case 'assistant/message': {
        const turn = turnOf(data.turn)
        if (pendingUser.length > 0 && turn.user === '') {
          turn.user = pendingUser.join('\n')
          pendingUser = []
        }
        const step = stepOf(turn, data.step)
        step.time ??= event.time
        const text = textOf(data.message?.content).trim()
        if (text !== '') {
          step.text = text
          turn.assistant = text
        }
        break
      }
      case 'tool/call': {
        const turn = turnOf(data.turn)
        const step = stepOf(turn, data.step)
        step.time ??= event.time
        const args = parseArgs(data.arguments)
        const call = { name: data.name, args, label: describeCall(data.name, args), ok: undefined }
        step.tools.push(data.name)
        step.calls.push(call)
        callIndex.set(data.callId, { step, call })
        if (data.name === 'ask_user_question') step.asked = true
        if (data.name === 'todo_write' && Array.isArray(args.todos)) {
          todos = args.todos
          todosTurn = data.turn
        }
        if (data.name === 'skill' && typeof args.name === 'string' && REVIEW_PROMPT.test(args.name)) {
          step.reviews.push({ kind: 'skill', label: args.name })
        }
        if (DELEGATION_TOOLS.has(data.name)) {
          const prompt = `${args.description ?? ''} ${args.prompt ?? ''} ${args.meta?.description ?? ''}`
          if (REVIEW_PROMPT.test(prompt)) step.reviews.push({ kind: data.name, label: clip(args.description || args.name || args.meta?.name || args.prompt, 60) })
        }
        break
      }
      case 'job/settled': {
        const callId = data.toolCall?.callId
        if (callId !== undefined) jobByCall.set(callId, data.detail)
        break
      }
      case 'tool/result': {
        const callId = data.message?.toolCallId
        const hit = callIndex.get(callId)
        if (hit === undefined) break
        const { step, call } = hit
        const isError = data.message?.isError === true
        call.ok = !isError
        const resultText = textOf(data.message?.content)
        if ((call.name === 'edit' || call.name === 'write') && !isError) {
          const meta = data.meta ?? {}
          const path = meta.path ?? call.args.file_path
          if (meta.operation === 'create') {
            step.edits.push({ path, op: 'create', added: lineCount(call.args.content), removed: 0 })
          } else {
            let added = 0
            let removed = 0
            for (const diff of meta.diffs ?? []) {
              const delta = lineDelta(diff.oldText, diff.newText)
              added += delta.added
              removed += delta.removed
            }
            if ((meta.diffs ?? []).length === 0 && call.name === 'edit') {
              const delta = lineDelta(call.args.old_string, call.args.new_string)
              added = delta.added
              removed = delta.removed
            }
            step.edits.push({ path, op: 'update', added, removed })
          }
        }
        if (call.name === 'bash') {
          const command = String(call.args.command ?? '')
          const exit = exitCodeOf(jobByCall.get(callId), resultText)
          call.ok = !isError && (exit === undefined || exit === 0)
          if (TEST_COMMAND.test(command) && !call.args.run_in_background) {
            step.tests.push({ label: clip(call.args.description || command, 80), ok: call.ok, exit: exit ?? (isError ? 1 : 0) })
          }
        }
        break
      }
      default:
        break
    }
  }

  const list = [...turns.values()]
    .filter((turn) => turn.start !== undefined)
    .sort((a, b) => a.turn - b.turn)
    .map((turn) => {
      const steps = [...turn.steps.values()].sort((a, b) => a.step - b.step)
      for (const step of steps) step.kind = stepKind(step)
      return { ...turn, steps }
    })
  return { cwd, title, model, turns: list, todos, todosTurn }
}

/**
 * Compact, model-readable activity log of one turn: one line per step, at
 * most `maxLines` lines (long turns keep their head and tail).
 */
export function activityLog(turn, maxLines = 160) {
  const lines = turn.steps.map((step) => {
    const parts = []
    if (step.calls.length > 0) parts.push(step.calls.map((c) => `${c.label}${c.ok === false ? ' [失败]' : ''}`).join('; '))
    if (step.text !== '' && step.calls.length === 0) parts.push(`回复: ${clip(step.text, 160)}`)
    else if (step.text !== '') parts.push(`说明: ${clip(step.text, 100)}`)
    return `#${step.step} [${step.kind}] ${parts.join(' | ')}`
  })
  if (lines.length <= maxLines) return lines.join('\n')
  const head = Math.floor(maxLines / 2)
  return [...lines.slice(0, head), `… 省略 ${lines.length - maxLines} 步 …`, ...lines.slice(-(maxLines - head))].join('\n')
}

/**
 * @typedef {{ turn: number, start: number, end?: number, outcome?: string, user: string, assistant: string, steps: Step[] }} Turn
 * @typedef {{ step: number, time?: number, kind: string, tools: string[], calls: { name: string, label: string, ok?: boolean }[], edits: { path: string, op: string, added: number, removed: number }[], tests: { label: string, ok: boolean, exit: number }[], reviews: { kind: string, label: string }[], asked: boolean, text: string }} Step
 */
