/**
 * Hidden editor tab: Monaco + serialized save + drafts + optional Markdown
 * preview + reload banner when an agent mutation touches the open path.
 */
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { FileAccessError } from '@deepseek-ai/dsh-client-runtime/client'
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import type { WorkbenchFilesStore } from './files-store.ts'
import { MonacoHost } from './MonacoHost.tsx'
import { MarkdownPreview } from './MarkdownPreview.tsx'
import { isMarkdownPath } from './language-from-path.ts'
import {
  editorLspOffKey, languageClientFor, missingLanguageRemote,
  type EditorLspRemote, type EditorLspRemotes,
} from './editor-lsp.ts'
import { WORKBENCH_SAVE_EVENT } from './app-menu-dispatch.ts'
import css from './EditorTab.module.css'

/** Locale thunk. */
type Translate = (key: WorkbenchKey) => string

/** Open-file lifecycle. */
type OpenState =
  | { phase: 'idle' }
  | { phase: 'loading'; path: string }
  | { phase: 'ready'; path: string; initial: string }
  | { phase: 'error'; path: string; kind: 'binary' | 'too-large' | 'read' }

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type PreviewMode = 'edit' | 'preview' | 'split'

const DRAFT_SYNC_DELAY_MS = 500

/** Editor callbacks closed over from apply. */
export type EditorTabProps = TabBodyProps & {
  t: Translate
  readFile: (path: string, signal?: AbortSignal) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  files: WorkbenchFilesStore
  workspaceRoot?: string
  vueLsp?: EditorLspRemote
  tsLsp?: EditorLspRemote
  javaLsp?: EditorLspRemote
  /** Live workspace root; preferred over the snapshot `workspaceRoot`. */
  getWorkspaceRoot?: () => string | undefined
  /** Re-read cwd / remotes when the session or workspace list changes. */
  watchWorkspace?: (fn: () => void) => () => void
  /** Live Host namespaces (`remote.javaLsp` may appear after first paint). */
  getRemotes?: () => EditorLspRemotes
  /** Open another path when go-to-definition lands outside this buffer. */
  openFile?: (path: string) => void
}

function staticRemotes(vueLsp?: EditorLspRemote, tsLsp?: EditorLspRemote, javaLsp?: EditorLspRemote): EditorLspRemotes {
  return {
    ...(vueLsp === undefined ? {} : { vueLsp }),
    ...(tsLsp === undefined ? {} : { tsLsp }),
    ...(javaLsp === undefined ? {} : { javaLsp }),
  }
}

