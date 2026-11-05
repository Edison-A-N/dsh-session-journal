/**
 * dsh-session-journal — a per-session work journal for the DeepSeek Harness
 * Web GUI.
 *
 * Node half: reads a session's append-only event log (through the
 * sessionQuery service, so compacted history is still visible), extracts
 * facts per turn (collector.js), asks a small model to label each finished
 * turn's phases once (summarizer.js, cached by store.js), and serves the
 * folded journal through a login-fenced API (webapi.js).
 *
 * Browser half (`./client`): a right-sidebar tab with the overview, the
 * phase timeline with numbered rounds, changed files and open items, plus a
 * session-header chip showing the current phase.
 *
 * Updates: when a top-level session's turn ends, its journal is updated in
 * the background (autoupdate.js), so the panel is current when opened.
 *
 * Summarizer model: by default each session is summarized with that
 * session's own provider and model (from its request header). Set
 * SESSION_JOURNAL_PROVIDER + SESSION_JOURNAL_MODEL in the launch environment
 * to use one fixed (usually smaller, cheaper) model for every session, and
 * SESSION_JOURNAL_EFFORT for its reasoning effort (default `low`; `default`
 * leaves it to the route). SESSION_JOURNAL_MODEL=off runs on rules only.
 * @module dsh-session-journal
 */
import { join } from 'node:path'
import { createAutoUpdater } from './autoupdate.js'
import { createSummaryStore, dshHome } from './store.js'
import { createSummarizer } from './summarizer.js'
import { API_PREFIX, createHandler, createJournalReader } from './webapi.js'

export const name = 'session-journal'
export const inject = ['webServer', 'connection', 'llm']
export const Config = undefined

export { collect, activityLog } from './collector.js'
export { buildJournal } from './journal.js'

const DEFAULTS = { effort: 'low', maxTokens: 2000, timeoutMs: 90_000 }

/**
 * The summarizer route for one call: the configured override when both
 * provider and model are set, else the session's own route, else none.
 * @param {{ provider?: string, model?: string }} override
 * @param {{ provider: string, model: string } | undefined} session
 */
export function pickRoute(override, session) {
  if (override.provider !== undefined && override.model !== undefined) return { provider: override.provider, model: override.model }
  return session
}

/**
 * Collect the text of a dsh-llm stream (text-delta chunks only; reasoning
 * is dropped). Error and abort finishes throw.
 * @param {AsyncIterable<any>} stream
 */
export async function streamText(stream) {
  let text = ''
  let finish
  for await (const chunk of stream) {
    if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text
    else if (chunk?.type === 'finish') finish = chunk.reason
  }
  if (finish?.kind === 'error' || finish?.kind === 'aborted') throw new Error(finish.failure?.message ?? finish.kind)
  if (text.trim() === '') throw new Error('summary call produced no text')
  return text
}

/** @param {any} ctx */
export function apply(ctx) {
  const env = ctx.get('launchEnvironment')
  const envValue = (key) => {
    const value = env?.get?.(key)?.value ?? process.env[key]
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
  }
  const override = { provider: envValue('SESSION_JOURNAL_PROVIDER'), model: envValue('SESSION_JOURNAL_MODEL') }
  const effort = envValue('SESSION_JOURNAL_EFFORT') ?? DEFAULTS.effort
  const store = createSummaryStore(join(dshHome(), 'storages', 'session-journal'))

  let updater
  let summarizer
  if (override.model !== 'off') {
    const complete = async (system, user, callOptions = {}) => {
      const route = pickRoute(override, callOptions.route)
      if (route === undefined) throw new Error('no model to summarize with: the session has not made a request yet and SESSION_JOURNAL_PROVIDER/MODEL are not set')
      const timeout = AbortSignal.timeout(DEFAULTS.timeoutMs)
      const signal = callOptions.signal === undefined ? timeout : AbortSignal.any([timeout, callOptions.signal])
      const options = {
        provider: route.provider,
        model: route.model,
        system,
        messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
        maxTokens: callOptions.maxTokens ?? DEFAULTS.maxTokens,
        ...(effort === 'default' ? {} : { reasoningEffort: effort }),
        // Not conversation traffic; the closest auxiliary purpose dsh-llm knows.
        purpose: 'compaction',
        signal,
      }
      return streamText(ctx.llm.stream(options))
    }
    summarizer = createSummarizer({ complete, store, logger: ctx.logger ?? console })
    const which = override.provider !== undefined && override.model !== undefined ? `${override.provider}/${override.model}` : "each session's own model"
    ctx.logger?.info?.(`session-journal: summarizer uses ${which}`)
  }

  // sessionQuery is provided by a fiber that may activate after this one;
  // capture it through a runtime inject.
  let sessionQuery
  ctx.inject(['sessionQuery'], (queryCtx) => {
    sessionQuery = queryCtx.sessionQuery
    return () => { sessionQuery = undefined }
  })
  const readEvents = async (id) => {
    if (sessionQuery === undefined) throw new Error('session query service unavailable')
    const log = await sessionQuery.readSession(id)
    return [{ type: 'session', ...log.session }, ...log.events]
  }
  const read = createJournalReader({ readEvents, store, summarizer })

  // Keep journals current without waiting for the panel: when a turn ends,
  // follow that session until its summaries and outline are done
  // (autoupdate.js).
  if (summarizer !== undefined) {
    let savedLang = 'zh'
    void store.lastViewedLang().then((lang) => { if (lang !== undefined) savedLang = lang })
    updater = createAutoUpdater({
      read,
      storedLang: (id) => store.latestLang(id),
      defaultLang: () => savedLang,
      onLangViewed: (lang) => {
        savedLang = lang
        store.setLastViewedLang(lang).catch((error) => ctx.logger?.warn?.(`session-journal: saving the summary language failed: ${error?.message ?? error}`))
      },
      logger: ctx.logger ?? console,
    })
    ctx.on('session/event', (session, event) => updater.onSessionEvent(session, event))
    // Timers and queued model calls are not fiber-owned: stop them when this
    // plugin is unloaded or replaced, so an old copy never keeps writing.
    ctx.effect(() => () => { updater.dispose(); summarizer.dispose() }, 'session-journal: background work')
  }
  const panelRead = (id, lang) => {
    updater?.noteView(id, lang)
    return read(id, lang)
  }

  return ctx.webServer.register({
    kind: 'prefix',
    path: API_PREFIX,
    handler: createHandler({ read: panelRead, authorize: (req, res) => ctx.connection.authorizeIndex(req, res) }),
  })
}
