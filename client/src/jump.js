/**
 * Jump the conversation to the start of a turn.
 *
 * DSH has no public "scroll to turn" API for plugins. The chat view has
 * its own turn rail (the row of ticks at the right edge of the transcript),
 * one button per started turn; clicking one scrolls to that turn's first
 * row, and for a turn not loaded yet it pages history in first. Its turn
 * numbers come from the same `turn/start` events as the journal's, so the
 * journal finds the button for turn N and clicks it.
 *
 * Two things make that harder than a querySelector:
 * - The rail hides itself (`display: none` from a container query) when the
 *   chat column is narrower than 900px, which is the normal case with the
 *   right sidebar open. Hidden, it renders no marks. The jump un-hides it
 *   (invisibly) for the duration of the click and then restores it.
 * - The rail is virtualized (marks 10px apart, only the visible window is
 *   in the DOM), so a far-away mark is first scrolled into the rail.
 *
 * The rail is found by its aria-label (the chat's own copy, in every UI
 * language). Marks have `data-index` and an aria-label with the turn
 * number. This leans on the chat view's markup, not a contract; when it is
 * not found the caller gets a reason and tells the user.
 */

/** The chat's `chat.turnNavigation.label` copy in every built-in language. */
const RAIL_LABELS = new Set(['轮次导航', 'Turn navigation', 'ターン移動', 'Navegación por turnos', 'Navigation entre les tours', 'Rundennavigation', 'Навигация по ходам', 'Navegação entre turnos'])

/** Spacing of rail marks in the chat view (TURN_SPACING_PX). */
const MARK_SPACING_PX = 10

const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((resolve) => requestAnimationFrame(() => resolve())) }

/** The chat transcript's turn rail, or undefined when the chat view is not on screen. */
function findRail() {
  for (const nav of document.querySelectorAll('nav[aria-label]')) {
    if (RAIL_LABELS.has(nav.getAttribute('aria-label'))) return nav
  }
  // Unknown language pack: fall back to the nav that holds rail marks.
  return document.querySelector('nav button[data-index][aria-label]')?.closest('nav') ?? undefined
}

/** The rail's rendered marks with their positions and turn numbers. */
function railMarks(rail) {
  return [...rail.querySelectorAll('button[data-index][aria-label]')]
    .map((button) => ({ button, index: Number(button.dataset.index), turn: Number(button.getAttribute('aria-label').match(/\d+/)?.[0]) }))
    .filter((mark) => Number.isInteger(mark.index) && Number.isInteger(mark.turn))
}

/** Find the mark for turn `n`, scrolling the virtualized rail when it is out of the rendered window. */
async function findMark(rail, n) {
  let marks = railMarks(rail)
  let hit = marks.find((mark) => mark.turn === n)
  if (hit !== undefined || marks.length === 0) return hit
  const ref = marks[0]
  const target = Math.max(0, ref.index + (n - ref.turn))
  const scroller = rail.firstElementChild
  if (!(scroller instanceof HTMLElement)) return undefined
  scroller.scrollTop = Math.max(0, target * MARK_SPACING_PX - scroller.clientHeight / 2)
  await frames(2)
  marks = railMarks(rail)
  hit = marks.find((mark) => mark.turn === n)
  return hit
}

/**
 * Jump the chat to turn `n`.
 * @returns {Promise<'ok' | 'no-rail' | 'no-turn'>}
 */
export async function jumpToTurn(n) {
  const rail = findRail()
  if (rail === undefined) return 'no-rail'
  const hidden = getComputedStyle(rail).display === 'none'
  if (hidden) {
    // Rendered but invisible while it lays out its marks.
    rail.style.setProperty('display', 'block', 'important')
    rail.style.setProperty('visibility', 'hidden', 'important')
    await frames(3)
  }
  const restore = () => {
    if (!hidden) return
    rail.style.removeProperty('visibility')
    rail.style.removeProperty('display')
  }
  const hit = await findMark(rail, n)
  if (hit === undefined) {
    restore()
    return 'no-turn'
  }
  hit.button.click()
  // Keep it rendered until the chat has handled the click (an unloaded turn
  // pages history first), then hand display back to the stylesheet.
  if (hidden) setTimeout(restore, 4000)
  return 'ok'
}
