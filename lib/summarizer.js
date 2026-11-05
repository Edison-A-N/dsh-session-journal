/**
 * Per-turn summaries from a small model: for one finished turn, which
 * phases it went through (from a fixed kind list, mapped onto step
 * ranges), a short title and summary per phase, the decisions made, and
 * what was left open. Results are cached per turn (store.js), so each turn
 * is summarized once.
 *
 * Summaries are computed lazily: the first time the panel asks for a
 * session, missing turns are queued here (at most `concurrency` calls at a
 * time per process) and the panel picks them up on its next poll. No call
 * goes into the main conversation, so the main session's context and KV
 * cache are untouched.
 * @module dsh-session-journal/summarizer
 */
import { activityLog } from './collector.js'
import { PHASE_KINDS, ruleSegments } from './journal.js'
import { buildOutlinePrompt, OUTLINE_PROMPT, OUTLINE_VERSION, parseOutline } from './outline.js'

/** Bump when the prompt or output shape changes: old cache rows are redone. */
export const SUMMARY_VERSION = 3

/**
 * Shared rule: pasted material is not a request. Users paste other
 * sessions' panels, logs and messages as evidence, often without quotes;
 * the summary must first separate them from the actual ask, and must not
 * turn the questions inside them into this session's open items.
 */
export const PASTED_RULE = `用户消息里常混有粘贴进来的材料：别的会话的面板或标题、日志、报错、截图里的文字、别人的消息。这些材料没有引号，要靠内容判断，常见特征是带有「已完成」「第 1 轮」「▾」这类界面文字，或者话题和本会话前后几轮不连贯。
判断方法：看 agent 这一轮实际回应了什么。agent 没有去回答、也没有去做的那部分，通常就是材料。
材料里出现的问题、任务、待办，都不是用户在本会话提出的：不要写进 summary 当成用户的请求，也不要列进 open。拿不准时，宁可不列。`

export const SYSTEM_PROMPT = `{{LANG_HEAD}}你是编程会话的记录员。用户和编程 agent 在一个会话里多轮协作，你只看其中一轮（一次用户提问到 agent 停下），把这一轮做了什么整理成结构化记录。只输出一个 JSON 对象，不要输出别的文字。

${PASTED_RULE}

JSON 字段：
- "ask"：先写这个字段。一句话说清用户这一轮真正要 agent 做什么，粘贴的材料不算。
- "segments"：这一轮按先后分成的阶段，1 到 4 段。每段 {"kind", "from", "to", "title", "summary"}。
  - kind 只能取：requirement（聊需求、澄清要做什么）、research（调研、读代码、查资料）、design（方案设计、讨论怎么做）、implement（写新代码）、review（审阅、评审、挑刺，包括让子 agent 审）、fix（按审阅意见或测试失败修改）、test（跑测试、端到端验证）、debug（排查问题根因）、deliver（提交、发布、部署、交付说明）、discuss（一般问答）、other。
  - from/to 必填，是活动记录里的步号（#N 的 N，整数）。第一段 from 为 1，最后一段 to 为本轮最后一步，各段首尾相接（下一段 from = 上一段 to + 1）。
  - title 很短（中文不超过 12 个字，英文不超过 6 个词），写这一段具体干了什么，例如「加登录限流」，不要写「进行实现」这类空话。
  - summary 一两句话，写结果和结论，有数字写数字。
- "decisions"：这一轮定下来的事（用户拍板的、方案上选定的），每条一句，没有就给空数组。
- "open"：这一轮结束时还没做完或待用户确认的事，每条一句，只能来自 ask 和 agent 的工作，没有就给空数组。agent 自己的收尾和核实动作（重启后确认、再检查一遍）不算；用户说了不需要、不相关、不用管的事不算；修正工作日志自身记录的事（某条记错了要删、某条误录要清理）不算。
- "goal"：只有当这一轮用户提出了新的总体目标时才给，一句话；否则不给这个字段。

输出示例（一轮共 12 步）：
{{EXAMPLE}}

{{LANG}}`

const EXAMPLE = {
  zh: '{"ask":"查一下右栏能不能挂插件，能的话把服务端写出来","segments":[{"kind":"research","from":1,"to":4,"title":"查右栏扩展接口","summary":"确认可以注册右栏标签页类型。"},{"kind":"implement","from":5,"to":12,"title":"写插件服务端","summary":"新增 4 个文件，单测 12 条通过。"}],"decisions":["阶段名由小模型按轮总结"],"open":[]}',
  en: '{"ask":"Check whether the right sidebar can host a plugin, and if so write the server side","segments":[{"kind":"research","from":1,"to":4,"title":"Check sidebar extension API","summary":"Confirmed a plugin can register a sidebar tab type."},{"kind":"implement","from":5,"to":12,"title":"Write plugin server","summary":"Added 4 files; 12 unit tests pass."}],"decisions":["Phase names come from a small model, one call per turn"],"open":[]}',
}

