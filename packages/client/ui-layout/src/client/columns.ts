/**
 * Pure concession-chain solver for the Cursor-style AppFrame.
 * Horizontal order is fixed: keep the editor >= EDITOR_MIN by closing
 * details, then the column the user is not dragging. A conversation
 * drag shrinks then closes the primary so chat can reach two-thirds;
 * a primary drag is the mirror (shrink then close conversation). Idle
 * paints keep chat. The activity bar and the session sidebar never
 * concede (AppFrame turns the session sidebar into a rail by passing
 * preference 0). The editor absorbs any remaining deficit as the last
 * resort (and may drop below EDITOR_MIN).
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
/**
 * Pixels left for the editor when a primary drag hits its ceiling.
 * Conversation still caps at {@link CONVERSATION_MAX_RATIO}; the Git /
 * Explorer column may keep growing until this remainder.
 */
export const WORKBENCH_EDITOR_REMAINDER = 160
/**
 * Store-side primary ceiling: a 4K frame minus the activity bar and
 * {@link WORKBENCH_EDITOR_REMAINDER}. Live paints still cap at
 * {@link workbenchMax} for the current viewport.
 */
export const WORKBENCH_MAX = 3840 - ACTIVITY_WIDTH - WORKBENCH_EDITOR_REMAINDER
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
 * Live primary-sidebar drag ceiling: grow until the editor would drop
 * below {@link WORKBENCH_EDITOR_REMAINDER} (activity bar never concedes).
 * @param viewport - available frame width in px.
 * @returns the clamp max, never below {@link WORKBENCH_MIN}.
 */
export function workbenchMax(viewport: number): number {
  return Math.max(WORKBENCH_MIN, viewport - ACTIVITY_WIDTH - WORKBENCH_EDITOR_REMAINDER)
}

/** Which flexible column a live sash drag should keep. */
export type ColumnPrefer = 'primary' | 'conversation'

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
/** Editor column vertical floor above the bottom panel. */
export const EDITOR_MIN_HEIGHT = 160
/** Bottom-panel drag clamp floor. */
export const BOTTOM_MIN = 120
/**
 * Store-side bottom ceiling: leave {@link EDITOR_MIN_HEIGHT} on a 4K-tall
 * frame. Live paints still shrink via {@link computeBottom} / {@link bottomMax}.
 */
export const BOTTOM_MAX = Math.max(BOTTOM_MIN, 2160 - EDITOR_MIN_HEIGHT)
/** Bottom-panel height before any user drag. */
export const BOTTOM_DEFAULT = 200
/** Top menu-bar track; never dragged and never conceded. */
export const MENU_BAR_HEIGHT = 28
/** Desktop title-bar overlay track (Window Controls Overlay); never dragged. */
export const TITLE_BAR_HEIGHT = 32

/** Electron preload bridge. Present in the desktop window even on loopback HTTP. */
type DesktopIpcWindow = { __DSH_IPC__?: unknown }

/**
 * Desktop chrome: the `dsh:` renderer, or loopback HTTP with Electron preload.
 * Protocol-only checks drop the title-track brand after the window moved to
 * `http://127.0.0.1`.
 */
function isDesktopChrome(protocol: string, desktopIpc: boolean): boolean {
  return protocol === 'dsh:' || desktopIpc
}

/**
 * The standalone HTML menu-bar row is web-only. Desktop paints that menu
 * inside the 32px title track so a second strip does not appear.
 * @param protocol - `location.protocol`.
 * @param desktopIpc - whether `window.__DSH_IPC__` is installed.
 */
export function chromeMenuBarVisible(
  protocol: string = globalThis.location?.protocol ?? '',
  desktopIpc: boolean = (globalThis as DesktopIpcWindow).__DSH_IPC__ !== undefined,
): boolean {
  return !isDesktopChrome(protocol, desktopIpc)
}

/**
 * Desktop owns a 32px title-bar track so the brand and a chat toggle can
 * sit in the Window Controls Overlay. The track is a real grid row and
 * never paints over the columns underneath.
 * @param protocol - `location.protocol`.
 * @param desktopIpc - whether `window.__DSH_IPC__` is installed.
 */
