/**
 * Same-project helpers: switching conversations in the current folder
 * should keep the explorer / editor chrome instead of jumping.
 */

/** Workspace list facts used to resolve a session's project folder. */
export type ProjectWorkspaceRow = {
  workspaceId: string
  path: string
  sessionIds: readonly string[]
}

/** Session-list facts used to resolve a session's project folder. */
export type ProjectSessionRow = {
  cwd?: string
  blank?: boolean
}

/**
 * Stable project key for a session: the workspace folder path, then cwd.
 * @param sessionId - session to resolve.
 * @param sessions - live session list (`byId` + optional current).
 * @param workspaces - live workspace list.
 * @returns a path/id key, or undefined when the session is not in a folder.
 */
export function projectKeyOf(
  sessionId: string,
  sessions: { byId: Record<string, ProjectSessionRow | undefined> },
  workspaces: { items: readonly ProjectWorkspaceRow[] },
): string | undefined {
  const owned = workspaces.items.find(row => row.sessionIds.includes(sessionId))
  if (owned !== undefined && owned.path !== '') return owned.path
  const cwd = sessions.byId[sessionId]?.cwd
  if (typeof cwd === 'string' && cwd !== '') return cwd
  return owned?.workspaceId
}

/**
 * True when both sessions belong to the same project folder.
 * @param prev - session we are leaving.
 * @param next - session we are opening.
 * @param sessions - live session list.
 * @param workspaces - live workspace list.
 */
export function shouldInheritSameProject(
  prev: string,
  next: string,
  sessions: { byId: Record<string, ProjectSessionRow | undefined> },
  workspaces: { items: readonly ProjectWorkspaceRow[] },
): boolean {
  if (prev === next) return false
  const from = projectKeyOf(prev, sessions, workspaces)
  const to = projectKeyOf(next, sessions, workspaces)
  return from !== undefined && from === to
}
