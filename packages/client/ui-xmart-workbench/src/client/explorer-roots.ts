/**
 * Resolve which folder the Explorer should list. One tree, the same
 * directory Git uses: session cwd, then the session's workspace, then
 * recency, then the first registered path. Stacking every rail folder
 * mixed unrelated projects in one pane.
 */
import { basename, isUnder } from './route-file.ts'

/** Minimal workspace row the explorer needs. */
export type ExplorerWorkspace = {
  workspaceId?: string
  path: string
  title: string
  sessionIds: readonly string[]
}

/** One explorer root: absolute path plus the label shown above the tree. */
export type ExplorerRoot = {
  path: string
  title: string
}

/**
 * The single root to render in the file tree.
 * @param sessionId - the bound session.
 * @param sessionCwd - session cwd from the list snapshot.
 * @param workspaces - host workspace registry rows.
 * @param recentWorkspaceId - recency projection, when any.
 * @returns one folder, or empty when nothing is registered.
 */
export function resolveExplorerRoots(
  sessionId: string,
  sessionCwd: string | undefined,
  workspaces: readonly ExplorerWorkspace[],
  recentWorkspaceId: string | undefined,
): ExplorerRoot[] {
  const path = resolveSessionCwd(sessionId, sessionCwd, workspaces, recentWorkspaceId)
  if (path === undefined) return []
  const row = workspaces.find(workspace => workspace.path === path)
  const title = row !== undefined && row.title !== '' ? row.title : basename(path)
  return [{ path, title }]
}

/**
 * Workspace the current conversation belongs to: membership first, then
 * an exact cwd match, then the most specific workspace that contains cwd.
 * @param sessionId - the bound session.
 * @param sessionCwd - session cwd from the list snapshot.
 * @param workspaces - host workspace registry rows.
 */
function boundWorkspace(
  sessionId: string,
  sessionCwd: string | undefined,
  workspaces: readonly ExplorerWorkspace[],
): ExplorerWorkspace | undefined {
  const owned = workspaces.find(row => row.sessionIds.includes(sessionId) && row.path !== '')
  if (owned !== undefined) return owned
  if (typeof sessionCwd !== 'string' || sessionCwd === '') return undefined
  const exact = workspaces.find(row => row.path === sessionCwd)
  if (exact !== undefined) return exact
  let best: ExplorerWorkspace | undefined
  for (const row of workspaces) {
    if (row.path === '' || !isUnder(sessionCwd, row.path)) continue
    if (best === undefined || row.path.length > best.path.length) best = row
  }
  return best
}

/**
 * True when `path` is a parent of a registered workspace folder.
 * Listing that directory would show the project as one child among siblings.
 */
function isParentOfRegisteredWorkspace(path: string, workspaces: readonly ExplorerWorkspace[]): boolean {
  return workspaces.some(row => row.path !== '' && row.path !== path && isUnder(row.path, path))
}

/**
 * Single directory Explorer / Git / copy-relative should talk to.
 * The conversation's workspace wins over a leftover or parent session cwd.
 * @param sessionId - the bound session.
 * @param sessionCwd - session cwd from the list snapshot.
 * @param workspaces - host workspace registry rows.
 * @param recentWorkspaceId - recency projection, when any.
 * @returns an absolute directory, or undefined when nothing is registered.
 */
export function resolveSessionCwd(
  sessionId: string,
  sessionCwd: string | undefined,
  workspaces: readonly ExplorerWorkspace[],
  recentWorkspaceId: string | undefined,
): string | undefined {
  const bound = boundWorkspace(sessionId, sessionCwd, workspaces)
  if (bound !== undefined) return bound.path
  if (
    typeof sessionCwd === 'string'
    && sessionCwd !== ''
    && !isParentOfRegisteredWorkspace(sessionCwd, workspaces)
  ) {
    return sessionCwd
  }
  if (recentWorkspaceId !== undefined) {
    const recent = workspaces.find(row => row.workspaceId === recentWorkspaceId && row.path !== '')
    if (recent !== undefined) return recent.path
  }
  return workspaces.find(row => row.path !== '')?.path
}

/**
 * Directory a new UI terminal should start in: first explorer root, else
 * the session/workspace cwd fallback.
 * @param roots - explorer roots currently shown.
 * @param sessionCwd - {@link resolveSessionCwd} result.
 */
export function resolveTerminalCwd(
  roots: readonly ExplorerRoot[],
  sessionCwd: string | undefined,
): string | undefined {
  const root = roots[0]?.path
  if (typeof root === 'string' && root !== '') return root
  if (typeof sessionCwd === 'string' && sessionCwd !== '') return sessionCwd
  return undefined
}

/**
 * Workspace root a path belongs to (copy-relative / create parent).
 * @param path - absolute file or folder path.
 * @param roots - explorer roots currently shown.
 * @returns the matching root path, the first root, or empty.
 */
export function homeOf(path: string, roots: readonly ExplorerRoot[]): string {
  return roots.find(root => isUnder(path, root.path))?.path ?? roots[0]?.path ?? ''
}
