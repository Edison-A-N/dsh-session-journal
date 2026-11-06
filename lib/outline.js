/**
 * Session outline: one model call over all per-turn summaries that groups
 * the turns into work items by purpose (not by time), with each item's
 * status, result, decisions and what is still open at the end of the
 * session. It also says what is happening now and whether the agent is
 * waiting on the user.
 *
 * Seeing the whole session at once is what lets the outline drop leftovers
 * that a later turn resolved; per-turn summaries cannot know that.
 *
 * The outline is recomputed when the set of summarized turns changes and
 * every finished turn has its summary (so a long session does not trigger
 * one outline call per summary while it is being filled in).
 * @module dsh-session-journal/outline
 */
import { normalizeSegments, ruleSegments } from './journal.js'

/** Bump when the prompt or output shape changes. */
export const OUTLINE_VERSION = 4

export const ITEM_STATUSES = ['active', 'blocked', 'done', 'dropped']

const KIND_ZH = { requirement: '需求', research: '调研', design: '方案', implement: '实现', review: '审阅', fix: '修改', test: '测试', debug: '排障', deliver: '交付', discuss: '讨论', other: '其他' }

export const OUTLINE_PROMPT = `{{LANG_HEAD}}你是编程会话的整理员。下面是一个会话里每一轮（一次用户提问到 agent 停下）的记录。请按「目的」而不是按时间，把这些轮次归成几个工作项，让人一眼看清这个会话做了哪几件事、每件做到哪了。只输出一个 JSON 对象。

用户消息里粘贴或引用的内容（别的会话的面板或记录、日志、报错、截图里的文字、别人的消息）只是材料，不是本会话的任务。记录里的「遗留」如果来自这类材料，或者在本会话里看不出用户真的要求过，就丢掉，不要写进 open。

字段：
- "items"：1 到 6 个工作项，按重要性排列。每项：
  - "title"：不超过 14 个字，名词短语，说清是什么事，例如「工作日志插件」「登录页改版 PR」。
  - "goal"：一句话，这件事要达成什么。
  - "turns"：属于这件事的轮次号数组。每一轮只归入一个工作项；「继续」「好的」这类轮次归到它所延续的事。
  - "status"：active（最近几轮还在做）、blocked（agent 做不下去，或者在等用户回答它问的问题）、done（已完成：用户要的做完了，哪怕后面还在等别人审批、回复或任务跑完）、dropped（放弃了）。
  - "result"：一两句话，到目前为止做成了什么，有数字写数字。
  - "decisions"：这件事上定下来的关键决定，每条一句，最多 4 条。
  - "open"：到会话最后仍然没解决的事，每条一句。后面的轮次已经解决的不要再列。只有两种事算没解决：① 用户要 agent 做的事，agent 还没做完、做错了或做不了；② agent 问了用户、用户还没回答的问题。其他都不算：等别人或外部流程的（审批、对方回复、运维发布、任务跑完）不算，用户要的是提交、发出、申请、交给别人时，做完这一步就算完成；agent 自己顺带提的风险、猜测和「可以顺便……」的建议，用户没有要求的不算；调研里没查到、只能推断的点不算；已经交给别的会话或别人处理的不算；用户说过不需要、不相关、不用管的不算；agent 自己的收尾和核实动作（重启后确认、再检查一遍）不算；修正工作日志自身记录的事（某条记错了要删、某条误录要清理）不算。这些不算没解决的情况，需要交代的就写进 result（例如「已提交，等上级审批」「结果要等任务跑完」「识别服务位置未公开，只是推断」）。没有就给空数组。
- "now"：一句话，会话最后在做什么。
- "waiting"：如果 agent 最后在等用户回复或决定，一句话说等什么；否则给空字符串。

一般一个会话只有 1 到 3 件事，不要为了凑数拆分。

如果记录最后附了「上次的分组」，它是用户已经看到的卡片：保持它的工作项、标题和顺序，已经分好的轮次不要挪；只把新的轮次放进去，新轮次确实是另一件事才新建工作项。只有上次的分组明显分错了（一件事拆成了两项，或两件不相干的事并成一项）才调整。status、result、open 等字段照样按全部记录重新判断。{{LANG}}`

