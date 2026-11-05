/**
 * Browser API, behind the same login fence as every other page
 * (`ctx.connection.authorizeIndex`):
 *
 * - `GET /plugins/session-journal/api/journal?session=<id>&lang=zh|en` →
 *   the journal (journal.js `buildJournal`) plus `pending` (turns still
 *   being summarized), `outlining` (the work-item outline is being redone),
 *   `retrying` (failed calls waiting for another attempt), `failedTurns`
 *   (turns whose summary gave up) and `summarizer` (`on` | `off`). `lang` picks the summary language;
 *   each language has its own cache, so switching back costs nothing.
 *
 * Reading a journal queues summaries for finished turns that lack one and,
 * once they are all in, a new outline when the summaries changed; the
 * browser polls and sees them fill in.
 * @module dsh-session-journal/webapi
 */
import { collect } from './collector.js'
import { buildJournal } from './journal.js'
import { OUTLINE_VERSION, outlineBasis } from './outline.js'
import { normalizeLang, validSessionId } from './store.js'

export const API_PREFIX = '/plugins/session-journal/api'

/** How long one collected event log is reused before re-reading. */
export const FACTS_TTL_MS = 3000

function sendJson(res, code, value) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(value))
}

/**
 * Journal reader shared by the route and tests.
 * @param {{ readEvents: (id: string) => Promise<any[]>, store: any, summarizer?: any, now?: () => number }} deps
 */
export function createJournalReader({ readEvents, store, summarizer, now = Date.now }) {
  const facts = new Map() // id → { at, promise }
  const collectFor = (id, fresh) => {
    const hit = facts.get(id)
    if (!fresh && hit !== undefined && now() - hit.at < FACTS_TTL_MS) return hit.promise
    const promise = readEvents(id).then((events) => collect(events))
    facts.set(id, { at: now(), promise })
    promise.catch(() => facts.delete(id))
    // Keep the cache bounded: drop entries older than a minute.
    if (facts.size > 50) for (const [key, value] of facts) if (now() - value.at > 60_000) facts.delete(key)
    return promise
  }
  /** @param {{ fresh?: boolean }} [options] - fresh: skip the short facts cache (background updates). */
  return async (id, requestedLang, options = {}) => {
    const lang = normalizeLang(requestedLang)
    const collected = await collectFor(id, options.fresh === true)
    const summaries = await store.get(id, lang)
    const cachedOutline = await store.getOutline?.(id, lang)
    const outline = cachedOutline?.version === OUTLINE_VERSION ? cachedOutline : undefined
    const pending = summarizer === undefined ? 0 : summarizer.enqueue(id, collected.turns, summaries, lang, collected.model)
    const failedTurns = summarizer?.failedTurns(id, lang) ?? []
    const outlining = summarizer === undefined
      ? false
      : summarizer.enqueueOutline(id, collected, summaries, outline, outlineBasis(collected, summaries, failedTurns), lang, collected.model)
    const journal = buildJournal(collected, summaries, { sessionId: id, outline })
    return {
      ...journal,
      lang,
      pending,
      outlining,
      outlineAt: outline?.at,
      failedTurns,
      retrying: summarizer?.retrying?.(id, lang) ?? 0,
      summarizer: summarizer === undefined ? 'off' : 'on',
    }
  }
}

/**
 * Request handler (exported for tests; `authorize` is the login fence).
 * @param {{ read: (id: string) => Promise<object>, authorize: (req: any, res: any) => boolean }} deps
 */
export function createHandler({ read, authorize }) {
  return async (req, res) => {
    try {
      if (!authorize(req, res)) return
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (url.pathname !== `${API_PREFIX}/journal`) {
        sendJson(res, 404, { error: 'not found' })
        return
      }
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'method not allowed' })
        return
      }
      const id = url.searchParams.get('session')
      if (!validSessionId(id)) {
        sendJson(res, 400, { error: 'session query parameter is required' })
        return
      }
      sendJson(res, 200, await read(id, url.searchParams.get('lang') ?? undefined))
    } catch (error) {
      const missing = /not found|unknown session|ENOENT/i.test(String(error?.message ?? error)) || error?.code === 'session-query/not-found'
      if (!res.headersSent) sendJson(res, missing ? 404 : 500, { error: missing ? 'session not found' : 'session journal error' })
      if (!missing) console.warn(`session-journal web handler: ${error?.message ?? error}`)
    }
  }
}
