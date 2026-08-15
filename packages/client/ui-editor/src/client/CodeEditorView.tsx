/**
 * Editor view: the conversation view tab pairing a workspace file tree with a
 * CodeMirror editor. The session's cwd roots the tree; open file, expanded
 * directories, and unsaved buffers live in the declared store so a tab switch
 * (view-ring remount) restores the same editing state.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { FileAccessError, GitAccessError } from '@deepseek-ai/dsh-client-runtime/client'
import type { FileEntry, FileListing, GitFileStatus, GitStatus } from '@deepseek-ai/dsh-client-runtime/client'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import clsx from 'clsx'
import type { createEditorViewStore } from './editor-store.ts'
import { MonacoHost } from './MonacoHost.tsx'
import { FileTree } from './FileTree.tsx'
import { GitPanel, indexGitChanges, type GitPanelState } from './GitPanel.tsx'
import { MarkdownPreview } from './MarkdownPreview.tsx'
import { isMarkdownPath } from './monaco-highlight.ts'
import css from './CodeEditorView.module.css'

/** Session-bound file callbacks not already supplied by the conversation view slot. */
export interface EditorViewInjected {
  listEntries: (path: string, signal?: AbortSignal) => Promise<FileListing>
  readFile: (path: string, signal?: AbortSignal) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  gitStatus: (path: string, signal?: AbortSignal) => Promise<GitStatus>
}

/** Open-file lifecycle owned by this mount (buffers persist in the store). */
type OpenState =
  | { phase: 'idle' }
  | { phase: 'loading'; path: string }
  | { phase: 'ready'; path: string; initial: string }
  | { phase: 'error'; path: string; kind: 'binary' | 'too-large' | 'read' }

/** Save lifecycle for the status seat. */
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const DRAFT_SYNC_DELAY_MS = 500
const PREVIEW_SYNC_DELAY_MS = 200

type PreviewMode = 'edit' | 'preview' | 'split'
type SideTab = 'files' | 'git'