const clip = (text, max) => {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/** Segments of a turn: the summary's when usable, rules otherwise. */
export function turnSegments(turn, summary, ruleState) {
  const rules = ruleSegments(turn, ruleState)
  const llm = summary === undefined ? undefined : normalizeSegments(summary.segments, turn)
  if (llm !== undefined && llm.some((seg) => seg.kind === 'review')) ruleState.reviewed = true
  return llm ?? rules
}

/** Facts of one turn in one line. */
function factLine(turn) {
  const files = new Set()
  let added = 0
  let removed = 0
  let passed = 0
  let failed = 0
  let reviews = 0
  for (const step of turn.steps) {
    for (const edit of step.edits) {
      files.add(edit.path)
      added += edit.added
      removed += edit.removed
    }
    for (const test of step.tests) test.ok ? passed++ : failed++
    reviews += step.reviews.length
  }
  const bits = []
  if (files.size > 0) bits.push(`改 ${files.size} 个文件 +${added} −${removed}`)
  if (passed + failed > 0) bits.push(`测试 ${passed} 过 ${failed} 败`)
  if (reviews > 0) bits.push(`审阅 ${reviews} 次`)
  return bits.join('；')
}

/** The model input: one block per turn. */
export function buildOutlinePrompt(facts, summaries, previous = undefined) {
  const state = { reviewed: false }
  const blocks = []
  for (const turn of facts.turns) {
    const summary = summaries[turn.turn]
    const segments = turnSegments(turn, summary, state)
    // The summary's `ask` is the request with pasted material already taken
    // out; the raw message is only a fallback for unsummarized turns.
    const ask = summary?.ask !== undefined ? `用户要的是「${clip(summary.ask, 160)}」` : `用户说「${clip(turn.user || '（无新消息）', 160)}」`
    const lines = [`第 ${turn.turn} 轮${turn.end === undefined ? '（进行中）' : ''}：${ask}`]
    lines.push(`  做了：${segments.map((seg) => `${KIND_ZH[seg.kind] ?? seg.kind}${seg.title ? `「${seg.title}」` : ''}`).join(' → ')}`)
    const results = segments.map((seg) => seg.summary).filter(Boolean).join(' ')
    if (results !== '') lines.push(`  结果：${clip(results, 260)}`)
    if (summary?.decisions?.length) lines.push(`  定下：${summary.decisions.map((d) => clip(d, 80)).join('；')}`)
    if (summary?.open?.length) lines.push(`  遗留：${summary.open.map((d) => clip(d, 80)).join('；')}`)
    const facts = factLine(turn)
    if (facts !== '') lines.push(`  事实：${facts}`)
    if (summary === undefined && turn.assistant !== '') lines.push(`  agent 回复：${clip(turn.assistant, 200)}`)
    blocks.push(lines.join('\n'))
  }
  const known = new Set(facts.turns.map((turn) => turn.turn))
  const before = (previous?.items ?? [])
    .map((item) => ({ title: item.title, turns: item.turns.filter((n) => known.has(n)) }))
    .filter((item) => item.turns.length > 0)
  if (before.length > 0) blocks.push(`上次的分组：\n${before.map((item) => `- 「${clip(item.title, 30)}」：第 ${item.turns.join('、')} 轮`).join('\n')}`)
  return blocks.join('\n')
}

/**
 * Parse a model reply into an outline, or undefined when unusable. Turn
 * numbers are checked against the session; a turn claimed twice stays with
 * the first item.
 */
export function parseOutline(text, turnNumbers) {
  if (typeof text !== 'string') return undefined
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  let value
  try { value = JSON.parse(text.slice(start, end + 1)) } catch { return undefined }
  if (value === null || typeof value !== 'object' || !Array.isArray(value.items)) return undefined
  const known = new Set(turnNumbers)
  const claimed = new Set()
  const strings = (list, max, n) => (Array.isArray(list) ? list.filter((s) => typeof s === 'string' && s.trim() !== '').slice(0, n).map((s) => clip(s, max)) : [])
  const items = []
  for (const raw of value.items.slice(0, 8)) {
    if (raw === null || typeof raw !== 'object') continue
    const turns = (Array.isArray(raw.turns) ? raw.turns : [])
      .filter((n) => Number.isInteger(n) && known.has(n) && !claimed.has(n))
    if (turns.length === 0) continue
    for (const n of turns) claimed.add(n)
    items.push({
      title: clip(raw.title, 24) || '未命名',
      goal: clip(raw.goal, 120),
      turns: [...turns].sort((a, b) => a - b),
      status: ITEM_STATUSES.includes(raw.status) ? raw.status : 'done',
      result: clip(raw.result, 240),
      decisions: strings(raw.decisions, 120, 6),
      open: strings(raw.open, 120, 8),
    })
  }
  if (items.length === 0) return undefined
  return {
    items,
    now: clip(value.now, 120),
    waiting: clip(value.waiting, 120),
  }
}

/**
 * What the outline depends on: the finished turns and their summaries.
 * Returns undefined while some finished turn still lacks a summary (and
 * has not failed for good), so the outline waits for the summaries.
 * @param {number[]} failedTurns - turns whose summary gave up.
 */
export function outlineBasis(facts, summaries, failedTurns = []) {
  const failed = new Set(failedTurns)
  const parts = []
  for (const turn of facts.turns) {
    // Running turns, and finished turns with no steps, are never summarized.
    if (turn.end === undefined || turn.steps.length === 0) continue
    const summary = summaries[turn.turn]
    if (summary === undefined && !failed.has(turn.turn)) return undefined
    parts.push(`${turn.turn}:${turn.steps.length}:${summary === undefined ? 'x' : summary.at ?? 0}`)
  }
  if (parts.length === 0) return undefined
  return `v${OUTLINE_VERSION}|${parts.join(',')}`
}