/** Editor tab body (see module doc). */
export function EditorTab({
  tab, t, readFile, writeFile, files, workspaceRoot, vueLsp, tsLsp, javaLsp,
  getWorkspaceRoot, watchWorkspace, getRemotes, openFile,
}: EditorTabProps) {
  const path = tab.path
  const [open, setOpen] = useState<OpenState>({ phase: 'idle' })
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('edit')
  const [previewText, setPreviewText] = useState('')
  const [banner, setBanner] = useState(false)
  const [reloadSeen, setReloadSeen] = useState(() => tokenOf(files, path))
  const [root, setRoot] = useState(() => getWorkspaceRoot?.() ?? workspaceRoot)
  const [remotes, setRemotes] = useState(() => getRemotes?.() ?? staticRemotes(vueLsp, tsLsp, javaLsp))
  const contentRef = useRef('')
  const baselineRef = useRef('')
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const liveRef = useRef<{ path: string; dirty: boolean } | null>(null)
  const saveBusyRef = useRef(false)
  const saveQueuedRef = useRef(false)

  useEffect(() => files.subscribe(() => {
    if (path === undefined) return
    if (tokenOf(files, path) !== reloadSeen) setBanner(true)
  }), [files, path, reloadSeen])

  useEffect(() => {
    const refresh = (): void => {
      setRoot(getWorkspaceRoot?.() ?? workspaceRoot)
      setRemotes(getRemotes?.() ?? staticRemotes(vueLsp, tsLsp, javaLsp))
    }
    refresh()
    const off = watchWorkspace?.(refresh)
    const pending = (): boolean => {
      const remotesOf = getRemotes
      return remotesOf !== undefined && path !== undefined && missingLanguageRemote(remotesOf(), path)
    }
    if (getRemotes === undefined || !pending()) {
      return () => { off?.() }
    }
    const id = window.setInterval(() => {
      refresh()
      if (!pending()) window.clearInterval(id)
    }, 400)
    const stop = window.setTimeout(() => { window.clearInterval(id) }, 20_000)
    return () => {
      off?.()
      window.clearInterval(id)
      window.clearTimeout(stop)
    }
  }, [getRemotes, getWorkspaceRoot, javaLsp, path, tsLsp, vueLsp, watchWorkspace, workspaceRoot])

  useEffect(() => () => {
    if (draftTimer.current !== null) clearTimeout(draftTimer.current)
    const live = liveRef.current
    if (live !== null && live.dirty) files.setDraft(live.path, contentRef.current)
  }, [files])

  useEffect(() => {
    if (path === undefined) {
      liveRef.current = null
      setOpen({ phase: 'idle' })
      return
    }
    const draft = files.draftOf(path)
    const controller = new AbortController()
    liveRef.current = null
    setOpen({ phase: 'loading', path })
    setDirty(false)
    setSaveState('idle')
    setBanner(false)
    setReloadSeen(tokenOf(files, path))
    readFile(path, controller.signal).then(
      (content) => {
        if (controller.signal.aborted) return
        const text = fileText(content)
        baselineRef.current = text
        const initial = draft ?? text
        contentRef.current = initial
        const isDirty = initial !== text
        liveRef.current = { path, dirty: isDirty }
        setDirty(isDirty)
        setPreviewText(initial)
        if (isMarkdownPath(path)) setPreviewMode('split')
        setOpen({ phase: 'ready', path, initial })
      },
      (reason: unknown) => {
        if (controller.signal.aborted) return
        const code = reason instanceof FileAccessError ? reason.rpcError.code : undefined
        setOpen({
          phase: 'error',
          path,
          kind: code === 'file-binary' ? 'binary' : code === 'file-too-large' ? 'too-large' : 'read',
        })
      },
    )
    return () => { controller.abort() }
  }, [path, readFile, files])

  const handleChange = useCallback((content: string) => {
    contentRef.current = content
    const live = liveRef.current
    /* v8 ignore next -- Monaco only mounts after the file is ready. */
    if (live === null) return
    const isDirty = content !== baselineRef.current
    live.dirty = isDirty
    setDirty(isDirty)
    setSaveState('idle')
    setPreviewText(content)
    if (draftTimer.current !== null) clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => {
      draftTimer.current = null
      files.setDraft(live.path, isDirty ? content : undefined)
    }, DRAFT_SYNC_DELAY_MS)
  }, [files])

  const handleSave = useCallback(() => {
    const live = liveRef.current
    if (live === null || !live.dirty) return
    if (saveBusyRef.current) {
      saveQueuedRef.current = true
      return
    }
    saveBusyRef.current = true
    setSaveState('saving')
    const flush = (): void => {
      const current = liveRef.current
      /* v8 ignore next -- a remount clears liveRef before this save settles. */
      if (current === null) {
        saveBusyRef.current = false
        saveQueuedRef.current = false
        return
      }
      const target = current.path
      const content = contentRef.current
      if (draftTimer.current !== null) {
        clearTimeout(draftTimer.current)
        draftTimer.current = null
      }
      writeFile(target, content).then(
        () => {
          baselineRef.current = content
          /* v8 ignore next -- a remount replaces liveRef before this save settles. */
          if (liveRef.current?.path === target) {
            liveRef.current.dirty = contentRef.current !== content
            setDirty(liveRef.current.dirty)
          }
          files.setDraft(target, undefined)
          if (saveQueuedRef.current && liveRef.current?.path === target) {
            saveQueuedRef.current = false
            flush()
            return
          }
          saveBusyRef.current = false
          saveQueuedRef.current = false
          setSaveState(liveRef.current?.dirty === true ? 'idle' : 'saved')
        },
        () => {
          saveBusyRef.current = false
          saveQueuedRef.current = false
          setSaveState('error')
        },
      )
    }
    flush()
  }, [files, writeFile])

  useEffect(() => {
    const onMenuSave = (): void => { handleSave() }
    window.addEventListener(WORKBENCH_SAVE_EVENT, onMenuSave)
    return () => { window.removeEventListener(WORKBENCH_SAVE_EVENT, onMenuSave) }
  }, [handleSave])

  const reload = () => {
    /* v8 ignore next -- the reload control only renders for a pathed tab. */
    if (path === undefined) return
    files.setDraft(path, undefined)
    setReloadSeen(tokenOf(files, path))
    setBanner(false)
    setOpen({ phase: 'loading', path })
    void readFile(path).then(
      (content) => {
        const text = fileText(content)
        baselineRef.current = text
        contentRef.current = text
        liveRef.current = { path, dirty: false }
        setDirty(false)
        setPreviewText(text)
        setOpen({ phase: 'ready', path, initial: text })
      },
      () => { setOpen({ phase: 'error', path, kind: 'read' }) },
    )
  }

  if (path === undefined) {
    return <div className={css.note} data-testid="xmart-workbench-editor">{t('editor.noPath')}</div>
  }
  if (open.phase === 'loading' || open.phase === 'idle') {
    return <div className={css.note} data-testid="xmart-workbench-editor">{t('editor.loading')}</div>
  }
  if (open.phase === 'error') {
    const message = open.kind === 'binary'
      ? t('editor.binary')
      : open.kind === 'too-large' ? t('editor.tooLarge') : t('editor.readError')
    return <div className={css.note} data-testid="xmart-workbench-editor">{message}</div>
  }

  const markdown = isMarkdownPath(path)
  const showEditor = previewMode !== 'preview'
  const showPreview = markdown && previewMode !== 'edit'
  const languageClient = languageClientFor(remotes, root, path)
  const offKey = editorLspOffKey(remotes, root, path)

  return (
    <div className={css.root} data-testid="xmart-workbench-editor">
      <div className={css.bar}>
        <div className={css.path} title={path}>{path}</div>
        <span className={saveState === 'error' ? css.error : dirty ? css.dirty : css.status}>
          {saveLabel(saveState, dirty, t)}
        </span>
        {offKey !== undefined && (
          <span className={css.status} data-testid="xmart-workbench-lsp-off">{t(offKey)}</span>
        )}
        <button type="button" className={css.tool} onClick={() => { handleSave() }}>{t('editor.save')}</button>
        {markdown && (
          <>
            <button type="button" className={previewMode === 'edit' ? `${css.tool} ${css.toolActive}` : css.tool} onClick={() => { setPreviewMode('edit') }}>{t('editor.modeEdit')}</button>
            <button type="button" className={previewMode === 'preview' ? `${css.tool} ${css.toolActive}` : css.tool} onClick={() => { setPreviewMode('preview') }}>{t('editor.modePreview')}</button>
            <button type="button" className={previewMode === 'split' ? `${css.tool} ${css.toolActive}` : css.tool} onClick={() => { setPreviewMode(previewMode === 'split' ? 'edit' : 'split') }}>{t('editor.modeSplit')}</button>
          </>
        )}
      </div>
      {banner && (
        <div className={css.banner} data-testid="xmart-workbench-reload">
          <span>{t('editor.reloadPrompt')}</span>
          <button type="button" className={css.tool} onClick={() => { reload() }}>{t('editor.reload')}</button>
          <button type="button" className={css.tool} onClick={() => { setBanner(false) }}>{t('editor.dismiss')}</button>
        </div>
      )}
      <div className={css.pane}>
        {showEditor && (
          <>
            <textarea
              className={css.plain}
              data-testid="xmart-workbench-plain"
              value={previewText}
              spellCheck={false}
              onChange={(event) => { handleChange(event.target.value) }}
            />
            <MonacoBoundary fallback={null}>
              <MonacoHost
                key={`${open.path}:${languageClient === undefined ? 'off' : 'on'}`}
                initialValue={open.initial}
                filePath={open.path}
                labels={{
                  loading: t('editor.engineLoading'),
                  error: t('editor.engineError'),
                  noSource: t('editor.noSource'),
                  lspStarting: t('editor.lspStarting'),
                  lspFailed: t('editor.lspFailed'),
                }}
                onChange={handleChange}
                onSave={handleSave}
                {...(languageClient === undefined ? {} : { languageClient })}
                {...(openFile === undefined ? {} : { onOpenFile: openFile })}
              />
            </MonacoBoundary>
          </>
        )}
        {showPreview && <MarkdownPreview text={previewText} />}
      </div>
    </div>
  )
}

/**
 * Keep the file buffer on screen when Monaco throws during render.
 * The column boundary would otherwise replace the whole body with
 * `column.crashed`.
 */
class MonacoBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }
  override render(): ReactNode {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}

function tokenOf(store: WorkbenchFilesStore, filePath: string | undefined): number {
  if (filePath === undefined) return 0
  try {
    return store.reloadToken(filePath)
  }
  catch {
    return 0
  }
}

function fileText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function saveLabel(saveState: SaveState, dirty: boolean, t: Translate): string {
  if (saveState === 'saving') return t('editor.saving')
  if (saveState === 'saved') return t('editor.saved')
  if (saveState === 'error') return t('editor.saveError')
  if (dirty) return t('editor.dirty')
  return ''
}
