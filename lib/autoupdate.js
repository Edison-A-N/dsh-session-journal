/**
 * Update a session's journal as soon as one of its turns ends, instead of
 * waiting for someone to open the panel.
 *
 * DSH announces every appended session event on `session/event`. On a
 * `turn/end` this follows that session the way an open panel would: it
 * reads the journal (which queues the finished turn's summary, and once
 * every turn is summarized, the work-item outline), then reads again every
 * `pollMs` while the reader reports work in progress (summaries pending, an
 * outline being computed, or a failed call waiting for its retry).
 *
 * Polling the reader, instead of tracking each job's completion, means a
 * summary that lands mid-outline, a failure and its retry, or several
 * failures at once all converge the same way the panel does.
 *
 * - One read at a time per session. A turn end during a read marks the
 *   follow to read again (after `settleMs`) instead of starting a second one.
 * - A follow stops when nothing is in progress, when nothing has changed for
 *   `maxIdleMs` (a call stuck far beyond its own timeout), or after
 *   `maxFollowMs` in total.
 * - Only the session whose turn ended is touched; idle sessions never are.
 * - Subagent and teammate sessions (`delegationDepth > 0`) are skipped:
 *   their parent session records the delegation.
 * - Language: fixed when a follow starts, so one follow never summarizes in
 *   two languages. It is the language the session was last viewed in, else
 *   the language of its newest cache file, else `defaultLang()` (the
 *   language last viewed anywhere, kept across restarts by the caller).
 * @module dsh-session-journal/autoupdate
 */
import { normalizeLang } from './store.js'

/** A reader result that still has work in progress. */
export const busy = (journal) => (journal?.pending ?? 0) > 0 || journal?.outlining === true || (journal?.retrying ?? 0) > 0

/** What changes when work progresses (a summary lands, an outline lands, a retry is used up). */
const progress = (journal) => JSON.stringify([journal?.pending, journal?.outlining, journal?.retrying, journal?.outlineAt, journal?.summarized?.done, journal?.failedTurns?.length])

/**
 * @param {object} deps
 * @param {(id: string, lang: string, options?: { fresh?: boolean }) => Promise<any>} deps.read - journal reader (webapi.js createJournalReader).
 * @param {(id: string) => Promise<string | undefined>} [deps.storedLang] - language of a session's newest cache file.
 * @param {() => string} [deps.defaultLang] - language for a session with no view and no cache.
 * @param {(lang: string) => void} [deps.onLangViewed] - called when the language last viewed anywhere changes (to persist it).
 * @param {number} [deps.settleMs] - wait after turn/end before reading.
 * @param {number} [deps.pollMs] - interval between reads while work is in progress.
 * @param {number} [deps.maxIdleMs] - stop when nothing has changed for this long.
 * @param {number} [deps.maxFollowMs] - stop after this long in total.
 * @param {() => number} [deps.now]
 * @param {(fn: () => void, ms: number) => unknown} [deps.setTimer]
 * @param {(handle: unknown) => void} [deps.clearTimer]
 * @param {{ warn?: (msg: string) => void }} [deps.logger]
 */
export function createAutoUpdater({
  read,
  storedLang = async () => undefined,
  defaultLang = () => 'zh',
  onLangViewed = () => {},
  settleMs = 1500,
  pollMs = 5000,
  maxIdleMs = 5 * 60_000,
  maxFollowMs = 30 * 60_000,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  logger = console,
}) {
  /** sessionId → { timer, reading, again, lang, started, lastChange, mark } */
  const follows = new Map()
  const lastViewed = new Map() // sessionId → lang, least recently viewed first
  let lastLang
  let disposed = false

  const pickLang = async (id) => {
    const viewed = lastViewed.get(id)
    if (viewed !== undefined) return viewed
    try {
      const stored = await storedLang(id)
      if (stored !== undefined) return normalizeLang(stored)
    } catch {
      // fall through
    }
    return normalizeLang(lastLang ?? defaultLang())
  }

  const arm = (id, follow, ms) => {
    if (follow.timer !== undefined) clearTimer(follow.timer)
    follow.timer = setTimer(() => { follow.timer = undefined; void step(id, follow) }, ms)
  }

  const step = async (id, follow) => {
    if (disposed || follows.get(id) !== follow) return
    follow.reading = true
    follow.again = false
    let journal
    try {
      follow.lang ??= await pickLang(id)
      journal = await read(id, follow.lang, { fresh: true })
    } catch (error) {
      logger.warn?.(`session-journal: background update of ${id} failed: ${error?.message ?? error}`)
    }
    follow.reading = false
    if (disposed || follows.get(id) !== follow) return
    // A turn ended while we read: read again once it has settled.
    if (follow.again) return arm(id, follow, settleMs)
    const t = now()
    const mark = progress(journal)
    if (mark !== follow.mark) {
      follow.mark = mark
      follow.lastChange = t
    }
    if (busy(journal) && t - follow.lastChange < maxIdleMs && t - follow.started < maxFollowMs) arm(id, follow, pollMs)
    else follows.delete(id)
  }

  return {
    /** Record the language a panel read a session in (called for every panel request). */
    noteView(id, lang) {
      const l = normalizeLang(lang)
      if (l !== lastLang) {
        lastLang = l
        try { onLangViewed(l) } catch { /* persisting is best effort */ }
      }
      lastViewed.delete(id)
      lastViewed.set(id, l)
      // Bound memory: forget the least recently viewed sessions past a few hundred.
      if (lastViewed.size > 500) lastViewed.delete(lastViewed.keys().next().value)
    },
    /**
     * `session/event` listener.
     * @param {{ id: string, header?: { delegationDepth?: number } }} session
     * @param {{ type: string }} event
     */
    onSessionEvent(session, event) {
      if (disposed || event?.type !== 'turn/end') return
      if ((session?.header?.delegationDepth ?? 0) > 0) return
      const id = session?.id
      if (typeof id !== 'string') return
      let follow = follows.get(id)
      const t = now()
      if (follow === undefined) {
        follow = { timer: undefined, reading: false, again: false, lang: undefined, started: t, lastChange: t, mark: undefined }
        follows.set(id, follow)
      }
      follow.lastChange = t
      if (follow.reading) follow.again = true
      else arm(id, follow, settleMs)
    },
    /** Sessions being followed (tests and diagnostics). */
    following: () => [...follows.keys()],
    dispose() {
      disposed = true
      for (const follow of follows.values()) if (follow.timer !== undefined) clearTimer(follow.timer)
      follows.clear()
    },
  }
}
