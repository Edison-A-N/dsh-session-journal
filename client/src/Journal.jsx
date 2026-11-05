/**
 * The sidebar tab body, organized by purpose rather than time:
 *
 * 1. Now: what the session is doing right now and whether the agent is
 *    waiting on the user (the one thing to act on).
 * 2. Work items: one card per thing the session worked on, each with its
 *    status, result, what is still open, and the key decisions. Its phase
 *    timeline and changed files fold inside the card.
 * 3. Footer: summary progress and refresh.
 *
 * Without an outline yet (summaries still coming in, or no model), the
 * whole session is one item and the phases show as before.
 */
import { useEffect, useMemo, useState } from 'react'
import { clock, duration, kindLabel, phaseName, refresh, setSummaryLangPref, t, useJournal, useSummaryLang, useUiLocale } from './stores.js'
import { jumpToTurn } from './jump.js'

/**
 * A turn label that jumps the conversation to that turn. When the chat's
 * turn rail is not on screen (another main view is open) it says so
 * briefly instead of doing nothing.
 */
function JumpLink({ turn, className, children }) {
  const [note, setNote] = useState('')
  useEffect(() => {
    if (note === '') return undefined
    const timer = setTimeout(() => setNote(''), 2500)
    return () => clearTimeout(timer)
  }, [note])
  if (turn === undefined) return <span className={className}>{children}</span>
  const onClick = async (event) => {
    event.stopPropagation()
    const result = await jumpToTurn(turn)
    if (result === 'no-rail') setNote(t('jump.noRail'))
    else if (result === 'no-turn') setNote(t('jump.noTurn'))
  }
  return (
    <span className="dsj-jump-wrap">
      <button type="button" className={`dsj-jump ${className ?? ''}`} onClick={onClick} title={t('jump.title', { n: turn })}>{children}</button>
      {note !== '' && <span className="dsj-jump-note" role="status">{note}</span>}
    </span>
  )
}

const encodeSegment = (s) => encodeURIComponent(s).replace(/%3A/gi, ':')
const encodePath = (p) => p.split('/').map(encodeSegment).join('/')

/**
 * The sidebar resource address of a workspace file (same scheme as the
 * files tab), or undefined outside the workspace: the sidebar's text
 * preview only opens session-scoped addresses.
 */
export function fileAddress(sessionId, cwd, path) {
  const root = (cwd ?? '').replace(/\/+$/, '')
  if (root !== '' && path.startsWith(`${root}/`)) return `dsh-resource://file/session/${encodeSegment(sessionId)}/${encodePath(path.slice(root.length + 1))}`
  return undefined
}

/**
 * Display path: relative inside the workspace; outside it, the last three
 * segments behind "…/" (the full path is in the tooltip).
 */
const relative = (cwd, path) => {
  const root = (cwd ?? '').replace(/\/+$/, '')
  if (root !== '' && path.startsWith(`${root}/`)) return path.slice(root.length + 1)
  const parts = path.split('/').filter(Boolean)
  return parts.length <= 3 ? path : `…/${parts.slice(-3).join('/')}`
}

const STATUS_TONE = { active: 'active', blocked: 'warn', done: 'good', dropped: 'muted' }
const statusOf = (status) => ({ label: t(`status.${STATUS_TONE[status] === undefined ? 'done' : status}`), tone: STATUS_TONE[status] ?? 'good' })

const turnRange = (turns) => {
  if (turns.length === 0) return ''
  const first = turns[0]
  const last = turns.at(-1)
  return first === last ? t('turn.one', { n: first }) : t('turn.range', { from: first, to: last })
}

function Now({ journal }) {
  const { stats, current, running } = journal
  const elapsed = stats.startedAt === undefined ? undefined : (running ? Date.now() : stats.lastAt) - stats.startedAt
  const phase = current === undefined ? undefined : phaseName(current.kind, current.round)
  const waiting = journal.waiting !== '' && !running
  const items = journal.items ?? []
  const openTotal = items.reduce((n, it) => n + it.open.length, 0)
  const decidedTotal = items.reduce((n, it) => n + it.decisions.length, 0)
  return (
    <section className="dsj-now-card" data-running={running ? '' : undefined}>
      <div className="dsj-now-line">
        <span className="dsj-dot" data-running={running ? '' : undefined} />
        <span className="dsj-now-state">{running ? t('now.running') : t('now.stopped')}</span>
        {phase !== undefined && <span className="dsj-now-phase" data-kind={current.kind}>{phase}</span>}
        <span className="dsj-dim dsj-push">{running ? duration(Date.now() - current.since) : clock(stats.lastAt)}</span>
      </div>
      {journal.now !== '' && !waiting && <p className="dsj-now-text">{journal.now}</p>}
      {waiting && (
        <p className="dsj-waiting"><span className="dsj-waiting-tag">{t('now.waiting')}</span>{journal.waiting}</p>
      )}
      <div className="dsj-stats">
        {openTotal > 0 && <span data-tone="warn">{t('count.open')} {openTotal}</span>}
        {decidedTotal > 0 && <span>{t('count.decided')} {decidedTotal}</span>}
        <span>{t('stats.turns', { n: stats.turns })}</span>
        {elapsed !== undefined && <span>{duration(elapsed)}</span>}
        {stats.files > 0 && <span>{t('stats.files', { n: stats.files })} <span className="dsj-add">+{stats.added}</span> <span className="dsj-del">−{stats.removed}</span></span>}
        {(stats.tests.passed > 0 || stats.tests.failed > 0) && (
          <span data-tone={stats.tests.failed > 0 ? 'bad' : undefined}>{t('stats.tests', { passed: stats.tests.passed, total: stats.tests.passed + stats.tests.failed })}</span>
        )}
      </div>
    </section>
  )
}