export function chromeTitleBarVisible(
  protocol: string = globalThis.location?.protocol ?? '',
  desktopIpc: boolean = (globalThis as DesktopIpcWindow).__DSH_IPC__ !== undefined,
): boolean {
  return isDesktopChrome(protocol, desktopIpc)
}

/**
 * Desktop title-track chat toggle label. Follows the document language.
 * @param open - whether the conversation column is currently open.
 * @param lang - document / navigator language.
 */
export function conversationToggleLabel(
  open: boolean,
  lang: string = globalThis.document?.documentElement?.lang
    || globalThis.navigator?.language
    || '',
): string {
  if (lang.toLowerCase().startsWith('zh')) return open ? '收起对话' : '打开对话'
  return open ? 'Collapse chat' : 'Open chat'
}

/**
 * Live bottom-panel drag ceiling: leave the editor vertical floor.
 * @param frameHeight - available frame height in px (below chrome).
 * @returns the clamp max, never below {@link BOTTOM_MIN}.
 */
export function bottomMax(frameHeight: number): number {
  return Math.max(BOTTOM_MIN, frameHeight - EDITOR_MIN_HEIGHT)
}

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
 * Concession order: details, then the non-preferred flexible column
 * (primary when idle / conversation-drag, conversation when primary-drag),
 * then the leftover shrink. A wide primary drag may drop the editor below
 * EDITOR_MIN, same as a 2/3 conversation drag. The session
 * sidebar is fixed at its preference (or the rail AppFrame already chose).
 * @param viewport - available frame width in px.
 * @param sidebar - session-sidebar width preference in px (0 = rail).
 * @param details - details width preference in px (0 = closed).
 * @param primary - primary-sidebar width preference in px (0 = closed).
 * @param conversation - conversation width preference in px (0 = closed).
 * @param prefer - which flexible column a live sash drag should keep.
 * @returns resolved widths; 0 means visually closed (never unmounted) except
 *   the session sidebar, which keeps its compact rail.
 */
export function computeColumns(
  viewport: number,
  sidebar: number,
  details: number,
  primary: number,
  conversation: number,
  prefer: ColumnPrefer = 'conversation',
): Columns {
  const activity = ACTIVITY_WIDTH
  const sOpen = sidebar === 0 ? SIDEBAR_COLLAPSED : clampWidth(sidebar, SIDEBAR_MIN, SIDEBAR_MAX)
  const p0 = primary === 0 ? 0 : clampWidth(primary, WORKBENCH_MIN, workbenchMax(viewport))
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

  // A live primary drag (up to the editor remainder) wins over conversation,
  // same as a conversation drag winning over the primary. Idle paints keep chat.
  if (prefer === 'primary' && p0 > 0) {
    if (c0 > 0) {
      const c1 = Math.max(CONVERSATION_MIN, viewport - activity - sOpen - p0 - EDITOR_MIN)
      if (fits(sOpen, p0, c1, 0)) return pack(sOpen, p0, c1, 0)
    }
    if (fits(sOpen, p0, 0, 0)) return pack(sOpen, p0, 0, 0)
    if (c0 > 0 && activity + sOpen + p0 + c0 <= viewport) return pack(sOpen, p0, c0, 0)
    if (c0 > 0) {
      const cFit = viewport - activity - sOpen - p0
      if (cFit >= CONVERSATION_MIN) return pack(sOpen, p0, cFit, 0)
    }
    if (activity + sOpen + p0 <= viewport) return pack(sOpen, p0, 0, 0)
    const pFit = viewport - activity - sOpen
    if (pFit >= WORKBENCH_MIN) return pack(sOpen, pFit, 0, 0)
  }

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
  // Conversation already closed (or just conceded): keep a wide primary
  // the same way a 2/3 chat keeps its preference and starves the editor.
  if (p0 > 0 && activity + sOpen + p0 <= viewport) return pack(sOpen, p0, 0, 0)

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
  const pref = clampWidth(preference, BOTTOM_MIN, Math.min(BOTTOM_MAX, bottomMax(frameHeight)))
  if (pref + EDITOR_MIN_HEIGHT <= frameHeight) return pref
  const shrunk = bottomMax(frameHeight)
  if (shrunk + EDITOR_MIN_HEIGHT <= frameHeight) return shrunk
  return 0
}
