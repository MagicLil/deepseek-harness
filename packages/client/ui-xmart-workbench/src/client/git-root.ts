/**
 * Resolve which directory the Git panel should talk to. The session cwd is
 * often a multi-project folder (VS Code multi-root parent) whose repos live
 * in immediate children — `git -C <cwd>` then fails even though the user
 * has real repositories.
 */
import { GitAccessError } from '@deepseek-ai/dsh-client-runtime/client'
import type { FileListing, GitLogEntry, GitStatus } from '@deepseek-ai/dsh-client-runtime/client'
import { GIT_LOG_PAGE_SIZE } from './git-log-page.ts'

/** Host / wire error code on a thrown git failure, when any. */
export function gitErrorCode(reason: unknown): string | undefined {
  return reason instanceof GitAccessError ? reason.rpcError.code : undefined
}

/** True when the Host said this path is not a work tree (or git is missing). */
export function isGitUnavailable(reason: unknown): boolean {
  return gitErrorCode(reason) === 'git-unavailable'
}

/** Message from a GitAccessError, or undefined for a plain throw. */
export function gitErrorMessage(reason: unknown): string | undefined {
  return reason instanceof GitAccessError ? reason.rpcError.message : undefined
}

/**
 * Absolute paths of visible (non-hidden) child directories.
 * @param listing - one `listEntries` page.
 */
export function visibleChildDirectories(listing: FileListing): string[] {
  return listing.entries
    .filter(entry => entry.kind === 'directory' && !entry.hidden)
    .map(entry => entry.path)
}

/** One successful status+log read, or a classified failure. */
export type GitSnapshot =
  | { ok: true; status: GitStatus; log: GitLogEntry[] }
  | { ok: false; unavailable: boolean; message: string | undefined }

/**
 * Read status and log for one root. A log failure does not hide a good status.
 * @param root - workspace cwd or a discovered child repo.
 * @param gitStatus - host status RPC.
 * @param gitLog - host log RPC.
 * @param signal - abort both calls.
 */
export async function readGitSnapshot(
  root: string,
  gitStatus: (path: string, signal?: AbortSignal) => Promise<GitStatus>,
  gitLog: (path: string, limit?: number, signal?: AbortSignal, skip?: number) => Promise<GitLogEntry[]>,
  signal?: AbortSignal,
): Promise<GitSnapshot> {
  let status: GitStatus
  try {
    status = await gitStatus(root, signal)
  }
  catch (reason: unknown) {
    return {
      ok: false,
      unavailable: isGitUnavailable(reason),
      message: gitErrorMessage(reason),
    }
  }
  let log: GitLogEntry[] = []
  try {
    const rows = await gitLog(root, GIT_LOG_PAGE_SIZE)
    log = Array.isArray(rows) ? rows : []
  }
  catch {
    log = []
  }
  return { ok: true, status, log }
}

/**
 * Probe sibling directories and return those that are git work trees.
 * @param paths - absolute child directories.
 * @param gitStatus - host status RPC.
 * @param signal - abort the probes.
 */
export async function probeGitRoots(
  paths: readonly string[],
  gitStatus: (path: string, signal?: AbortSignal) => Promise<GitStatus>,
  signal?: AbortSignal,
): Promise<string[]> {
  const found: string[] = []
  await Promise.all(paths.map(async (path) => {
    try {
      const status = await gitStatus(path, signal)
      found.push(status.root)
    }
    catch {
      // Child is not a repo, or this probe was aborted.
    }
  }))
  return uniqueGitPaths(found).sort((a, b) => a.localeCompare(b))
}

/**
 * Compare repository / workspace folders across Windows and POSIX spellings.
 * @param path - absolute folder.
 */
export function gitRootKey(path: string): string {
  return path.replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase()
}

/**
 * Drop empty entries and collapse slash / drive-letter spellings.
 * @param paths - candidate folders.
 */
export function uniqueGitPaths(paths: readonly (string | undefined)[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const path of paths) {
    if (typeof path !== 'string' || path === '') continue
    const key = gitRootKey(path)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(path)
  }
  return out
}

/**
 * Workspace folders the Git picker may probe: the current project and
 * registered folders under it. Sibling / parent / other-rail projects stay out.
 * @param cwd - session / explorer folder, when any.
 * @param workspacePaths - live Workspace registry paths.
 */
export function gitWorkspaceSeeds(
  cwd: string | undefined,
  workspacePaths: readonly string[],
): string[] {
  const seeds = uniqueGitPaths(
    typeof cwd === 'string' && cwd !== '' ? [cwd, ...workspacePaths] : workspacePaths,
  )
  if (typeof cwd !== 'string' || cwd === '') return seeds
  const cwdKey = gitRootKey(cwd)
  return seeds.filter((path) => {
    const key = gitRootKey(path)
    return key === cwdKey || key.startsWith(`${cwdKey}/`)
  })
}

/**
 * Find git work trees from the session cwd and the supplied Workspace seeds.
 * A seed that is not itself a work tree contributes its immediate visible
 * children (a VS Code multi-root parent sitting beside an already-open repo).
 * @param cwd - session folder, when any.
 * @param workspacePaths - live Workspace registry paths.
 * @param gitStatus - host status RPC.
 * @param listEntries - one directory listing (child-repo probe).
 * @param signal - abort the probes.
 */
export async function discoverGitRoots(
  cwd: string | undefined,
  workspacePaths: readonly string[],
  gitStatus: (path: string, signal?: AbortSignal) => Promise<GitStatus>,
  listEntries: (path: string, signal?: AbortSignal) => Promise<FileListing>,
  signal?: AbortSignal,
): Promise<string[]> {
  const found: string[] = []
  const seen = new Set<string>()
  const add = (root: string) => {
    const key = gitRootKey(root)
    if (seen.has(key)) return
    seen.add(key)
    found.push(root)
  }
  await Promise.all(uniqueGitPaths([cwd, ...workspacePaths]).map(async (path) => {
    try {
      add((await gitStatus(path, signal)).root)
      return
    }
    catch (reason: unknown) {
      if (!isGitUnavailable(reason) || signal?.aborted === true) return
    }
    try {
      const nested = await probeGitRoots(
        visibleChildDirectories(await listEntries(path, signal)),
        gitStatus,
        signal,
      )
      for (const root of nested) add(root)
    }
    catch {
      // Listing failed, or this probe was aborted.
    }
  }))
  return found.sort((a, b) => a.localeCompare(b))
}
