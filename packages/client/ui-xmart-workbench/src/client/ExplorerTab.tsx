/**
 * Explorer tab: lazy file tree, create file/folder, copy paths, @ into
 * the composer, and open-in-system. Rename/delete wait on host remotes.
 */
import { useEffect, useState } from 'react'
import { Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { FileEntry, FileListing, GitFileStatus, GitStatus } from '@deepseek-ai/dsh-client-runtime/client'
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import type { WorkbenchFilesStore } from './files-store.ts'
import { FileTree } from './FileTree.tsx'
import { homeOf, type ExplorerRoot } from './explorer-roots.ts'
import { indexGitChanges } from './git-marks.ts'
import { dirname, isSingleSegment, joinPath, relativeTo } from './route-file.ts'
import css from './ExplorerTab.module.css'

/** Locale thunk. */
type Translate = (key: WorkbenchKey) => string

/** Inline create form: kind plus the directory the name is created in. */
type CreateState = { kind: 'file' | 'folder'; parent: string } | null

/** Context-menu target. */
type MenuTarget = { entry: FileEntry; x: number; y: number }

/** Explorer callbacks closed over from apply. */
export type ExplorerTabProps = TabBodyProps & {
  t: Translate
  getRoots: (sessionId: string) => readonly ExplorerRoot[]
  watchSessions: (fn: () => void) => () => void
  listEntries: (path: string, signal?: AbortSignal) => Promise<FileListing>
  gitStatus: (path: string, signal?: AbortSignal) => Promise<GitStatus>
  writeFile: (path: string, content: string) => Promise<void>
  createDirectory: (path: string, name: string) => Promise<string>
  openSystem: (path: string) => Promise<void>
  openFile: (path: string) => void
  mentionFile: (path: string) => void
  files: WorkbenchFilesStore
  getActivePath?: (sessionId: string) => string | undefined
  watchWorkbench?: (fn: () => void) => () => void
}

/** Explorer tab body (see module doc). */
export function ExplorerTab({
  sessionId, t, getRoots, watchSessions, listEntries, gitStatus,
  writeFile, createDirectory, openSystem, openFile, mentionFile, files,
  getActivePath, watchWorkbench,
}: ExplorerTabProps) {
  const [roots, setRoots] = useState(() => getRoots(sessionId))
  const [snap, setSnap] = useState(() => files.getSnapshot())
  const [activePath, setActivePath] = useState(() => getActivePath?.(sessionId))
  const [gitByPath, setGitByPath] = useState<Readonly<Record<string, GitFileStatus>>>({})
  const [create, setCreate] = useState<CreateState>(null)
  const [name, setName] = useState('')
  const [menu, setMenu] = useState<MenuTarget | null>(null)
  const rootsKey = roots.map(root => root.path).join('\0')

  useEffect(() => {
    setRoots(getRoots(sessionId))
    return watchSessions(() => { setRoots(getRoots(sessionId)) })
  }, [getRoots, sessionId, watchSessions])
  useEffect(() => files.subscribe(() => { setSnap(files.getSnapshot()) }), [files])
  useEffect(() => {
    if (watchWorkbench === undefined) return
    return watchWorkbench(() => { setActivePath(getActivePath?.(sessionId)) })
  }, [getActivePath, sessionId, watchWorkbench])

  useEffect(() => {
    if (roots.length === 0) {
      setGitByPath({})
      return
    }
    const controller = new AbortController()
    void Promise.all(roots.map(root => gitStatus(root.path, controller.signal).then(
      indexGitChanges,
      () => ({}) as Record<string, GitFileStatus>,
    ))).then((maps) => {
      if (controller.signal.aborted) return
      const merged: Record<string, GitFileStatus> = {}
      for (const map of maps) Object.assign(merged, map)
      setGitByPath(merged)
    })
    return () => { controller.abort() }
  }, [roots, rootsKey, snap.refreshNonce, gitStatus])

  if (roots.length === 0) {
    return <div className={css.note} data-testid="xmart-workbench-explorer">{t('explorer.noWorkspace')}</div>
  }

  const expanded = snap.expanded[sessionId] ?? {}

  const submitCreate = () => {
    if (create === null || !isSingleSegment(name)) return
    const trimmed = name.trim()
    const done = () => {
      setCreate(null)
      setName('')
      files.bumpRefresh()
    }
    if (create.kind === 'folder') {
      void createDirectory(create.parent, trimmed).then(done, () => {})
      return
    }
    void writeFile(joinPath(create.parent, trimmed), '').then(done, () => {})
  }

  return (
    <div className={css.root} data-testid="xmart-workbench-explorer">
      {create !== null && (
        <form
          className={css.form}
          onSubmit={(event) => {
            event.preventDefault()
            submitCreate()
          }}
        >
          <input
            className={css.input}
            value={name}
            placeholder={create.kind === 'folder' ? t('explorer.folderName') : t('explorer.fileName')}
            onChange={(event) => { setName(event.target.value) }}
            aria-label={create.kind === 'folder' ? t('explorer.folderName') : t('explorer.fileName')}
          />
          <button type="submit" className={css.tool}>{t('explorer.create')}</button>
          <button type="button" className={css.tool} onClick={() => { setCreate(null) }}>{t('explorer.cancel')}</button>
        </form>
      )}
      <div className={css.treeWrap}>
        {roots.map((root, index) => (
          <div key={index} data-testid={`xmart-workbench-root-${root.title}`}>
            {roots.length > 1 && <div className={css.section}>{root.title}</div>}
            <FileTree
              root={root.path}
              expanded={expanded}
              openFile={activePath}
              dirtyPaths={snap.drafts}
              gitByPath={gitByPath}
              refreshNonce={snap.refreshNonce}
              listEntries={listEntries}
              onToggleDir={(path, next) => { files.setExpanded(sessionId, path, next) }}
              onOpenFile={(entry) => { openFile(entry.path) }}
              onContextMenu={(entry, event) => {
                event.preventDefault()
                setMenu({ entry, x: event.clientX, y: event.clientY })
              }}
              labels={{
                loading: t('explorer.loading'),
                empty: t('explorer.empty'),
                error: t('explorer.error'),
                retry: t('explorer.retry'),
                truncated: t('explorer.truncated'),
              }}
            />
          </div>
        ))}
      </div>
      <Menu
        open={menu !== null}
        onClose={() => { setMenu(null) }}
        portal
        compact
        getAnchorRect={() => menuAnchorRect(menu)}
        items={menuItems(menu?.entry, t)}
        onSelect={(id) => {
          const target = menu?.entry
          setMenu(null)
          /* v8 ignore next -- Menu only selects while a row is open. */
          if (target === undefined) return
          if (id === 'new-file' || id === 'new-folder') {
            setCreate({ kind: id === 'new-file' ? 'file' : 'folder', parent: parentOf(target) })
            setName('')
            return
          }
          if (id === 'copy-abs') {
            void navigator.clipboard.writeText(target.path)
            return
          }
          if (id === 'copy-rel') {
            void navigator.clipboard.writeText(relativeTo(homeOf(target.path, roots), target.path))
            return
          }
          if (id === 'mention' && target.kind !== 'directory') mentionFile(target.path)
          if (id === 'system') void openSystem(target.path)
        }}
        anchor={<span data-testid="xmart-workbench-explorer-menu-anchor" />}
      />
    </div>
  )
}

/**
 * Portal anchor for a right-click menu (or the origin when it is closed).
 * @param menu - click target, or null.
 */
export function menuAnchorRect(menu: MenuTarget | null): DOMRect {
  const x = menu?.x ?? 0
  const y = menu?.y ?? 0
  return { top: y, left: x, bottom: y, right: x, width: 0, height: 0, x, y, toJSON: () => ({}) }
}

/**
 * Directory a context-menu create lands in: the folder itself, or a
 * file's parent.
 * @param entry - right-clicked row.
 */
export function parentOf(entry: FileEntry): string {
  return entry.kind === 'directory' ? entry.path : dirname(entry.path)
}

function menuItems(entry: FileEntry | undefined, t: Translate) {
  const file = entry !== undefined && entry.kind !== 'directory'
  return [
    { id: 'new-file', label: t('explorer.newFile'), disabled: entry === undefined },
    { id: 'new-folder', label: t('explorer.newFolder'), disabled: entry === undefined },
    { id: 'copy-rel', label: t('explorer.copyRel'), disabled: entry === undefined },
    { id: 'copy-abs', label: t('explorer.copyAbs'), disabled: entry === undefined },
    { id: 'mention', label: t('explorer.mention'), disabled: !file },
    { id: 'system', label: t('explorer.openSystem'), disabled: entry === undefined },
    { id: 'rename', label: t('explorer.renameUnavailable'), disabled: true },
    { id: 'delete', label: t('explorer.deleteUnavailable'), disabled: true },
  ]
}
