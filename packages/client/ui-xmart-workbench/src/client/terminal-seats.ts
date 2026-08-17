/**
 * In-memory UI-tab → host PTY id map. Survives bottom-panel hide; dies on
 * reload (host PTYs do not survive process exit). The first argument is the
 * workbench scope (project folder), not the conversation session — same-project
 * chats keep the same seat. `ownerSessionId` is the conversation that opened
 * the PTY; host.terminal* still addresses that session.
 */

/** One live UI terminal seat. */
export type TerminalSeat = {
  /** Host PTY id from `host.terminalOpen`. */
  ptyId: string
  /** Conversation session that owns the host PTY. */
  ownerSessionId: string
}

/** Compose the map key for one tab in one workbench scope. */
export function terminalSeatKey(scopeId: string, tabId: string): string {
  return `${scopeId}\u0000${tabId}`
}

const seats = new Map<string, TerminalSeat>()

/**
 * Read the host PTY id for a tab, if this page already opened one.
 * @param scopeId - workbench scope (project folder or session id).
 * @param tabId - workbench tab instance id.
 * @returns the host PTY id, or undefined.
 */
export function getTerminalSeat(scopeId: string, tabId: string): string | undefined {
  return seats.get(terminalSeatKey(scopeId, tabId))?.ptyId
}

/**
 * Conversation session that opened this tab's PTY.
 * @param scopeId - workbench scope.
 * @param tabId - workbench tab instance id.
 * @returns the owner session id, or undefined.
 */
export function getTerminalSeatOwner(scopeId: string, tabId: string): string | undefined {
  return seats.get(terminalSeatKey(scopeId, tabId))?.ownerSessionId
}

/**
 * Remember the host PTY id for a tab.
 * @param scopeId - workbench scope.
 * @param tabId - workbench tab instance id.
 * @param ptyId - host PTY id from `host.terminalOpen`.
 * @param ownerSessionId - conversation that owns the host PTY.
 */
export function setTerminalSeat(
  scopeId: string,
  tabId: string,
  ptyId: string,
  ownerSessionId = scopeId,
): void {
  seats.set(terminalSeatKey(scopeId, tabId), { ptyId, ownerSessionId })
}

/**
 * Forget the host PTY id for a tab (after kill or a failed reopen).
 * @param scopeId - workbench scope.
 * @param tabId - workbench tab instance id.
 * @returns the forgotten PTY id, or undefined.
 */
export function clearTerminalSeat(scopeId: string, tabId: string): string | undefined {
  const key = terminalSeatKey(scopeId, tabId)
  const ptyId = seats.get(key)?.ptyId
  seats.delete(key)
  return ptyId
}

/** Test-only: drop every seat so specs start from an empty map. */
export function resetTerminalSeats(): void {
  seats.clear()
}