function ItemFacts({ item }) {
  const s = item.stats
  const bits = []
  if (item.fileCount > 0) bits.push(<span key="f">{t('facts.files', { n: item.fileCount })} <span className="dsj-add">+{s.added}</span> <span className="dsj-del">−{s.removed}</span></span>)
  if (s.passed + s.failed > 0) bits.push(<span key="t" data-tone={s.failed > 0 ? 'bad' : undefined}>{t('facts.tests', { passed: s.passed })}{s.failed > 0 ? t('facts.testsFailed', { failed: s.failed }) : ''}</span>)
  if (s.reviews > 0) bits.push(<span key="r">{t('facts.reviews', { n: s.reviews })}</span>)
  return bits
}

/** Kind order for counts: the usual order work moves in, not time. */
const FLOW_ORDER = ['requirement', 'research', 'design', 'implement', 'review', 'fix', 'test', 'debug', 'deliver', 'discuss', 'other']

/** "Build 4 · Review 2 · Test 3": how much of each kind of work the item took. */
function flowOf(phases) {
  const counts = new Map()
  for (const p of phases) counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1)
  return FLOW_ORDER.filter((kind) => counts.has(kind) && kind !== 'discuss' && kind !== 'other')
    .map((kind) => ({ kind, label: kindLabel(kind), n: counts.get(kind) }))
}