export function CodeEditorView({
  sessionId, useSessions, useStore, actions, listEntries, readFile, writeFile, gitStatus, t,
}: ConvViewProps
& PropsStore<ReturnType<typeof createEditorViewStore>>
& InjectFace<EditorViewInjected>
& PropsLocale<'editor'>) {
  const root = useSessions(state => state.byId[sessionId]?.cwd)
  const openFileByRoot = useStore(state => state.openFileByRoot)
  const expanded = useStore(state => state.expanded)
  const drafts = useStore(state => state.drafts)
  const openFile = root === undefined ? undefined : openFileByRoot[root]

  const [open, setOpen] = useState<OpenState>({ phase: 'idle' })
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [sideTab, setSideTab] = useState<SideTab>('files')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('split')
  const [previewText, setPreviewText] = useState('')
  const [git, setGit] = useState<GitPanelState>({ phase: 'loading' })
  const [gitByPath, setGitByPath] = useState<Readonly<Record<string, GitFileStatus>>>({})

  // Live edit tracking: content/baseline stay in refs (per-keystroke React
  // state over whole documents would be waste); dirty/save states render.
  const contentRef = useRef('')
  const baselineRef = useRef('')
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const liveRef = useRef<{ path: string; dirty: boolean } | null>(null)

  // The mount-scoped draft flush: covers unmount (tab switch away) so the
  // debounce tail cannot drop the newest keystrokes.
  useEffect(() => () => {
    if (draftTimer.current !== null) clearTimeout(draftTimer.current)
    const live = liveRef.current
    if (live !== null && live.dirty) actions.setDraft(live.path, contentRef.current)
  }, [actions])

  // Open-file loader: a store-selected path that this mount has not opened
  // yet loads (or adopts its unsaved buffer), superseded loads abort.
  useEffect(() => {
    if (openFile === undefined) {
      liveRef.current = null
      setOpen({ phase: 'idle' })
      setDirty(false)
      setSaveState('idle')
      return
    }
    if (liveRef.current?.path === openFile) return
    const draft = drafts[openFile]
    const controller = new AbortController()
    liveRef.current = null
    setOpen({ phase: 'loading', path: openFile })
    setDirty(false)
    setSaveState('idle')
    readFile(openFile, controller.signal).then(
      (content) => {
        if (controller.signal.aborted) return
        baselineRef.current = content
        const initial = draft ?? content
        contentRef.current = initial
        const isDirty = initial !== content
        liveRef.current = { path: openFile, dirty: isDirty }
        setDirty(isDirty)
        setPreviewText(initial)
        if (isMarkdownPath(openFile)) setPreviewMode('split')
        setOpen({ phase: 'ready', path: openFile, initial })
      },
      (reason: unknown) => {
        if (controller.signal.aborted) return
        const code = reason instanceof FileAccessError ? reason.rpcError.code : undefined
        setOpen({
          phase: 'error',
          path: openFile,
          kind: code === 'file-binary' ? 'binary' : code === 'file-too-large' ? 'too-large' : 'read',
        })
      },
    )
    return () => { controller.abort() }
  }, [openFile, drafts, readFile])

  useEffect(() => {
    if (root === undefined) {
      setGit({ phase: 'missing' })
      setGitByPath({})
      return
    }
    const controller = new AbortController()
    setGit({ phase: 'loading' })
    gitStatus(root, controller.signal).then(
      (status) => {
        if (controller.signal.aborted) return
        setGit({ phase: 'ready', status })
        setGitByPath(indexGitChanges(status))
      },
      (reason: unknown) => {
        if (controller.signal.aborted) return
        const code = reason instanceof GitAccessError ? reason.rpcError.code : undefined
        setGit({ phase: code === 'git-unavailable' ? 'missing' : 'error' })
        setGitByPath({})
      },
    )
    return () => { controller.abort() }
  }, [root, refreshNonce, gitStatus])

  const handleChange = useCallback((content: string) => {
    contentRef.current = content
    const live = liveRef.current
    if (live === null) return
    const isDirty = content !== baselineRef.current
    live.dirty = isDirty
    setDirty(isDirty)
    setSaveState('idle')
    if (draftTimer.current !== null) clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => {
      draftTimer.current = null
      actions.setDraft(live.path, isDirty ? content : undefined)
    }, DRAFT_SYNC_DELAY_MS)
    if (previewTimer.current !== null) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => {
      previewTimer.current = null
      setPreviewText(content)
    }, PREVIEW_SYNC_DELAY_MS)
  }, [actions])

  const handleSave = useCallback(() => {
    const live = liveRef.current
    if (live === null || !live.dirty) return
    const path = live.path
    const content = contentRef.current
    setSaveState('saving')
    writeFile(path, content).then(
      () => {
        baselineRef.current = content
        if (liveRef.current?.path === path) {
          liveRef.current.dirty = contentRef.current !== content
          setDirty(liveRef.current.dirty)
        }
        actions.setDraft(path, undefined)
        setSaveState('saved')
        setRefreshNonce(nonce => nonce + 1)
      },
      () => { setSaveState('error') },
    )
  }, [actions, writeFile])

  const handleOpenFile = useCallback((entry: FileEntry) => {
    if (root === undefined) return
    // Hand the outgoing buffer to the store before switching, so returning
    // to that file restores the unsaved edits.
    const live = liveRef.current
    if (live !== null && live.dirty && live.path !== entry.path) {
      if (draftTimer.current !== null) {
        clearTimeout(draftTimer.current)
        draftTimer.current = null
      }
      actions.setDraft(live.path, contentRef.current)
    }
    actions.setOpenFile(root, entry.path)
  }, [actions, root])

  if (root === undefined) {
    return <div className={css.root}><div className={css.placeholder}>{t('editor.noWorkspace')}</div></div>
  }

  return (
    <div className={css.root} data-conversation-composer-overlay="">
      <aside className={css.treePane}>
        <div className={css.treeHeader}>
          <div className={css.sideTabs}>
            <button
              type="button"
              className={clsx(css.sideTab, sideTab === 'files' && css.sideTabActive)}
              onClick={() => { setSideTab('files') }}
            >
              {t('tree.title')}
            </button>
            <button
              type="button"
              className={clsx(css.sideTab, sideTab === 'git' && css.sideTabActive)}
              onClick={() => { setSideTab('git') }}
            >
              {t('git.title')}
            </button>
          </div>
          <Button
            variant="toolbar"
            size="sm"
            onClick={() => { setRefreshNonce(nonce => nonce + 1) }}
          >
            {t('tree.refresh')}
          </Button>
        </div>
        {sideTab === 'files'
          ? (
            <FileTree
              root={root}
              expanded={expanded}
              openFile={openFile}
              dirtyPaths={drafts}
              gitByPath={gitByPath}
              refreshNonce={refreshNonce}
              listEntries={listEntries}
              onToggleDir={(path, isExpanded) => { actions.setExpanded(path, isExpanded) }}
              onOpenFile={handleOpenFile}
              labels={{
                loading: t('tree.loading'),
                empty: t('tree.empty'),
                error: t('tree.error'),
                retry: t('tree.retry'),
                truncated: t('tree.truncated'),
              }}
            />
          )
          : (
            <GitPanel
              state={git}
              openFile={openFile}
              onOpen={(path) => { handleOpenFile({ name: path, path, kind: 'file', hidden: false }) }}
              onRetry={() => { setRefreshNonce(nonce => nonce + 1) }}
              labels={{
                loading: t('git.loading'),
                empty: t('git.empty'),
                missing: t('git.missing'),
                error: t('git.error'),
                retry: t('tree.retry'),
                detached: t('git.detached'),
              }}
            />
          )}
      </aside>
      <section className={css.editorPane}>
        {open.phase === 'idle' && <div className={css.placeholder}>{t('editor.empty')}</div>}
        {open.phase === 'loading' && <div className={css.placeholder}>{t('editor.loading')}</div>}
        {open.phase === 'error' && (
          <div className={css.placeholder}>
            <span className={css.errorText}>
              {open.kind === 'binary'
                ? t('editor.binary')
                : open.kind === 'too-large' ? t('editor.tooLarge') : t('editor.readError')}
            </span>
            <span className={css.errorPath}>{open.path}</span>
          </div>
        )}
        {open.phase === 'ready' && (
          <>
            <div className={css.toolbar}>
              <span className={css.filePath} title={open.path}>{relativeLabel(open.path, root)}</span>
              <span
                className={clsx(
                  css.status,
                  dirty && css.statusDirty,
                  saveState === 'error' && css.statusError,
                )}
              >
                {saveState === 'saving'
                  ? t('editor.saving')
                  : saveState === 'error'
                    ? t('editor.saveError')
                    : dirty ? t('editor.dirty') : saveState === 'saved' ? t('editor.saved') : ''}
              </span>
              {isMarkdownPath(open.path) && (
                <div className={css.modeTabs}>
                  <button type="button" className={clsx(css.modeTab, previewMode === 'edit' && css.modeTabActive)} onClick={() => { setPreviewMode('edit') }}>
                    {t('preview.edit')}
                  </button>
                  <button type="button" className={clsx(css.modeTab, previewMode === 'split' && css.modeTabActive)} onClick={() => { setPreviewMode('split') }}>
                    {t('preview.split')}
                  </button>
                  <button type="button" className={clsx(css.modeTab, previewMode === 'preview' && css.modeTabActive)} onClick={() => { setPreviewMode('preview') }}>
                    {t('preview.preview')}
                  </button>
                </div>
              )}
              <Button
                variant="primary"
                size="sm"
                disabled={!dirty || saveState === 'saving'}
                onClick={handleSave}
              >
                {t('editor.save')}
              </Button>
            </div>
            <div className={css.editorBody}>
              <div className={clsx(css.monacoSeat, isMarkdownPath(open.path) && previewMode === 'preview' && css.hiddenSeat)}>
                <MonacoHost
                  key={open.path}
                  initialValue={open.initial}
                  filePath={open.path}
                  labels={{ loading: t('editor.engineLoading'), error: t('editor.engineError') }}
                  onChange={handleChange}
                  onSave={handleSave}
                />
              </div>
              {isMarkdownPath(open.path) && previewMode !== 'edit' && (
                <MarkdownPreview text={previewText} />
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

/** Workspace-relative display label; outside paths (never expected) show absolute. */
function relativeLabel(path: string, root: string): string {
  if (path.startsWith(`${root}/`) || path.startsWith(`${root}\\`)) {
    return path.slice(root.length + 1)
  }
  return path
}
