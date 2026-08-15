/**
 * Lazy workspace tree over an injected listEntries callback. Expansion
 * lives in the owner's store so a remount restores open subtrees.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import type { FileEntry, FileListing, GitFileStatus } from '@deepseek-ai/dsh-client-runtime/client'
import { letter, markKind } from './git-marks.ts'
import { isUnder } from './route-file.ts'
import { FileIcon } from './FileIcon.tsx'
import css from './FileTree.module.css'

/** One directory level's load state. */
type DirLevel =
  | { status: 'loading' }
  | { status: 'ready'; entries: readonly FileEntry[]; truncated: boolean }
  | { status: 'error'; message: string }

/** Localized copy the tree renders. */
export interface FileTreeLabels {
  loading: string
  empty: string
  error: string
  retry: string
  truncated: string
}

/** File-tree props (inject-only; no ctx). */
export interface FileTreeProps {
  root: string
  expanded: Readonly<Record<string, boolean>>
  openFile: string | undefined
  dirtyPaths: Readonly<Record<string, string>>
  gitByPath: Readonly<Record<string, GitFileStatus>>
  refreshNonce: number
  listEntries: (path: string, signal?: AbortSignal) => Promise<FileListing>
  onToggleDir: (path: string, expanded: boolean) => void
  onOpenFile: (entry: FileEntry) => void
  onContextMenu?: (entry: FileEntry, event: MouseEvent) => void
  labels: FileTreeLabels
}

/** Lazy workspace tree (see module doc). */
export function FileTree({
  root, expanded, openFile, dirtyPaths, gitByPath, refreshNonce,
  listEntries, onToggleDir, onOpenFile, onContextMenu, labels,
}: FileTreeProps) {
  const [levels, setLevels] = useState<ReadonlyMap<string, DirLevel>>(new Map())
  const levelsRef = useRef(levels)
  levelsRef.current = levels
  const inflight = useRef(new Map<string, AbortController>())

  const ensureLoaded = useCallback((path: string) => {
    if (levelsRef.current.has(path) || inflight.current.has(path)) return
    const controller = new AbortController()
    inflight.current.set(path, controller)
    setLevels(current => new Map(current).set(path, { status: 'loading' }))
    listEntries(path, controller.signal).then(
      (listing) => {
        inflight.current.delete(path)
        if (controller.signal.aborted) return
        setLevels(current => new Map(current).set(path, {
          status: 'ready', entries: listing.entries, truncated: listing.truncated,
        }))
      },
      (reason: unknown) => {
        inflight.current.delete(path)
        if (controller.signal.aborted) return
        setLevels(current => new Map(current).set(path, {
          status: 'error',
          message: reason instanceof Error ? reason.message : String(reason),
        }))
      },
    )
  }, [listEntries])

  useEffect(() => {
    for (const controller of inflight.current.values()) controller.abort()
    inflight.current.clear()
    // Drop the ref now so the load effect in this same flush can refetch.
    levelsRef.current = new Map()
    setLevels(new Map())
  }, [root, refreshNonce])
  useEffect(() => () => {
    for (const controller of inflight.current.values()) controller.abort()
    inflight.current.clear()
  }, [])
  useEffect(() => {
    ensureLoaded(root)
    for (const path of Object.keys(expanded)) {
      if (expanded[path] === true && isUnder(path, root)) ensureLoaded(path)
    }
  })

  const renderLevel = (path: string, depth: number): ReactNode => {
    const level = levels.get(path)
    if (level === undefined || level.status === 'loading') {
      return <div className={css.note} style={indent(depth)}>{labels.loading}</div>
    }
    if (level.status === 'error') {
      return (
        <div className={css.note} style={indent(depth)}>
          <span className={css.errorText}>{labels.error}</span>
          <button
            type="button"
            className={css.retry}
            onClick={() => {
              setLevels((current) => {
                const next = new Map(current)
                next.delete(path)
                return next
              })
            }}
          >
            {labels.retry}
          </button>
        </div>
      )
    }
    if (level.entries.length === 0) {
      return <div className={css.note} style={indent(depth)}>{labels.empty}</div>
    }
    return (
      <>
        {level.entries.map(entry => entry.kind === 'directory'
          ? (
            <div key={entry.path}>
              <button
                type="button"
                className={rowClass(entry.hidden, false, false)}
                style={indent(depth)}
                onClick={() => { onToggleDir(entry.path, expanded[entry.path] !== true) }}
                onContextMenu={(event) => { onContextMenu?.(entry, event) }}
              >
                <span className={expanded[entry.path] === true ? `${css.chevron} ${css.chevronOpen}` : css.chevron} aria-hidden>
                  ›
                </span>
                <FileIcon path={entry.name} kind="directory" expanded={expanded[entry.path] === true} />
                <span className={css.name}>{entry.name}</span>
                <GitLetter status={gitByPath[entry.path]} />
              </button>
              {expanded[entry.path] === true && entry.path !== path
                && renderLevel(entry.path, depth + 1)}
            </div>
          )
          : (
            <button
              key={entry.path}
              type="button"
              className={rowClass(entry.hidden, true, openFile === entry.path)}
              style={indent(depth)}
              data-path={entry.path}
              data-active={openFile === entry.path || undefined}
              onClick={() => { onOpenFile(entry) }}
              onContextMenu={(event) => { onContextMenu?.(entry, event) }}
            >
              <span className={css.chevronSpacer} aria-hidden />
              <FileIcon path={entry.name} kind="file" />
              <span className={nameClass(gitByPath[entry.path])}>{entry.name}</span>
              <GitLetter status={gitByPath[entry.path]} />
              {dirtyPaths[entry.path] !== undefined && <span className={css.dirtyDot} aria-hidden />}
            </button>
          ))}
        {level.truncated && <div className={css.note} style={indent(depth)}>{labels.truncated}</div>}
      </>
    )
  }

  return <div className={css.tree} data-testid="xmart-workbench-tree">{renderLevel(root, 0)}</div>
}

export { isUnder } from './route-file.ts'

function indent(depth: number): { paddingLeft: string } {
  return { paddingLeft: `${8 + depth * 14}px` }
}

function rowClass(hidden: boolean, file: boolean, active: boolean): string {
  const parts = [css.row]
  if (file) parts.push(css.fileRow)
  if (hidden) parts.push(css.hidden)
  if (active) parts.push(css.active)
  return parts.join(' ')
}

function nameClass(status: GitFileStatus | undefined): string {
  /* v8 ignore next -- CSS modules always emit these class names. */
  const base = css.name ?? ''
  if (status === undefined) return base
  const color = css[markKind(status)]
  /* v8 ignore next -- CSS modules always emit status color classes. */
  return color === undefined ? base : `${base} ${color}`
}

function GitLetter({ status }: { status: GitFileStatus | undefined }) {
  if (status === undefined) return null
  /* v8 ignore next -- CSS modules always emit these class names. */
  const mark = css.gitMark ?? ''
  const color = css[markKind(status)]
  /* v8 ignore next -- CSS modules always emit status color classes. */
  return <span className={color === undefined ? mark : `${mark} ${color}`} aria-hidden>{letter(status)}</span>
}
