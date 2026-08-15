/**
 * Cursor-style SCM grouping: porcelain rows already carry `area`, this
 * module just splits them and builds bulk path lists.
 */
import type { GitChange, GitSyncMode } from '@deepseek-ai/dsh-client-runtime/client'

/** Staged (index) vs unstaged / untracked (worktree) lists. */
export type GitChangeGroups = {
  staged: GitChange[]
  unstaged: GitChange[]
}

/**
 * Split status rows into Cursor's two change sections.
 * @param changes - host.gitStatus rows (a path may appear in both).
 */
export function partitionGitChanges(changes: readonly GitChange[]): GitChangeGroups {
  const staged: GitChange[] = []
  const unstaged: GitChange[] = []
  for (const change of changes) {
    if (change.area === 'index') staged.push(change)
    else unstaged.push(change)
  }
  return { staged, unstaged }
}

/**
 * Unique repository-relative paths for stage-all / unstage-all.
 * @param changes - one section's rows.
 */
export function gitSectionPaths(changes: readonly GitChange[]): string[] {
  return [...new Set(changes.map(change => change.path))]
}

/**
 * Diff side for a row click (index → staged, otherwise worktree).
 * @param change - one SCM row.
 */
export function gitDiffSideOf(change: GitChange): 'worktree' | 'staged' {
  return change.area === 'index' ? 'staged' : 'worktree'
}

/** Stable React key when the same path is staged and unstaged. */
export function gitChangeKey(change: GitChange): string {
  return `${change.area}:${change.path}`
}

/** Context-menu verbs that apply to one SCM section. */
export function gitMenuItemIds(area: GitChange['area'] | undefined): readonly string[] {
  if (area === 'index') return ['unstage', 'diff-staged', 'open']
  return ['stage', 'discard', 'diff-work', 'open']
}

/** Same constraints as host.gitCheckout's branch-name schema. */
export function isGitBranchName(value: string): boolean {
  return (
    value.length > 0
    && value.length <= 200
    && /^(?!-)[A-Za-z0-9._/-]+$/.test(value)
    && !value.includes('..')
    && !value.includes('@{')
    && !value.endsWith('/')
    && !value.endsWith('.lock')
  )
}

/** Host / Error message for a failed SCM verb. */
export function gitActionMessage(error: unknown): string {
  if (error instanceof Error && error.message !== '') return error.message
  return 'git failed'
}

/**
 * Fetch, then ff-only pull if behind, then push if ahead.
 * @param root - repository root.
 * @param ops - host verbs plus a status re-read.
 */
export async function runGitSyncSequence(
  root: string,
  ops: {
    gitSync: (path: string, mode: GitSyncMode) => Promise<void>
    gitStatus: (path: string) => Promise<{ ahead: number; behind: number }>
  },
): Promise<void> {
  await ops.gitSync(root, 'fetch')
  let status = await ops.gitStatus(root)
  if (status.behind > 0) {
    await ops.gitSync(root, 'pull')
    status = await ops.gitStatus(root)
  }
  if (status.ahead > 0) await ops.gitSync(root, 'push')
}
