/**
 * Encode / decode the hidden diff tab's path seed (`side:relpath` or `commit:<hash>`).
 */
import type { GitDiffSide } from '@deepseek-ai/dsh-client-runtime/client'

/** Parsed seed for a worktree/staged file or a whole commit. */
export type DiffSeed =
  | { kind: 'side'; side: GitDiffSide; file: string }
  | { kind: 'commit'; commit: string }

const COMMIT_ID = /^[0-9a-f]{7,40}$/i

/** Parse `worktree:src/a.ts` / `staged:src/a.ts` / `commit:abcdef1`. */
export function parseDiffPath(path: string | undefined): DiffSeed | undefined {
  if (path === undefined) return undefined
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
 */
export function encodeDiffPath(side: GitDiffSide, file: string): string {
  return `${side}:${file}`
}

/**
 * Build the seed path for a commit diff tab.
 * @param commit - 7–40 hex commit id.
 */
export function encodeCommitDiffPath(commit: string): string {
  return `commit:${commit}`
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
