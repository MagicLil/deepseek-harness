/**
 * In-memory UI-tab → host PTY id map. Survives bottom-panel hide; dies on
 * reload (host PTYs do not survive process exit).
 */

/** Compose the map key for one tab in one session. */
export function terminalSeatKey(sessionId: string, tabId: string): string {
  return `${sessionId}\u0000${tabId}`
}

const seats = new Map<string, string>()

/**
 * Read the host PTY id for a tab, if this page already opened one.
 * @param sessionId - session that owns the tab.
 * @param tabId - workbench tab instance id.
 * @returns the host PTY id, or undefined.
 */
export function getTerminalSeat(sessionId: string, tabId: string): string | undefined {
  return seats.get(terminalSeatKey(sessionId, tabId))
}

/**
 * Remember the host PTY id for a tab.
 * @param sessionId - session that owns the tab.
 * @param tabId - workbench tab instance id.
 * @param ptyId - host PTY id from `host.terminalOpen`.
 */
export function setTerminalSeat(sessionId: string, tabId: string, ptyId: string): void {
  seats.set(terminalSeatKey(sessionId, tabId), ptyId)
}

/**
 * Forget the host PTY id for a tab (after kill or a failed reopen).
 * @param sessionId - session that owns the tab.
 * @param tabId - workbench tab instance id.
 * @returns the forgotten PTY id, or undefined.
 */
export function clearTerminalSeat(sessionId: string, tabId: string): string | undefined {
  const key = terminalSeatKey(sessionId, tabId)
  const ptyId = seats.get(key)
  seats.delete(key)
  return ptyId
}

/** Test-only: drop every seat so specs start from an empty map. */
export function resetTerminalSeats(): void {
  seats.clear()
}
