/**
 * SCM list over host.gitStatus: branch + changed files, Cursor-style letters.
 */
import clsx from 'clsx'
import type { GitChange, GitFileStatus, GitStatus } from '@deepseek-ai/dsh-client-runtime/client'
import css from './GitPanel.module.css'

export interface GitPanelLabels {
  loading: string
  empty: string
  missing: string
  error: string
  retry: string
  detached: string
}

export type GitPanelState =
  | { phase: 'loading' }
  | { phase: 'ready'; status: GitStatus }
  | { phase: 'missing' }
  | { phase: 'error' }

export function GitPanel({
  state, openFile, onOpen, onRetry, labels,
}: {
  state: GitPanelState
  openFile: string | undefined
  onOpen: (absolutePath: string) => void
  onRetry: () => void
  labels: GitPanelLabels
}) {
  if (state.phase === 'loading') {
    return <div className={css.note}>{labels.loading}</div>
  }
  if (state.phase === 'missing') {
    return <div className={css.note}>{labels.missing}</div>
  }
  if (state.phase === 'error') {
    return (
      <div className={css.note}>
        <span>{labels.error}</span>
        <button type="button" className={css.retry} onClick={onRetry}>{labels.retry}</button>
      </div>
    )
  }
  const { status } = state
  if (status.changes.length === 0) {
    return (
      <div className={css.wrap}>
        <Branch status={status} detachedLabel={labels.detached} />
        <div className={css.note}>{labels.empty}</div>
      </div>
    )
  }
  return (
    <div className={css.wrap}>
      <Branch status={status} detachedLabel={labels.detached} />
      <div className={css.list}>
        {status.changes.map(change => (
          <button
            key={change.path}
            type="button"
            className={clsx(css.row, openFile === absPath(status.root, change.path) && css.active)}
            onClick={() => { onOpen(absPath(status.root, change.path)) }}
          >
            <span className={css.path} title={change.path}>{change.path}</span>
            <span className={clsx(css.mark, markClass(change.status))} aria-hidden>
              {letter(change.status)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Branch({ status, detachedLabel }: { status: GitStatus; detachedLabel: string }) {
  const track = status.ahead > 0 || status.behind > 0
    ? ` ↑${status.ahead} ↓${status.behind}`
    : ''
  return (
    <div className={css.branch}>
      {status.detached ? detachedLabel : status.branch}{track}
    </div>
  )
}

export function absPath(root: string, relative: string): string {
  const sep = root.includes('\\') ? '\\' : '/'
  return `${root.replace(/[\\/]+$/, '')}${sep}${relative.replaceAll('/', sep)}`
}

export function letter(status: GitFileStatus): string {
  if (status === 'modified') return 'M'
  if (status === 'added') return 'A'
  if (status === 'deleted') return 'D'
  if (status === 'untracked') return 'U'
  if (status === 'renamed') return 'R'
  return 'C'
}

export function markClass(status: GitFileStatus): string {
  if (status === 'modified') return css.modified
  if (status === 'added' || status === 'untracked') return css.added
  if (status === 'deleted' || status === 'conflict') return css.deleted
  return css.renamed
}

export function indexGitChanges(status: GitStatus): Record<string, GitFileStatus> {
  const map: Record<string, GitFileStatus> = {}
  for (const change of status.changes) {
    map[absPath(status.root, change.path)] = change.status
  }
  return map
}

export type { GitChange }
