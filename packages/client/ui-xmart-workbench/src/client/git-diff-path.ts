/**
 * Encode / decode the hidden diff tab's path seed (`side:relpath`).
 */
import type { GitDiffSide } from '@deepseek-ai/dsh-client-runtime/client'

/** Parse `worktree:src/a.ts` / `staged:src/a.ts`. */
export function parseDiffPath(path: string | undefined): { side: GitDiffSide; file: string } | undefined {
  if (path === undefined) return undefined
  const split = path.indexOf(':')
  if (split <= 0) return undefined
  const side = path.slice(0, split)
  const file = path.slice(split + 1)
  if ((side !== 'worktree' && side !== 'staged') || file.length === 0) return undefined
  return { side, file }
}

/**
 * Build the seed path for a diff tab.
 * @param side - compared side.
 * @param file - repository-relative path.
 */
export function encodeDiffPath(side: GitDiffSide, file: string): string {
  return `${side}:${file}`
}
