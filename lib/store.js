/**
 * Summary cache: one JSON file per session under
 * `$DSH_HOME/storages/session-journal/`, mapping turn number → summary,
 * plus the session outline under the key `outline`.
 * Writes for one session are serialized and atomic (temp file + rename),
 * so concurrent summary jobs never lose each other's rows.
 * @module dsh-session-journal/store
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Resolve the dsh home directory: $DSH_HOME wins, ~/.dsh otherwise. */
export function dshHome(env = process.env) {
  return env.DSH_HOME && env.DSH_HOME.trim() !== '' ? env.DSH_HOME : join(homedir(), '.dsh')
}

/** Session ids that may name a file (no separators, no dots at the start). */
export function validSessionId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)
}

/** Summary languages. Chinese keeps the original file name, so caches from before languages existed stay valid. */
export const LANGS = ['zh', 'en']

/** Normalize a requested summary language; anything unknown is Chinese. */
export function normalizeLang(lang) {
  return LANGS.includes(lang) ? lang : 'zh'
}

/** @param {string} dir */
export function createSummaryStore(dir) {
  const cache = new Map() // `${sessionId}:${lang}` → Promise<Record<number, object>>
  const chains = new Map() // same key → Promise (write queue)
  const file = (id, lang) => join(dir, lang === 'zh' ? `${id}.json` : `${id}.${lang}.json`)

  const load = (id, lang) => {
    const key = `${id}:${lang}`
    let entry = cache.get(key)
    if (entry === undefined) {
      entry = readFile(file(id, lang), 'utf8')
        .then((text) => {
          const value = JSON.parse(text)
          return value !== null && typeof value === 'object' ? value : {}
        })
        .catch(() => ({}))
      cache.set(key, entry)
    }
    return entry
  }

  return {
    /** All cached turn summaries of a session in one language, by turn (the outline row excluded). */
    async get(id, lang = 'zh') {
      if (!validSessionId(id)) return {}
      const { outline: _outline, ...rows } = await load(id, normalizeLang(lang))
      return rows
    },
    /** The cached session outline in one language, if any. */
    async getOutline(id, lang = 'zh') {
      if (!validSessionId(id)) return undefined
      return (await load(id, normalizeLang(lang))).outline
    },
    /** Store one turn's summary, or the outline under the key `outline`. */
    put(id, turn, summary, lang = 'zh') {
      if (!validSessionId(id)) return Promise.reject(new Error('invalid session id'))
      const l = normalizeLang(lang)
      const key = `${id}:${l}`
      const prev = chains.get(key) ?? Promise.resolve()
      const next = prev.catch(() => {}).then(async () => {
        const rows = await load(id, l)
        rows[turn] = summary
        await mkdir(dir, { recursive: true })
        const tmp = `${file(id, l)}.${process.pid}.tmp`
        await writeFile(tmp, JSON.stringify(rows), { mode: 0o600 })
        await rename(tmp, file(id, l))
      })
      chains.set(key, next)
      return next
    },
  }
}