function FileRows({ journal, files, onOpen }) {
  const phaseLabel = (id) => {
    const p = journal.phases[id]
    return p === undefined ? '' : kindLabel(p.kind)
  }
  return (
    <ul className="dsj-files">
      {files.map((f) => {
        const rel = relative(journal.cwd, f.path)
        const address = fileAddress(journal.sessionId, journal.cwd, f.path)
        return (
          <li key={f.path}>
            <button
              type="button"
              className="dsj-file"
              title={address === undefined ? t('file.outside', { path: f.path }) : f.path}
              disabled={address === undefined}
              onClick={() => address !== undefined && onOpen(address)}
            >
              <span className="dsj-file-path">
                {rel.split('/').at(-1)}
                {rel.includes('/') && <span className="dsj-file-dir">{rel.split('/').slice(0, -1).join('/')}</span>}
              </span>
              {f.created && <span className="dsj-new">{t('file.new')}</span>}
              <span className="dsj-file-delta"><span className="dsj-add">+{f.added}</span> <span className="dsj-del">−{f.removed}</span></span>
              <span className="dsj-file-phases">{[...new Set(f.phases.map(phaseLabel))].join(' ')}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Item({ journal, item, defaultOpen, onOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const summarizedAtStart = item.result !== '' || item.open.length > 0 || item.decisions.length > 0
  // Without a summary there is nothing above the details, so start with them open.
  const [detail, setDetail] = useState(summarizedAtStart ? undefined : 'turns') // 'turns' | 'files'
  const phases = useMemo(() => item.phaseIds.map((id) => journal.phases[id]).filter(Boolean), [item.phaseIds, journal.phases])
  const files = useMemo(() => {
    const ids = new Set(item.phaseIds)
    return journal.files.filter((f) => f.phases.some((id) => ids.has(id)))
  }, [item.phaseIds, journal.files])
  const turns = useMemo(() => {
    const set = new Set(item.turns)
    return (journal.turnLog ?? []).filter((x) => set.has(x.turn))
  }, [item.turns, journal.turnLog])
  const flow = flowOf(phases)
  // "Done" with unresolved items is not done: say so on the badge itself.
  const status = item.status === 'done' && item.open.length > 0
    ? { label: t('status.doneOpen'), tone: 'warn-soft' }
    : statusOf(item.status)
  const title = item.title || journal.goal || t('item.untitled')
  const summarized = item.result !== '' || item.open.length > 0 || item.decisions.length > 0
  return (
    <li className="dsj-item" data-status={item.status} data-open={open ? '' : undefined} data-unresolved={item.open.length > 0 ? '' : undefined}>
      <button type="button" className="dsj-item-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="dsj-badge" data-tone={status.tone}>{status.label}</span>
        <span className="dsj-item-title" title={title}>{title}</span>
        <span className="dsj-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      <div className="dsj-item-counts">
        <span className="dsj-count" data-tone={item.open.length > 0 ? 'warn' : 'none'}>
          {t('count.open')} <b>{item.open.length}</b>
        </span>
        <span className="dsj-count" data-tone={item.decisions.length > 0 ? 'info' : 'none'}>
          {t('count.decided')} <b>{item.decisions.length}</b>
        </span>
      </div>
      <div className="dsj-item-sub">
        <JumpLink turn={item.turns[0]} className="dsj-dim">{turnRange(item.turns)}</JumpLink>
        <ItemFacts item={item} />
        {flow.length > 0 && <span className="dsj-dim">{flow.map((f) => `${f.label} ${f.n}`).join(' · ')}</span>}
      </div>
      {open && (
        <div className="dsj-item-body">
          {item.goal !== '' && item.goal !== title && <p className="dsj-item-goal">{item.goal}</p>}
          {item.result !== '' && <p className="dsj-item-result">{item.result}</p>}
          {!summarized && <p className="dsj-dim">{t('item.noSummary')}</p>}
          {item.open.length > 0 && (
            <div className="dsj-block">
              <h4 className="dsj-h4" data-tone="warn">{t('section.open')} {item.open.length}</h4>
              <ul className="dsj-bullets">{item.open.map((text, i) => <li key={i}>{text}</li>)}</ul>
            </div>
          )}
          {item.decisions.length > 0 && (
            <div className="dsj-block">
              <h4 className="dsj-h4">{t('section.decided')} {item.decisions.length}</h4>
              <ul className="dsj-bullets">{item.decisions.map((text, i) => <li key={i}>{text}</li>)}</ul>
            </div>
          )}
          <div className="dsj-tabs" role="group">
            <button type="button" data-on={detail === 'turns' ? '' : undefined} onClick={() => setDetail(detail === 'turns' ? undefined : 'turns')}>
              {t(detail === 'turns' ? 'tab.collapseTurns' : 'tab.turns', { n: turns.length })}
            </button>
            {files.length > 0 && (
              <button type="button" data-on={detail === 'files' ? '' : undefined} onClick={() => setDetail(detail === 'files' ? undefined : 'files')}>
                {t(detail === 'files' ? 'tab.collapseFiles' : 'tab.files', { n: files.length })}
              </button>
            )}
          </div>
          {detail === 'turns' && <TurnList turns={turns} phases={phases} />}
          {detail === 'files' && <FileRows journal={journal} files={files} onOpen={onOpen} />}
        </div>
      )}
    </li>
  )
}

const OUTCOMES = new Set(['aborted', 'interrupted', 'error', 'canceled'])

/**
 * One row per turn, newest first, as an index into the conversation: the
 * turn number and time, what the user asked (one line), and the phases it
 * went through. The whole row jumps to that turn in the chat; reading the
 * turn happens there, not in the panel.
 */
function TurnList({ turns, phases }) {
  return (
    <ol className="dsj-turns">
      {[...turns].reverse().map((turn) => {
        const own = phases.filter((p) => turn.turn >= p.turns[0] && turn.turn <= p.turns[1])
        const kinds = [...new Set(own.map((p) => p.kind))]
        const status = turn.end === undefined ? t('turn.running') : (OUTCOMES.has(turn.outcome) ? t(`outcome.${turn.outcome}`) : '')
        const ask = turn.user !== '' ? turn.user : (turn.about ?? '')
        return (
          <li key={turn.turn}>
            <JumpRow turn={turn.turn}>
              <span className="dsj-turn-no">{t('turn.one', { n: turn.turn })}</span>
              <span className="dsj-turn-ask" data-derived={turn.user === '' ? '' : undefined}>{ask || '—'}</span>
              <span className="dsj-turn-meta">
                {kinds.map((kind) => <span key={kind} className="dsj-phase-name" data-kind={kind}>{kindLabel(kind)}</span>)}
                <span className="dsj-dim">{clock(turn.start)}{status !== '' ? ` · ${status}` : ''}</span>
              </span>
            </JumpRow>
          </li>
        )
      })}
    </ol>
  )
}

/** A whole-row button that jumps to a turn, with the same "switch to Chat" note as JumpLink. */
function JumpRow({ turn, children }) {
  const [note, setNote] = useState('')
  useEffect(() => {
    if (note === '') return undefined
    const timer = setTimeout(() => setNote(''), 2500)
    return () => clearTimeout(timer)
  }, [note])
  const onClick = async () => {
    const result = await jumpToTurn(turn)
    if (result === 'no-rail') setNote(t('jump.noRail'))
    else if (result === 'no-turn') setNote(t('jump.noTurn'))
  }
  return (
    <div className="dsj-jump-wrap dsj-turn-wrap">
      <button type="button" className="dsj-turn" onClick={onClick} title={t('jump.title', { n: turn })}>{children}</button>
      {note !== '' && <span className="dsj-jump-note" role="status">{note}</span>}
    </div>
  )
}

function Todos({ journal }) {
  if (journal.open.length === 0) return null
  
  return (
    <section className="dsj-section">
      <h3 className="dsj-h">{t('todos.title')}</h3>
      <ul className="dsj-bullets">
        {journal.open.map((item, i) => (
          <li key={i} data-tone={item.source === 'test' ? 'bad' : undefined}>
            <span className="dsj-chip">{t(`todos.${item.source}`)}{item.status === 'in_progress' ? t('todos.inProgress') : ''}</span>{item.text}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Summary language: same as the UI, or fixed to Chinese / English. Stored per browser. */
function LangPicker() {
  const { pref } = useSummaryLang()
  return (
    <label className="dsj-lang" title={t('footer.lang')}>
      <span className="dsj-lang-label">{t('footer.lang')}</span>
      <select value={pref} onChange={(e) => setSummaryLangPref(e.target.value)}>
        <option value="auto">{t('lang.auto')}</option>
        <option value="zh">{t('lang.zh')}</option>
        <option value="en">{t('lang.en')}</option>
      </select>
    </label>
  )
}

function Footer({ journal, loading }) {
  const { done, total } = journal.summarized
  let text
  if (journal.summarizer === 'off') text = t('footer.off')
  else if (journal.pending > 0) text = t('footer.pending', { n: journal.pending, done, total })
  else if (journal.outlining) text = t('footer.outlining')
  else if (journal.failedTurns.length > 0) text = t('footer.failed', { turns: journal.failedTurns.join(', ') })
  else text = journal.outlineAt === undefined ? t('footer.summarized', { done, total }) : t('footer.outlined', { time: clock(journal.outlineAt) })
  return (
    <footer className="dsj-footer">
      <span className="dsj-footer-text">{text}</span>
      {journal.summarizer !== 'off' && <LangPicker />}
      <button type="button" className="dsj-refresh" onClick={() => refresh(journal.sessionId)} disabled={loading} title={t('footer.refresh')}>{loading ? '…' : '⟳'}</button>
    </footer>
  )
}

/** Sidebar tab body. */
export function JournalBody(props) {
  useUiLocale()
  const { sessionId, useTabInfo } = props
  const { tab } = useTabInfo()
  const { value, error, loading } = useJournal(sessionId)
  useEffect(() => tab.actions.bindCommands({ refresh: () => { void refresh(sessionId) } }), [tab.actions, sessionId])
  const openFile = (address) => tab.actions.openResource(address, { preferNewPane: true })
  if (value === undefined) {
    return <div className="dsj-root"><p className="dsj-empty">{error ?? t('empty.loading')}</p></div>
  }
  if (value.stats.turns === 0) {
    return <div className="dsj-root"><p className="dsj-empty">{t('empty.notStarted')}</p></div>
  }
  const items = value.items ?? []
  return (
    <div className="dsj-root">
      <Now journal={value} />
      <section className="dsj-section">
        <h3 className="dsj-h">{t('items.title')}<span className="dsj-dim">{t('items.count', { n: items.length })}</span></h3>
        <ol className="dsj-items">
          {items.map((item) => (
            <Item key={item.id} journal={value} item={item} defaultOpen={false} onOpen={openFile} />
          ))}
        </ol>
      </section>
      <Todos journal={value} />
      {error !== undefined && <p className="dsj-empty" data-tone="bad">{error}</p>}
      <Footer journal={value} loading={loading} />
    </div>
  )
}

/** Tab chip title: text only, so the four characters fit beside the close button. */
export function JournalTitle({ useTabInfo }) {
  const { tab } = useTabInfo()
  return <>{tab.title}</>
}

/** A notebook glyph (guide card and tab chip). */
export function JournalIcon({ size = 16, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <rect x="3" y="2" width="10" height="12" rx="1.6" stroke="currentColor" />
      <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="currentColor" strokeLinecap="round" />
    </svg>
  )
}
