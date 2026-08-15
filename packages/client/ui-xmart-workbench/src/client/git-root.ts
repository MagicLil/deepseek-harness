/**
 * Resolve which directory the Git panel should talk to. The session cwd is
 * often a multi-project folder (VS Code multi-root parent) whose repos live
 * in immediate children — `git -C <cwd>` then fails even though the user
 * has real repositories.
 */
import { GitAccessError } from '@deepseek-ai/dsh-client-runtime/client'
import type { FileListing, GitLogEntry, GitStatus } from '@deepseek-ai/dsh-client-runtime/client'

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
  gitLog: (path: string, limit?: number) => Promise<GitLogEntry[]>,
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
    const rows = await gitLog(root, 80)
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
  return [...new Set(found)].sort((a, b) => a.localeCompare(b))
}
