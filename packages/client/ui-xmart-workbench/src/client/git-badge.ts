/**
 * SCM change counts for the Git activity-bar bubble and section pills.
 * Staged + unstaged is the Cursor-style icon summary.
 */
import type { FileListing, GitChange, GitStatus } from '@deepseek-ai/dsh-client-runtime/client'
import { discoverGitRoots, gitRootKey, gitWorkspaceSeeds } from './git-root.ts'

/** Per-session counts plus the repo the numbers came from. */
export type GitBadgeSnapshot = {
  staged: number
  unstaged: number
  root: string | undefined
}

/** Empty badge (clean tree, missing repo, or not loaded yet). */
export const EMPTY_GIT_BADGE: GitBadgeSnapshot = {
  staged: 0,
  unstaged: 0,
  root: undefined,
}

const BADGE_CAP = 1000
const BADGE_CAP_LABEL = '1k+'

/**
 * Count index vs worktree rows. A path in both areas counts twice, like Cursor.
 * @param changes - host.gitStatus rows.
 */
export function gitChangeCounts(changes: readonly GitChange[]): Pick<GitBadgeSnapshot, 'staged' | 'unstaged'> {
  let staged = 0
  let unstaged = 0
  for (const change of changes) {
    if (change.area === 'index') staged += 1
    else unstaged += 1
  }
  return { staged, unstaged }
}

/** Staged + unstaged for the activity-bar summary. */
export function gitBadgeTotal(counts: Pick<GitBadgeSnapshot, 'staged' | 'unstaged'>): number {
  return counts.staged + counts.unstaged
}

/**
 * Visible bubble text. Hidden when there is nothing to show; exact below
 * 1000, then 1k+.
 * @param total - staged + unstaged.
 */
export function gitBadgeLabel(total: number): string | undefined {
  if (total <= 0) return undefined
  return total > BADGE_CAP ? BADGE_CAP_LABEL : String(total)
}

/**
 * Read counts for the activity-bar bubble. Uses the same project repo set as
 * the Git picker and sums staged + unstaged across every work tree.
 * @param cwd - session folder.
 * @param preferredRoot - repo last shown in the Git tab, when it is still in the set.
 * @param workspacePaths - live Workspace registry paths (same seeds as the Git tab).
 * @param gitStatus - host status RPC.
 * @param listEntries - one directory listing (child-repo probe).
 * @param signal - abort when the session or folder changes.
 */
export async function readGitBadgeSnapshot(
  cwd: string | undefined,
  preferredRoot: string | undefined,
  workspacePaths: readonly string[],
  gitStatus: (path: string, signal?: AbortSignal) => Promise<GitStatus>,
  listEntries: (path: string, signal?: AbortSignal) => Promise<FileListing>,
  signal?: AbortSignal,
): Promise<GitBadgeSnapshot> {
  if (cwd === undefined || cwd === '') return { ...EMPTY_GIT_BADGE }
  const roots = await discoverGitRoots(
    cwd,
    gitWorkspaceSeeds(cwd, workspacePaths),
    gitStatus,
    listEntries,
    signal,
  )
  if (roots.length === 0) return { ...EMPTY_GIT_BADGE }
  const hits: GitStatus[] = []
  await Promise.all(roots.map(async (path) => {
    try {
      hits.push(await gitStatus(path, signal))
    }
    catch {
      // Repo vanished between discover and recount.
    }
  }))
  const first = hits[0]
  if (first === undefined) return { ...EMPTY_GIT_BADGE }
  let staged = 0
  let unstaged = 0
  for (const row of hits) {
    const counts = gitChangeCounts(row.changes)
    staged += counts.staged
    unstaged += counts.unstaged
  }
  const preferredKey = typeof preferredRoot === 'string' && preferredRoot !== ''
    ? gitRootKey(preferredRoot)
    : undefined
  const preferred = preferredKey === undefined
    ? undefined
    : hits.find(row => gitRootKey(row.root) === preferredKey)
  return { staged, unstaged, root: preferred?.root ?? first.root }
}

/** In-memory per-session badge store (one per plugin apply). */
export type GitBadgeStore = {
  getSnapshot: (sessionId: string) => GitBadgeSnapshot
  set: (sessionId: string, snap: GitBadgeSnapshot) => void
  subscribe: (fn: () => void) => () => void
}

/**
 * Create the badge store.
 * @returns the store face.
 */
/**
 * Keep the Git icon bubble current without mounting the SCM tab.
 * @param opts - session/cwd facts plus the host RPCs.
 * @returns disposer that aborts the in-flight read.
 */
export function startGitBadgeWatch(opts: {
  getSessionId: () => string | undefined
  getCwd: (sessionId: string) => string | undefined
  getWorkspacePaths: (sessionId: string) => readonly string[]
  gitStatus: (path: string, signal?: AbortSignal) => Promise<GitStatus>
  listEntries: (path: string, signal?: AbortSignal) => Promise<FileListing>
  store: GitBadgeStore
  watch: (fn: () => void) => () => void
}): () => void {
  let controller: AbortController | undefined
  const load = () => {
    const sessionId = opts.getSessionId()
    if (sessionId === undefined) return
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    void readGitBadgeSnapshot(
      opts.getCwd(sessionId),
      opts.store.getSnapshot(sessionId).root,
      opts.getWorkspacePaths(sessionId),
      opts.gitStatus,
      opts.listEntries,
      signal,
    ).then((snap) => {
      if (!signal.aborted) opts.store.set(sessionId, snap)
    })
  }
  const off = opts.watch(load)
  load()
  return () => {
    off()
    controller?.abort()
  }
}

export function createGitBadgeStore(): GitBadgeStore {
  const bySession: Record<string, GitBadgeSnapshot> = {}
  const listeners = new Set<() => void>()
  const emit = () => {
    for (const fn of listeners) fn()
  }
  return {
    getSnapshot: sessionId => bySession[sessionId] ?? EMPTY_GIT_BADGE,
    set: (sessionId, snap) => {
      const prev = bySession[sessionId] ?? EMPTY_GIT_BADGE
      if (prev.staged === snap.staged && prev.unstaged === snap.unstaged && prev.root === snap.root) return
      bySession[sessionId] = snap
      emit()
    },
    subscribe: (fn) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
  }
}
