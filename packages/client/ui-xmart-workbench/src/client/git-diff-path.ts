/**
 * Encode / decode the hidden diff tab's path seed (`side:relpath` or
 * `commit:<hash>`), optionally pinning the absolute git root after RS.
 */
import type { GitDiffSide } from '@deepseek-ai/dsh-client-runtime/client'

/** Parsed seed for a worktree/staged file or a whole commit. */
export type DiffSeed =
  | { kind: 'side'; side: GitDiffSide; file: string; root?: string }
  | { kind: 'commit'; commit: string; root?: string }

const COMMIT_ID = /^[0-9a-f]{7,40}$/i
/** Separates the visible seed from an optional absolute git root. */
const ROOT_SEP = '\x1e'

/** Parse `worktree:src/a.ts` / `staged:src/a.ts` / `commit:abcdef1`, plus an optional root. */
export function parseDiffPath(path: string | undefined): DiffSeed | undefined {
  if (path === undefined) return undefined
  const split = path.indexOf(ROOT_SEP)
  const body = split >= 0 ? path.slice(0, split) : path
  const root = split >= 0 ? path.slice(split + 1) : ''
  const seed = parseSeedBody(body)
  if (seed === undefined) return undefined
  return root.length > 0 ? { ...seed, root } : seed
}

function parseSeedBody(path: string): DiffSeed | undefined {
  if (path.startsWith('commit:')) {
    const commit = path.slice(7)
    return COMMIT_ID.test(commit) ? { kind: 'commit', commit } : undefined
  }
  const split = path.indexOf(':')
  if (split <= 0) return undefined
  const side = path.slice(0, split)
  const file = path.slice(split + 1)
  if ((side !== 'worktree' && side !== 'staged') || file.length === 0) return undefined
  return { kind: 'side', side, file }
}

/**
 * Build the seed path for a worktree/staged diff tab.
 * @param side - compared side.
 * @param file - repository-relative path.
 * @param root - absolute repository root when it is not the session cwd.
 */
export function encodeDiffPath(side: GitDiffSide, file: string, root?: string): string {
  return withRoot(`${side}:${file}`, root)
}

/**
 * Build the seed path for a commit diff tab.
 * @param commit - 7–40 hex commit id.
 * @param root - absolute repository root when it is not the session cwd.
 */
export function encodeCommitDiffPath(commit: string, root?: string): string {
  return withRoot(`commit:${commit}`, root)
}

function withRoot(seed: string, root?: string): string {
  return root !== undefined && root.length > 0 ? `${seed}${ROOT_SEP}${root}` : seed
}

/**
 * Tab title: short hash plus a clipped subject.
 * @param hash - full or abbreviated commit id.
 * @param subject - first line of the commit message.
 */
export function commitDiffTitle(hash: string, subject: string): string {
  const short = hash.slice(0, 7)
  const text = subject.trim()
  if (text === '') return short
  return text.length > 48 ? `${short} ${text.slice(0, 47)}…` : `${short} ${text}`
}
