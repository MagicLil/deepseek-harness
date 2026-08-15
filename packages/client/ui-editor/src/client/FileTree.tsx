/**
 * FileTree: lazy workspace tree over the injected listEntries callback.
 * Directory levels load on first expansion (and reload after the owner bumps
 * `refreshNonce`); expansion state itself lives in the owner's store, so a
 * view-tab remount restores the same open subtrees.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { FileEntry, FileListing, GitFileStatus } from '@deepseek-ai/dsh-client-runtime/client'
import { letter, markClass } from './GitPanel.tsx'
import css from './FileTree.module.css'

/** One directory level's load state. */
type DirLevel =
  | { status: 'loading' }
  | { status: 'ready'; entries: readonly FileEntry[]; truncated: boolean }
  | { status: 'error'; message: string }

/** Localized copy the tree renders (threaded from the owner's locale seat). */
export interface FileTreeLabels {
  loading: string
  empty: string
  error: string
  retry: string
  truncated: string
}

export function FileTree({
  root, expanded, openFile, dirtyPaths, gitByPath, refreshNonce,
  listEntries, onToggleDir, onOpenFile, labels,
}: {
  /** Absolute workspace root the tree serves. */
  root: string
  /** Expanded directory set (absolute path → true), owner-store backed. */
  expanded: Readonly<Record<string, boolean>>
  /** Currently open file's absolute path, for the active row highlight. */
  openFile: string | undefined
  /** Absolute paths carrying unsaved buffers (dirty dots). */
  dirtyPaths: Readonly<Record<string, string>>
  /** Absolute path → git working-tree status (SCM letters in the tree). */
  gitByPath: Readonly<Record<string, GitFileStatus>>
  /** Bumped by the owner's refresh action; every cached level reloads. */
  refreshNonce: number
  /** Injected listing callback (one level per call). */
  listEntries: (path: string, signal?: AbortSignal) => Promise<FileListing>
  /** Owner's expansion toggle (writes the store). */
  onToggleDir: (path: string, expanded: boolean) => void
  /** Owner's file-open request. */
  onOpenFile: (entry: FileEntry) => void
  labels: FileTreeLabels
}) {
  const [levels, setLevels] = useState<ReadonlyMap<string, DirLevel>>(new Map())
  // Cache mirror + in-flight registry live in refs: loads are keyed one-shot
  // operations, so effect re-runs must not abort them mid-flight. Aborts
  // happen only on unmount and refresh.
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

  // Root/refresh boundary: abort what is in flight and drop the cache; the
  // ensure effect below reloads from the fresh state on its next commit.
  useEffect(() => {
    if (levelsRef.current.size === 0 && inflight.current.size === 0) return
    for (const controller of inflight.current.values()) controller.abort()
    inflight.current.clear()
    setLevels(new Map())
  }, [root, refreshNonce])
  // Unmount: in-flight responses must not land on a dead component.
  useEffect(() => () => {
    for (const controller of inflight.current.values()) controller.abort()
    inflight.current.clear()
  }, [])
  // Keep the root and every expanded directory loaded. Guarded per path, so
  // running on every commit is cheap and re-entrant.
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
              // Dropping the level makes the ensure effect reload it on the
              // commit this state update produces.
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
                className={clsx(css.row, entry.hidden && css.hidden)}
                style={indent(depth)}
                onClick={() => { onToggleDir(entry.path, expanded[entry.path] !== true) }}
              >
                <span className={clsx(css.chevron, expanded[entry.path] === true && css.chevronOpen)} aria-hidden>
                  ›
                </span>
                <span className={css.name}>{entry.name}</span>
                <GitLetter status={gitByPath[entry.path]} />
              </button>
              {expanded[entry.path] === true && renderLevel(entry.path, depth + 1)}
            </div>
          )
          : (
            <button
              key={entry.path}
              type="button"
              className={clsx(css.row, css.fileRow, entry.hidden && css.hidden, openFile === entry.path && css.active)}
              style={indent(depth)}
              onClick={() => { onOpenFile(entry) }}
            >
              <span className={clsx(css.name, gitByPath[entry.path] !== undefined && markClass(gitByPath[entry.path] ?? 'modified'))}>
                {entry.name}
              </span>
              <GitLetter status={gitByPath[entry.path]} />
              {dirtyPaths[entry.path] !== undefined && <span className={css.dirtyDot} aria-hidden />}
            </button>
          ))}
        {level.truncated && <div className={css.note} style={indent(depth)}>{labels.truncated}</div>}
      </>
    )
  }

  return <div className={css.tree}>{renderLevel(root, 0)}</div>
}

/** Whether `path` sits at or below `root` (plain prefix segments; both absolute). */
function isUnder(path: string, root: string): boolean {
  return path === root
    || path.startsWith(`${root}/`)
    || path.startsWith(`${root}\\`)
}

function indent(depth: number): { paddingLeft: string } {
  return { paddingLeft: `${8 + depth * 14}px` }
}

function GitLetter({ status }: { status: GitFileStatus | undefined }) {
  if (status === undefined) return null
  return <span className={clsx(css.gitMark, markClass(status))} aria-hidden>{letter(status)}</span>
}
