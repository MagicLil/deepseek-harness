/**
 * Pure concession-chain solver for the Cursor-style AppFrame.
 * Horizontal order is fixed: keep the editor >= EDITOR_MIN by closing
 * details, shrinking then closing the conversation, then shrinking then
 * closing the primary sidebar. The activity bar and the session sidebar
 * never concede (AppFrame turns the session sidebar into a rail by
 * passing preference 0). The editor absorbs any remaining deficit as
 * the last resort (and may drop below EDITOR_MIN).
 * Preferences are never rewritten, so widening the window restores them.
 * Inputs are the layout store's plain width preferences (0 = closed);
 * a closed session sidebar resolves to the fixed SIDEBAR_COLLAPSED rail
 * while closed details / conversation / primary resolve to zero width.
 * The SIDEBAR_AUTO_COLLAPSE breakpoint is consumed by AppFrame; the
 * solver itself stays breakpoint-free.
 */

/** Resolved widths for one frame; editor may drop below EDITOR_MIN only at the final fallback. */
export interface Columns {
  activity: number
  primary: number
  editor: number
  conversation: number
  details: number
  sidebar: number
}

/** Activity-bar track; never dragged and never conceded. */
export const ACTIVITY_WIDTH = 48
/** Editor column floor; only the final fallback may go below it. */
export const EDITOR_MIN = 400
/** Alias of {@link EDITOR_MIN} (the editor is the center track). */
export const CENTER_MIN = EDITOR_MIN
/** Session-sidebar (far right) drag clamp floor. */
export const SIDEBAR_MIN = 264
/** Session-sidebar drag clamp ceiling. */
export const SIDEBAR_MAX = 420
/** Session-sidebar width before any user drag. */
export const SIDEBAR_DEFAULT = 280
/** Closed session-sidebar rail: a 24px icon column between 16px horizontal paddings. */
export const SIDEBAR_COLLAPSED = 56
/** Viewport width below which the session sidebar auto-collapses to the rail (deepsuite
 * LG breakpoint); a manual toggle below it re-expands over the squeezed editor
 * (stores.ts narrowExpanded). */
export const SIDEBAR_AUTO_COLLAPSE = 1024
/** Details drag clamp floor. */
export const DETAILS_MIN = 300
/** Details drag clamp ceiling. */
export const DETAILS_MAX = 520
/** Details width before any user drag. */
export const DETAILS_DEFAULT = 360
/** Primary-sidebar (Explorer/Git/Tasks) drag clamp floor. `workbench` store field. */
export const WORKBENCH_MIN = 200
/** Primary-sidebar drag clamp ceiling. */
export const WORKBENCH_MAX = 420
/** Primary-sidebar width before any user drag. */
export const WORKBENCH_DEFAULT = 260
/** Conversation-column drag clamp floor. */
export const CONVERSATION_MIN = 320
/** Conversation-column drag clamp ceiling. */
export const CONVERSATION_MAX = 560
/** Conversation-column width before any user drag. */
export const CONVERSATION_DEFAULT = 380
/** Bottom-panel drag clamp floor. */
export const BOTTOM_MIN = 120
/** Bottom-panel drag clamp ceiling. */
export const BOTTOM_MAX = 400
/** Bottom-panel height before any user drag. */
export const BOTTOM_DEFAULT = 200
/** Editor column vertical floor above the bottom panel. */
export const EDITOR_MIN_HEIGHT = 160

/**
 * Clamp a panel width into its contract range.
 * @param px - requested width.
 * @param min - range lower bound.
 * @param max - range upper bound.
 * @returns the clamped width.
 */
export function clampWidth(px: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(px)))
}

/**
 * Solve the six column widths for one viewport frame. Pure: no hysteresis —
 * the output is a function of (viewport, preferences) only, so recovery on
 * re-widening is automatic. Preferences re-clamp here because they cross the
 * store boundary and callers may still supply stale ranges.
 * Concession order: details, conversation, primary. The session sidebar
 * is fixed at its preference (or the rail AppFrame already chose).
 * @param viewport - available frame width in px.
 * @param sidebar - session-sidebar width preference in px (0 = rail).
 * @param details - details width preference in px (0 = closed).
 * @param primary - primary-sidebar width preference in px (0 = closed).
 * @param conversation - conversation width preference in px (0 = closed).
 * @returns resolved widths; 0 means visually closed (never unmounted) except
 *   the session sidebar, which keeps its compact rail.
 */
export function computeColumns(
  viewport: number,
  sidebar: number,
  details: number,
  primary: number,
  conversation: number,
): Columns {
  const activity = ACTIVITY_WIDTH
  const sOpen = sidebar === 0 ? SIDEBAR_COLLAPSED : clampWidth(sidebar, SIDEBAR_MIN, SIDEBAR_MAX)
  const p0 = primary === 0 ? 0 : clampWidth(primary, WORKBENCH_MIN, WORKBENCH_MAX)
  const c0 = conversation === 0 ? 0 : clampWidth(conversation, CONVERSATION_MIN, CONVERSATION_MAX)
  const d0 = details === 0 ? 0 : clampWidth(details, DETAILS_MIN, DETAILS_MAX)

  const pack = (s: number, p: number, c: number, d: number): Columns => ({
    activity,
    primary: p,
    editor: Math.max(0, viewport - activity - s - p - c - d),
    conversation: c,
    details: d,
    sidebar: s,
  })
  const fits = (s: number, p: number, c: number, d: number): boolean =>
    activity + s + p + c + d + EDITOR_MIN <= viewport

  if (fits(sOpen, p0, c0, d0)) return pack(sOpen, p0, c0, d0)

  if (d0 > 0) {
    const d1 = Math.max(DETAILS_MIN, viewport - activity - sOpen - p0 - c0 - EDITOR_MIN)
    if (fits(sOpen, p0, c0, d1)) return pack(sOpen, p0, c0, d1)
  }

  if (fits(sOpen, p0, c0, 0)) return pack(sOpen, p0, c0, 0)

  if (c0 > 0) {
    const c1 = Math.max(CONVERSATION_MIN, viewport - activity - sOpen - p0 - EDITOR_MIN)
    if (fits(sOpen, p0, c1, 0)) return pack(sOpen, p0, c1, 0)
  }

  if (fits(sOpen, p0, 0, 0)) return pack(sOpen, p0, 0, 0)

  if (p0 > 0) {
    const p1 = Math.max(WORKBENCH_MIN, viewport - activity - sOpen - EDITOR_MIN)
    if (fits(sOpen, p1, 0, 0)) return pack(sOpen, p1, 0, 0)
  }

  return pack(sOpen, 0, 0, 0)
}

/**
 * Solve the bottom-panel height for one frame. Pure: preference 0 stays
 * closed; an open preference shrinks toward BOTTOM_MIN then auto-closes
 * when the editor would drop below EDITOR_MIN_HEIGHT.
 * @param frameHeight - available frame height in px.
 * @param preference - bottom height preference in px (0 = closed).
 * @returns resolved height; 0 means visually closed (never unmounted).
 */
export function computeBottom(frameHeight: number, preference: number): number {
  if (preference === 0) return 0
  const pref = clampWidth(preference, BOTTOM_MIN, BOTTOM_MAX)
  if (pref + EDITOR_MIN_HEIGHT <= frameHeight) return pref
  const shrunk = Math.max(BOTTOM_MIN, frameHeight - EDITOR_MIN_HEIGHT)
  if (shrunk + EDITOR_MIN_HEIGHT <= frameHeight) return shrunk
  return 0
}
