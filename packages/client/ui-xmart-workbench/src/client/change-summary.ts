/**
 * Summarize the current git change set for the pre-commit checklist.
 */
import type { GitChange } from '@deepseek-ai/dsh-client-runtime/client'

/** One file line in the generated summary. */
export type ChangeSummaryFile = {
  path: string
  status: string
  area: 'index' | 'worktree'
}

/** Counts plus the file list for this working tree. */
export type ChangeSummary = {
  added: number
  modified: number
  deleted: number
  staged: number
  unstaged: number
  files: readonly ChangeSummaryFile[]
}

/**
 * Count kinds and collect rows from `git status` changes.
 * @param changes - porcelain rows (a path may appear twice).
 */
export function summarizeChanges(changes: readonly GitChange[]): ChangeSummary {
  let added = 0
  let modified = 0
  let deleted = 0
  let staged = 0
  let unstaged = 0
  const files: ChangeSummaryFile[] = []
  for (const change of changes) {
    if (change.area === 'index') staged += 1
    else unstaged += 1
    if (change.status === 'added' || change.status === 'untracked') added += 1
    else if (change.status === 'deleted') deleted += 1
    else modified += 1
    files.push({ path: change.path, status: change.status, area: change.area })
  }
  return { added, modified, deleted, staged, unstaged, files }
}

/**
 * Compact +/~/− headline used in the Git panel.
 * @param summary - counted change set.
 */
export function changeSummaryHeadline(summary: ChangeSummary): string {
  return `+${String(summary.added)} ~${String(summary.modified)} −${String(summary.deleted)}`
}

/**
 * Stable fingerprint of the staged set (resets the confirm checkbox).
 * @param changes - porcelain rows.
 */
export function stagedFingerprint(changes: readonly GitChange[]): string {
  return changes
    .filter(change => change.area === 'index')
    .map(change => `${change.status}:${change.path}`)
    .sort()
    .join('|')
}
