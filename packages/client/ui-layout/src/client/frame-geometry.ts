/**
 * Direct-DOM geometry for AppFrame. Sash drags must paint tracks here
 * instead of through the layout store — a store write re-renders every
 * slot (Monaco, chat, file tree) and that is the editor-column flicker.
 */
import { computeBottom, computeColumns, type ColumnPrefer, type Columns } from './columns.ts'

/** Inputs the concession solver needs for one live paint. */
export interface FramePaintPrefs {
  viewport: { width: number; height: number }
  sidebar: number
  details: number
  workbench: number
  conversation: number
  bottom: number
  workbenchPanels: boolean
  detailsOn: boolean
  menuBarPx: number
  titleBarPx: number
  prefer?: ColumnPrefer
}

/** Solved tracks plus the bottom-row height. */
export interface FramePaint {
  cols: Columns
  bottom: number
}

/**
 * Solve column and bottom-row sizes for one paint.
 * @param prefs - live preferences (store snapshot, with drag overrides).
 */
export function solveFramePaint(prefs: FramePaintPrefs): FramePaint {
  const cols = computeColumns(
    prefs.viewport.width,
    prefs.sidebar,
    prefs.detailsOn ? prefs.details : 0,
    prefs.workbenchPanels ? prefs.workbench : 0,
    prefs.conversation,
    prefs.prefer ?? 'conversation',
  )
  const bottom = prefs.workbenchPanels
    ? computeBottom(Math.max(0, prefs.viewport.height - prefs.menuBarPx - prefs.titleBarPx), prefs.bottom)
    : 0
  return { cols, bottom }
}

/**
 * Write grid tracks and sash positions onto the frame element.
 * @param el - the AppFrame root.
 * @param paint - solved geometry.
 * @param viewport - frame box used for the far-right sash.
 */
/** Grid rows: optional title track, menu track, body, bottom. */
export function frameGridRows(menuBarPx: number, bottom: number, titleBarPx = 0): string {
  return titleBarPx > 0
    ? `${String(titleBarPx)}px ${String(menuBarPx)}px minmax(0, 1fr) ${String(bottom)}px`
    : `${String(menuBarPx)}px minmax(0, 1fr) ${String(bottom)}px`
}

export function applyFrameGeometry(
  el: HTMLElement,
  paint: FramePaint,
  viewport: { width: number; height: number },
  menuBarPx: number,
  titleBarPx = 0,
): void {
  const { cols, bottom } = paint
  el.style.gridTemplateColumns = `${String(cols.activity)}px ${String(cols.primary)}px minmax(0, 1fr) ${String(cols.conversation)}px ${String(cols.details)}px ${String(cols.sidebar)}px`
  el.style.gridTemplateRows = frameGridRows(menuBarPx, bottom, titleBarPx)
  const primaryLeft = cols.activity + cols.primary
  const conversationLeft = primaryLeft + cols.editor
  const detailsLeft = conversationLeft + cols.conversation
  placeHandle(el, 'primary', { left: primaryLeft })
  placeHandle(el, 'conversation', { left: conversationLeft })
  placeHandle(el, 'details', { left: detailsLeft })
  placeHandle(el, 'sidebar', { left: viewport.width - cols.sidebar })
  placeHandle(el, 'bottom', {
    left: primaryLeft,
    top: viewport.height - bottom,
    width: cols.editor,
  })
}

function placeHandle(
  el: HTMLElement,
  side: string,
  pos: { left?: number; top?: number; width?: number },
): void {
  const handle = el.querySelector(`[data-side="${side}"]`)
  if (!(handle instanceof HTMLElement)) return
  if (pos.left !== undefined) handle.style.left = `${String(pos.left)}px`
  if (pos.top !== undefined) handle.style.top = `${String(pos.top)}px`
  if (pos.width !== undefined) handle.style.width = `${String(pos.width)}px`
}