/**
 * The output-language lines of the summary and outline prompts. The
 * instructions stay in Chinese for both (they are tuned in Chinese); only
 * the language of the produced text changes, stated at the top and again
 * at the end so the Chinese instructions do not pull the output back.
 * JSON keys and kind values stay in English either way.
 */
export const LANG_LINE = {
  zh: '用中文，简洁，不要客套。',
  en: 'OUTPUT LANGUAGE: English. Every text value (ask, title, summary, result, goal, decisions, open, now, waiting) must be written in English, short and plain, even though these instructions (and possibly the session) are in Chinese. Keep code names, paths and identifiers as they are. JSON keys and kind/status values stay as specified.',
}

const LANG_HEAD = {
  zh: '',
  en: 'OUTPUT LANGUAGE: English (all text values). The instructions below are in Chinese; follow them, but write the output in English.\n\n',
}

/** A prompt with its language placeholders filled for one language. */
export const withLang = (prompt, lang) => {
  const l = LANG_LINE[lang] === undefined ? 'zh' : lang
  return prompt
    .replace('{{LANG_HEAD}}', LANG_HEAD[l])
    .replace('{{EXAMPLE}}', EXAMPLE[l])
    .replace('{{LANG}}', LANG_LINE[l])
}

const clip = (text, max) => {
  const s = String(text ?? '').trim()
  return s.length > max ? `${s.slice(0, max)}…` : s
}

const KIND_ZH = { requirement: '需求', research: '调研', design: '方案', implement: '实现', review: '审阅', fix: '修改', test: '测试', debug: '排障', deliver: '交付', discuss: '讨论', other: '其他' }

/**
 * User message for one turn.
 * @param {import('./collector.js').Turn} turn
 * @param {{ previous: { turn: number, user: string, kinds: string[] }[] }} context - earlier turns (rule-based kinds).
 */
export function buildPrompt(turn, context) {
  const lines = []
  if (context.previous.length > 0) {
    lines.push('## 之前几轮（供参考，不用总结）')
    for (const p of context.previous) lines.push(`- 第 ${p.turn} 轮：用户说「${clip(p.user, 80)}」；大致是 ${p.kinds.map((k) => KIND_ZH[k] ?? k).join(' → ')}`)
    lines.push('')
  }
  lines.push(`## 本轮（第 ${turn.turn} 轮，共 ${turn.steps.length} 步）`)
  lines.push(`用户：${clip(turn.user || '（没有新的用户消息，可能是继续上一轮或子 agent 回报）', 1500)}`)
  lines.push('')
  lines.push('活动记录（每步一行：#步号 [规则标签] 调用的工具和说明）：')
  lines.push(activityLog(turn))
  lines.push('')
  lines.push(`agent 最后的回复：${clip(turn.assistant, 1500)}`)
  return lines.join('\n')
}

/**
 * Parse a model reply into a summary object, or undefined when it is not
 * usable. Tolerates code fences and text around the JSON object.
 */
export function parseReply(text) {
  if (typeof text !== 'string') return undefined
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  let value
  try { value = JSON.parse(text.slice(start, end + 1)) } catch { return undefined }
  if (value === null || typeof value !== 'object' || !Array.isArray(value.segments)) return undefined
  const strings = (list) => (Array.isArray(list) ? list.filter((s) => typeof s === 'string' && s.trim() !== '').map((s) => s.trim()) : [])
  return {
    segments: value.segments
      .filter((seg) => seg !== null && typeof seg === 'object')
      .map((seg) => ({
        kind: PHASE_KINDS.includes(seg.kind) ? seg.kind : 'other',
        from: Number.isInteger(seg.from) ? seg.from : undefined,
        to: Number.isInteger(seg.to) ? seg.to : undefined,
        title: typeof seg.title === 'string' ? seg.title.trim() : '',
        summary: typeof seg.summary === 'string' ? seg.summary.trim() : '',
      })),
    decisions: strings(value.decisions),
    open: strings(value.open),
    ...(typeof value.ask === 'string' && value.ask.trim() !== '' ? { ask: value.ask.trim() } : {}),
    ...(typeof value.goal === 'string' && value.goal.trim() !== '' ? { goal: value.goal.trim() } : {}),
  }
}

/** Context for a turn: the two turns before it, with rule-based kinds. */
export function contextFor(turns, index) {
  const state = { reviewed: false }
  const kindsByIndex = turns.map((turn) => ruleSegments(turn, state).map((seg) => seg.kind))
  return {
    previous: turns.slice(Math.max(0, index - 2), index).map((turn, i) => ({
      turn: turn.turn,
      user: turn.user,
      kinds: kindsByIndex[Math.max(0, index - 2) + i],
    })),
  }
}

/** Back-off before a failed summary or outline is tried again. */
export const RETRY_MS = 60_000

/**
 * A process-wide queue of summary jobs. `dispose()` drops queued jobs,
 * aborts running calls (through `options.signal`) and stops writing.
 * @param {{ complete: (system: string, user: string, options?: { maxTokens?: number, signal?: AbortSignal }) => Promise<string>, store: ReturnType<typeof import('./store.js').createSummaryStore>, concurrency?: number, logger?: { warn?: Function }, now?: () => number }} deps
 */
