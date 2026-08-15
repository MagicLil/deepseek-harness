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

/**
 * If `origin/foo` already has a local `foo`, return that name so a remote
 * pill attaches HEAD instead of detaching it.
 */
export function localBranchNameForRemote(
  remoteName: string,
  locals: readonly { name: string }[],
): string | undefined {
  const short = remoteTrackingShortName(remoteName)
  return short !== undefined && locals.some(row => row.name === short) ? short : undefined
}

/** `origin/foo` → `foo`; rejects a name with no remote prefix. */
export function remoteTrackingShortName(remoteName: string): string | undefined {
  const slash = remoteName.indexOf('/')
  if (slash <= 0 || slash === remoteName.length - 1) return undefined
  return remoteName.slice(slash + 1)
}

export type GitBranchRow = { name: string; remote?: boolean }

/**
 * Remote names from flagged rows, or `origin` when the wire stripped `remote`.
 * @param branches - host.gitBranches rows.
 */
export function gitKnownRemoteNames(branches: readonly GitBranchRow[]): string[] {
  const names = new Set<string>()
  for (const row of branches) {
    if (row.remote !== true) continue
    const slash = row.name.indexOf('/')
    names.add(slash > 0 ? row.name.slice(0, slash) : row.name)
  }
  if (names.size === 0) names.add('origin')
  return [...names]
}

/** `origin`, `origin/HEAD`, or a remote name with no branch. */
export function isGitRemoteHeadName(name: string, remotes: readonly string[]): boolean {
  return name === 'HEAD' || name.endsWith('/HEAD') || remotes.includes(name)
}

/**
 * Remote-tracking row: host flag, or `origin/foo` after the client schema
 * stripped `remote` (zod default).
 */
export function isRemoteTrackingRow(row: GitBranchRow, remotes: readonly string[]): boolean {
  if (row.remote === true) return true
  return remotes.some(remote => row.name === remote || row.name.startsWith(`${remote}/`))
}

/** One row in the branch picker (section heading or a ref). */
export type GitBranchPickerItem = {
  id: string
  label: string
  heading?: boolean
}

/**
 * Local refs first, then remote-tracking refs that are not already local.
 * @param branches - host.gitBranches rows.
 * @param labels - section titles.
 */
export function gitBranchPickerItems(
  branches: readonly GitBranchRow[],
  labels: { local: string; remote: string },
): GitBranchPickerItem[] {
  const remotes = gitKnownRemoteNames(branches)
  const localRows = branches.filter(row => (
    !isRemoteTrackingRow(row, remotes) && !isGitRemoteHeadName(row.name, remotes)
  ))
  const localNames = new Set(localRows.map(row => row.name))
  const remoteRows = branches.filter((row) => {
    if (!isRemoteTrackingRow(row, remotes) || isGitRemoteHeadName(row.name, remotes)) return false
    const short = remoteTrackingShortName(row.name)
    return short !== undefined && !localNames.has(short)
  })
  const out: GitBranchPickerItem[] = []
  if (localRows.length > 0) {
    out.push({ id: 'heading-local', label: labels.local, heading: true })
    for (const row of localRows) out.push({ id: row.name, label: row.name })
  }
  if (remoteRows.length > 0) {
    out.push({ id: 'heading-remote', label: labels.remote, heading: true })
    for (const row of remoteRows) out.push({ id: `remote:${row.name}`, label: row.name })
  }
  return out
}

/**
 * Picker id → `git switch` name. Never returns a remote-tracking ref;
 * `origin/foo` becomes local `foo` (existing or `--guess`).
 */
export function gitCheckoutNameForPicker(
  id: string,
  branches: readonly GitBranchRow[],
): string | undefined {
  const remotes = gitKnownRemoteNames(branches)
  const raw = id.startsWith('remote:') ? id.slice('remote:'.length) : id
  if (isGitRemoteHeadName(raw, remotes)) return undefined
  const locals = branches.filter(row => !isRemoteTrackingRow(row, remotes))
  if (id.startsWith('remote:') || isRemoteTrackingRow({ name: raw }, remotes)) {
    return localBranchNameForRemote(raw, locals) ?? remoteTrackingShortName(raw)
  }
  return raw
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
