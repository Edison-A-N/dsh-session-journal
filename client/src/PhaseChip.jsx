/**
 * The session-header chip: which work item is on and where it is
 * ("● 工作日志插件 · 测试"), or "等你" / "Your turn" when the agent stopped
 * and is waiting for the user. Clicking opens (or focuses) the journal tab.
 */
import { phaseName, t, useJournal, useUiLocale } from './stores.js'

let openJournal
/** Install (or clear) the function that opens the journal tab. */
export function setJournalOpener(fn) { openJournal = fn }

export function PhaseChip({ sessionId }) {
  useUiLocale()
  const { value } = useJournal(sessionId)
  const current = value?.current
  if (current === undefined) return null
  const phase = phaseName(current.kind, current.round)
  const item = value.items?.find((it) => it.status === 'active') ?? value.items?.[0]
  const itemTitle = item?.title ?? ''
  const waiting = !value.running && value.waiting !== ''
  const label = waiting ? t('chip.waiting', { label: itemTitle || phase }) : (itemTitle !== '' ? `${itemTitle} · ${phase}` : phase)
  const tip = [itemTitle || value.goal, value.now, waiting ? t('chip.tipWaiting', { text: value.waiting }) : '', t('chip.tipOpen')].filter(Boolean).join('\n')
  return (
    <button
      type="button"
      className="dsj-chipbtn"
      data-kind={current.kind}
      data-waiting={waiting ? '' : undefined}
      title={tip}
      onClick={() => openJournal?.()}
    >
      <span className="dsj-dot" data-running={value.running ? '' : undefined} />
      <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </button>
  )
}
