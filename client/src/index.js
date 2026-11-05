/**
 * dsh-session-journal browser half.
 *
 * - A right-sidebar tab type (kind `session-journal`) with a guide card, so
 *   it is listed on the sidebar start page next to Files and Terminal. Its
 *   body (Journal.jsx) reads the plugin's journal API for the session the
 *   sidebar belongs to; `keepMounted` keeps it alive across tab switches.
 * - A `conversation.session.header.utilities` chip showing the current
 *   phase; clicking it opens the tab.
 *
 * The sidebar services come from ui-sidebar-right, which may activate after
 * this entry, so both registrations ride a runtime `ctx.inject`. Copy is
 * registered with DSH's locale service and follows Settings → General →
 * Language; the tab and guide labels are thunks, so they switch live.
 */
import { JournalBody, JournalIcon, JournalTitle } from './Journal.jsx'
import { en, NS, zh } from './locales.js'
import { PhaseChip, setJournalOpener } from './PhaseChip.jsx'
import { setLocale, t } from './stores.js'
import { injectStyles } from './styles.js'

export const KIND = 'session-journal'
export const ID = 'dsh-session-journal'

export const inject = ['slots']

export function apply(ctx) {
  injectStyles()
  ctx.inject(['locale'], (localeCtx) => {
    localeCtx.effect(() => localeCtx.locale.register(NS, { zh, en }), 'session-journal: dictionaries')
    setLocale(localeCtx.locale)
    localeCtx.effect(() => () => setLocale(undefined), 'session-journal: locale')
  })
  ctx.inject(['sidebarRightTabs'], (tabsCtx) => {
    tabsCtx.effect(() => tabsCtx.sidebarRightTabs.register({
      id: ID,
      kind: KIND,
      priority: 'extension',
      keepMounted: true,
      title: () => t('type.title'),
      guide: [{
        id: 'journal',
        order: 30,
        title: () => t('type.title'),
        description: () => t('guide.description'),
        icon: JournalIcon,
      }],
    }), 'session-journal: tab type')
  })
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: ID,
  }, JournalBody))
  ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title',
    key: ID,
  }, JournalTitle))
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'session-journal',
    // Early in the row: the phase is about this session.
    order: 30,
    label: () => t('type.title'),
  }, PhaseChip))
  ctx.inject(['sidebarRight'], (sideCtx) => {
    setJournalOpener(() => sideCtx.sidebarRight.openTab(KIND))
    sideCtx.effect(() => () => setJournalOpener(undefined), 'session-journal: opener')
  })
}
