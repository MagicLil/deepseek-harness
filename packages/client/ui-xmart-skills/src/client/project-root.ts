/** Pick the current workspace path from the workspaces list snapshot. */

/**
 * Recent workspace path, when the list has one.
 * @param state - workspaces list snapshot.
 * @returns absolute project root, or undefined.
 */
export function projectRootOf(state: {
  readonly items: readonly { readonly workspaceId: string; readonly path: string }[]
  readonly recentWorkspaceId: string | undefined
}): string | undefined {
  if (state.recentWorkspaceId === undefined) return state.items[0]?.path
  return state.items.find(item => item.workspaceId === state.recentWorkspaceId)?.path
    ?? state.items[0]?.path
}

/**
 * Project root required by project-scoped reads.
 * @param root - workspace path from the list snapshot.
 * @returns the same path.
 */
export function requireProjectRoot(root: string | undefined): string {
  if (root === undefined) throw new Error('project-root')
  return root
}

/**
 * Short title for a workspace path.
 * @param path - absolute workspace path.
 * @returns the last path segment, or the original path.
 */
export function workspaceTitle(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '')
  const segments = trimmed.split(/[\\/]/).filter(part => part.length > 0)
  return segments[segments.length - 1] ?? path
}
