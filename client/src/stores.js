/**
 * Shared browser state.
 *
 * - i18n: `t` (UI copy, follows DSH's language setting through
 *   `ctx.locale`) and `useUiLocale` (re-render on language change).
 * - Summary language: a per-browser preference in localStorage, `auto`
 *   (same as the UI), `zh` or `en`; `useSummaryLang` resolves it.
 * - Journal data: one fetch per (session, summary language), deduplicated
 *   across the sidebar tab and the header chip, polled while someone is
 *   watching. Polling is fast (4s) while the session runs or summaries are
 *   pending, slow (20s) otherwise, and stops when the page is hidden.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { en, NS, zh } from './locales.js'

export const API = '/plugins/session-journal/api'

const FAST_MS = 4000
const SLOW_MS = 20000

// ---------------------------------------------------------------- i18n

let locale // ctx.locale, installed by index.js
let bound // ctx.locale.bind(NS)

/** Install the DSH locale service (or clear it on unmount). */
export function setLocale(service) {
  locale = service
  bound = service?.bind(NS)
}

const fill = (text, vars) => (vars === undefined ? text : text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k]))))

/** Active UI language id ('zh', 'en', 'ja', …). */
export function uiLang() {
  return locale?.getLocale?.().active ?? (typeof navigator !== 'undefined' && /^zh/i.test(navigator.language) ? 'zh' : 'en')
}

/** Translate one key. Falls back to the bundled zh/en dictionaries when the locale service is not up yet. */
export function t(key, vars) {
  if (bound !== undefined) return bound(key, vars)
  const dict = uiLang().startsWith('zh') ? zh : en
  return fill(dict[key] ?? en[key] ?? key, vars)
}

/** Re-render when the UI language changes. */
export function useUiLocale() {
  return useSyncExternalStore(
    (fn) => locale?.subscribe?.(fn) ?? (() => {}),
    () => uiLang(),
  )
}

// ------------------------------------------------------ summary language

const LANG_KEY = 'dsh-session-journal:summary-lang'
const langListeners = new Set()

/** Stored summary-language choice: 'auto' | 'zh' | 'en'. */
export function summaryLangPref() {
  try {
    const v = localStorage.getItem(LANG_KEY)
    return v === 'zh' || v === 'en' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export function setSummaryLangPref(value) {
  try {
    if (value === 'auto') localStorage.removeItem(LANG_KEY)
    else localStorage.setItem(LANG_KEY, value)
  } catch {}
  for (const fn of langListeners) fn()
}

/** The summary language to request: the choice, or the UI language for 'auto' (Chinese for zh*, English otherwise). */
export function resolveSummaryLang(pref, ui) {
  if (pref === 'zh' || pref === 'en') return pref
  return String(ui).startsWith('zh') ? 'zh' : 'en'
}

/** `{ pref, lang }` for the current browser; re-renders on change. */
export function useSummaryLang() {
  const ui = useUiLocale()
  const pref = useSyncExternalStore(
    (fn) => {
      langListeners.add(fn)
      const onStorage = (e) => { if (e.key === LANG_KEY) fn() }
      window.addEventListener('storage', onStorage)
      return () => {
        langListeners.delete(fn)
        window.removeEventListener('storage', onStorage)
      }
    },
    summaryLangPref,
  )
  return { pref, lang: resolveSummaryLang(pref, ui) }
}

// ---------------------------------------------------------- journal data

/** `${sessionId}|${lang}` → { snapshot, watchers, timer, inflight, listeners } */
const entries = new Map()

const keyOf = (id, lang) => `${id}|${lang}`

function entryFor(id, lang) {
  const key = keyOf(id, lang)
  let entry = entries.get(key)
  if (entry === undefined) {
    entry = { id, lang, snapshot: { value: undefined, error: undefined, loading: false }, watchers: 0, timer: undefined, inflight: undefined, listeners: new Set() }
    entries.set(key, entry)
  }
  return entry
}

function emit(entry, patch) {
  entry.snapshot = { ...entry.snapshot, ...patch }
  for (const listener of entry.listeners) listener()
}

/** Fetch now (deduplicated while a request is in flight). `lang` defaults to the current summary language. */
export function refresh(id, lang = resolveSummaryLang(summaryLangPref(), uiLang())) {
  const entry = entryFor(id, lang)
  if (entry.inflight !== undefined) return entry.inflight
  emit(entry, { loading: true })
  entry.inflight = fetch(`${API}/journal?session=${encodeURIComponent(id)}&lang=${lang}`, { credentials: 'same-origin' })
    .then(async (res) => {
      if (!res.ok) throw new Error(res.status === 404 ? t('error.notFound') : t('error.load', { status: res.status }))
      emit(entry, { value: await res.json(), error: undefined, loading: false })
    })
    .catch((error) => emit(entry, { error: String(error?.message ?? error), loading: false }))
    .finally(() => {
      entry.inflight = undefined
      schedule(entry)
    })
  return entry.inflight
}

function schedule(entry) {
  clearTimeout(entry.timer)
  entry.timer = undefined
  if (entry.watchers === 0) return
  const value = entry.snapshot.value
  const busy = value === undefined || value.running || value.pending > 0 || value.outlining
  entry.timer = setTimeout(() => {
    if (document.visibilityState === 'hidden') schedule(entry)
    else void refresh(entry.id, entry.lang)
  }, busy ? FAST_MS : SLOW_MS)
}

/** Subscribe a component to one session's journal in the current summary language; polls while mounted. */
export function useJournal(id) {
  const { lang } = useSummaryLang()
  const entry = id === undefined ? undefined : entryFor(id, lang)
  const snapshot = useSyncExternalStore(
    (listener) => {
      if (entry === undefined) return () => {}
      entry.listeners.add(listener)
      return () => entry.listeners.delete(listener)
    },
    () => entry?.snapshot ?? EMPTY,
  )
  useEffect(() => {
    if (id === undefined) return undefined
    const e = entryFor(id, lang)
    e.watchers++
    if (e.snapshot.value === undefined && e.inflight === undefined) void refresh(id, lang)
    else schedule(e)
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(id, lang) }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      e.watchers--
      if (e.watchers === 0) {
        clearTimeout(e.timer)
        e.timer = undefined
      }
    }
  }, [id, lang])
  return snapshot
}

const EMPTY = Object.freeze({ value: undefined, error: undefined, loading: false })

// -------------------------------------------------------------- display

/** Display name of a phase kind in the UI language. */
export const kindLabel = (kind) => t(`kind.${kind}`)

/** "审阅 #2" / "Review #2" */
export function phaseName(kind, round) {
  const label = kindLabel(kind)
  return round === undefined ? label : `${label} #${round}`
}

/** "2h14m", "35m", "40s" */
export function duration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return ''
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h${String(m % 60).padStart(2, '0')}m`
}

/** "08:33" today, "11-02 08:33" otherwise. */
export function clock(ms) {
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return hm
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${hm}`
}
