/**
 * Git status letters and tree-row color keys (Cursor-style SCM marks).
 */
import type { GitFileStatus, GitStatus } from '@deepseek-ai/dsh-client-runtime/client'
import { absPath } from './route-file.ts'

/** One-letter SCM mark for a file status. */
export function letter(status: GitFileStatus): string {
  if (status === 'modified') return 'M'
  if (status === 'added') return 'A'
  if (status === 'deleted') return 'D'
  if (status === 'untracked') return 'U'
  if (status === 'renamed') return 'R'
  return 'C'
}

/** CSS module key for a status color. */
export function markKind(status: GitFileStatus): 'modified' | 'added' | 'deleted' | 'renamed' {
  if (status === 'modified') return 'modified'
  if (status === 'added' || status === 'untracked') return 'added'
  if (status === 'deleted' || status === 'conflict') return 'deleted'
  return 'renamed'
}

/**
 * Index git changes by absolute path.
 * @param status - host git status snapshot.
 */
export function indexGitChanges(status: GitStatus): Record<string, GitFileStatus> {
  const map: Record<string, GitFileStatus> = {}
  for (const change of status.changes) {
    map[absPath(status.root, change.path)] = change.status
  }
  return map
}
