/**
 * Pure concession-chain solver for the Cursor-style AppFrame.
 * Horizontal order is fixed: keep the editor >= EDITOR_MIN by closing
 * details, shrinking then closing the primary sidebar (so a conversation
 * drag can reach two-thirds of the frame), then shrinking then closing
 * the conversation. The activity bar and the session sidebar
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
/** Primary-sidebar drag clamp ceiling (Cursor-like; git graph needs more than 420). */
export const WORKBENCH_MAX = 800
/** Primary-sidebar width before any user drag. */
export const WORKBENCH_DEFAULT = 260
/** Conversation-column drag clamp floor. */
export const CONVERSATION_MIN = 320
/** Conversation may grow to this fraction of the frame (user drag ceiling). */
export const CONVERSATION_MAX_RATIO = 2 / 3
/**
 * Store-side conversation ceiling: 2/3 of a 4K frame. The solver still caps
 * each paint at {@link conversationMax} for the live viewport.
 */
export const CONVERSATION_MAX = Math.floor(3840 * CONVERSATION_MAX_RATIO)
/** Conversation-column width before any user drag. */
export const CONVERSATION_DEFAULT = 380

/**
 * Live conversation drag ceiling: two-thirds of the current frame.
 * @param viewport - available frame width in px.
 * @returns the clamp max, never below {@link CONVERSATION_MIN}.
 */
export function conversationMax(viewport: number): number {
  return Math.max(CONVERSATION_MIN, Math.floor(viewport * CONVERSATION_MAX_RATIO))
}

/**
 * Plan a user gesture that must make the primary sidebar visible
 * (activity-bar Explorer / Git / Tasks). If the current conversation
 * preference would concede the primary to zero, shrink conversation
 * until explorer and editor can split the leftover 50/50.
 * @param viewport - live frame width in px.
 * @param sidebar - session-sidebar preference (0 = rail).
 * @param details - details preference (0 = closed).
 * @param conversation - conversation preference (0 treated as default).
 * @returns widths to write back as preferences.
 */
export function planPrimaryReveal(
  viewport: number,
  sidebar: number,
  details: number,
  conversation: number,
): { primary: number; conversation: number } {
  if (viewport <= 0) {
    return {
      primary: WORKBENCH_DEFAULT,
      conversation: conversation === 0 ? CONVERSATION_DEFAULT : conversation,
    }
  }
  const s = sidebar === 0 ? SIDEBAR_COLLAPSED : clampWidth(sidebar, SIDEBAR_MIN, SIDEBAR_MAX)
  const d = details === 0 ? 0 : clampWidth(details, DETAILS_MIN, DETAILS_MAX)
  const available = Math.max(0, viewport - ACTIVITY_WIDTH - s - d)
  const cPref = conversation === 0
    ? CONVERSATION_DEFAULT
    : clampWidth(conversation, CONVERSATION_MIN, conversationMax(viewport))
  const minWorkspace = WORKBENCH_MIN + EDITOR_MIN
  const leftover = available - cPref
  if (leftover >= WORKBENCH_DEFAULT + EDITOR_MIN) {
    return { primary: WORKBENCH_DEFAULT, conversation: cPref }
  }
  if (leftover >= minWorkspace) {
    return {
      primary: clampWidth(Math.floor(leftover / 2), WORKBENCH_MIN, WORKBENCH_MAX),
      conversation: cPref,
    }
  }
  // Conversation is blocking: shrink it so explorer + editor can split.
  // Prefer 400/400 (survives EDITOR_MIN); otherwise take the remaining floors.
  const idealWorkspace = 2 * EDITOR_MIN
  const maxWorkspace = available - CONVERSATION_MIN
  const workspace = maxWorkspace >= idealWorkspace
    ? idealWorkspace
    : Math.max(minWorkspace, maxWorkspace)
  const conversationOut = clampWidth(
    available - workspace,
    CONVERSATION_MIN,
    conversationMax(viewport),
  )
  const split = Math.max(minWorkspace, available - conversationOut)
  return {
    primary: clampWidth(Math.floor(split / 2), WORKBENCH_MIN, WORKBENCH_MAX),
    conversation: conversationOut,
  }
}
/** Bottom-panel drag clamp floor. */
export const BOTTOM_MIN = 120
/** Bottom-panel drag clamp ceiling. */
export const BOTTOM_MAX = 400
/** Bottom-panel height before any user drag. */
export const BOTTOM_DEFAULT = 200
/** Top menu-bar track; never dragged and never conceded. */
export const MENU_BAR_HEIGHT = 28

/**
 * The in-frame HTML menu bar is web-only. Desktop already has a native
 * product application menu, so a second strip must not appear underneath it.
 * @param protocol - `location.protocol`; `dsh:` is the desktop renderer.
 */
export function chromeMenuBarVisible(protocol: string = globalThis.location?.protocol ?? ''): boolean {
  return protocol !== 'dsh:'
}
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
 * Concession order: details, primary (so a 2/3 conversation drag can keep
 * the chat), then conversation, then the leftover primary shrink. The session sidebar
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
  const c0 = conversation === 0 ? 0 : clampWidth(conversation, CONVERSATION_MIN, conversationMax(viewport))
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

  // A wide conversation (up to 2/3) wins over the primary sidebar so a drag
  // to the left can keep the chat; the editor floor is protected first.
  if (c0 > 0 && p0 > 0) {
    const p1 = Math.max(WORKBENCH_MIN, viewport - activity - sOpen - c0 - EDITOR_MIN)
    if (fits(sOpen, p1, c0, 0)) return pack(sOpen, p1, c0, 0)
    if (fits(sOpen, 0, c0, 0)) return pack(sOpen, 0, c0, 0)
  }

  if (c0 > 0 && activity + sOpen + p0 + c0 <= viewport) return pack(sOpen, p0, c0, 0)
  if (c0 > 0 && activity + sOpen + c0 <= viewport) return pack(sOpen, 0, c0, 0)

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