export function createSummarizer({ complete, store, concurrency = 3, logger, now = Date.now }) {
  const queued = new Set() // `${sessionId}:${lang}:${turn | 'outline'}`
  const lifetime = new AbortController()
  const failures = new Map() // key → { count, at }
  const waiting = []
  let active = 0

  const pump = () => {
    while (!lifetime.signal.aborted && active < concurrency && waiting.length > 0) {
      const job = waiting.shift()
      active++
      void run(job).finally(() => {
        active--
        queued.delete(job.key)
        pump()
      })
    }
  }

  const run = async ({ key, sessionId, turn, prompt, outline, lang, route }) => {
    try {
      if (outline !== undefined) {
        const reply = await complete(withLang(OUTLINE_PROMPT, lang), outline.prompt, { maxTokens: 4000, route, signal: lifetime.signal })
        const parsed = parseOutline(reply, outline.turnNumbers)
        if (parsed === undefined) throw new Error('unparseable outline reply')
        if (lifetime.signal.aborted) return
        await store.put(sessionId, 'outline', { version: OUTLINE_VERSION, basis: outline.basis, at: Date.now(), ...parsed }, lang)
        failures.delete(key)
        return
      }
      const reply = await complete(withLang(SYSTEM_PROMPT, lang), prompt, { route, signal: lifetime.signal })
      const parsed = parseReply(reply)
      if (parsed === undefined) throw new Error('unparseable summary reply')
      if (lifetime.signal.aborted) return
      await store.put(sessionId, turn.turn, { version: SUMMARY_VERSION, endedAt: turn.end, steps: turn.steps.length, at: Date.now(), ...parsed }, lang)
      failures.delete(key)
    } catch (error) {
      if (lifetime.signal.aborted) return
      const prev = failures.get(key)
      const sameBasis = outline === undefined || prev?.basis === outline.basis
      failures.set(key, { count: (sameBasis ? prev?.count ?? 0 : 0) + 1, at: now(), basis: outline?.basis, error: String(error?.message ?? error) })
      logger?.warn?.(`session-journal: ${outline === undefined ? 'summary' : 'outline'} of ${key} failed: ${error?.message ?? error}`)
    }
  }

  return {
    /** Queue every finished turn whose cached summary (in `lang`) is missing or stale. */
    enqueue(sessionId, turns, cached, lang = 'zh', route = undefined) {
      if (lifetime.signal.aborted) return 0
      let pending = 0
      turns.forEach((turn, index) => {
        if (turn.end === undefined || turn.steps.length === 0) return
        const row = cached[turn.turn]
        if (row !== undefined && row.version === SUMMARY_VERSION && row.steps === turn.steps.length) return
        const key = `${sessionId}:${lang}:${turn.turn}`
        const failed = failures.get(key)
        // Give up after 3 failures; retry no sooner than a minute apart.
        if (failed !== undefined && (failed.count >= 3 || now() - failed.at < RETRY_MS)) return
        pending++
        if (queued.has(key)) return
        queued.add(key)
        waiting.push({ key, sessionId, lang, route, turn, prompt: buildPrompt(turn, contextFor(turns, index)) })
      })
      pump()
      return pending
    },
    /** Turns that failed for good (shown so the panel can say so). */
    failedTurns(sessionId, lang = 'zh') {
      const prefix = `${sessionId}:${lang}:`
      const out = []
      for (const [key, value] of failures) if (key.startsWith(prefix) && value.count >= 3 && key !== `${prefix}outline`) out.push(Number(key.slice(prefix.length)))
      return out
    },
    /**
     * Queue an outline when the summarized turns changed since the cached
     * one. Returns whether an outline is being computed.
     * @param {string} basis - outline.js `outlineBasis`; undefined skips.
     */
    enqueueOutline(sessionId, facts, summaries, cached, basis, lang = 'zh', route = undefined) {
      if (lifetime.signal.aborted) return false
      if (basis === undefined || cached?.basis === basis) return false
      const key = `${sessionId}:${lang}:outline`
      if (queued.has(key)) return true
      const failed = failures.get(key)
      if (failed !== undefined && failed.basis === basis && (failed.count >= 3 || now() - failed.at < RETRY_MS)) return false
      queued.add(key)
      // Outlines go first: they are what the panel shows on top.
      waiting.unshift({ key, sessionId, lang, route, outline: { basis, prompt: buildOutlinePrompt(facts, summaries), turnNumbers: facts.turns.map((t) => t.turn) } })
      pump()
      return true
    },
    /** Failed calls of a session (in `lang`) that will be retried once their back-off ends. */
    retrying(sessionId, lang = 'zh') {
      const prefix = `${sessionId}:${lang}:`
      let n = 0
      for (const [key, value] of failures) if (key.startsWith(prefix) && value.count < 3) n++
      return n
    },
    stats: () => ({ active, waiting: waiting.length }),
    dispose() {
      lifetime.abort()
      waiting.length = 0
      queued.clear()
    },
  }
}
