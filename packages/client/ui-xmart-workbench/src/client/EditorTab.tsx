/**
 * Hidden editor tab: Monaco + save + drafts + optional Markdown preview +
 * reload banner when an agent mutation touches the open path.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { FileAccessError } from '@deepseek-ai/dsh-client-runtime/client'
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import type { WorkbenchFilesStore } from './files-store.ts'
import { MonacoHost } from './MonacoHost.tsx'
import { MarkdownPreview } from './MarkdownPreview.tsx'
import { isMarkdownPath } from './language-from-path.ts'
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
}

/** Editor tab body (see module doc). */
export function EditorTab({ tab, t, readFile, writeFile, files }: EditorTabProps) {
  const path = tab.path
  const [open, setOpen] = useState<OpenState>({ phase: 'idle' })
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('edit')
  const [previewText, setPreviewText] = useState('')
  const [banner, setBanner] = useState(false)
  const [reloadSeen, setReloadSeen] = useState(() => path === undefined ? 0 : files.reloadToken(path))
  const contentRef = useRef('')
  const baselineRef = useRef('')
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const liveRef = useRef<{ path: string; dirty: boolean } | null>(null)

  useEffect(() => files.subscribe(() => {
    if (path === undefined) return
    const token = files.reloadToken(path)
    if (token !== reloadSeen) setBanner(true)
  }), [files, path, reloadSeen])

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
    setReloadSeen(files.reloadToken(path))
    readFile(path, controller.signal).then(
      (content) => {
        if (controller.signal.aborted) return
        baselineRef.current = content
        const initial = draft ?? content
        contentRef.current = initial
        const isDirty = initial !== content
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
    const target = live.path
    const content = contentRef.current
    if (draftTimer.current !== null) {
      clearTimeout(draftTimer.current)
      draftTimer.current = null
    }
    setSaveState('saving')
    writeFile(target, content).then(
      () => {
        baselineRef.current = content
        /* v8 ignore next -- a remount replaces liveRef before this save settles. */
        if (liveRef.current?.path === target) {
          liveRef.current.dirty = contentRef.current !== content
          setDirty(liveRef.current.dirty)
        }
        files.setDraft(target, undefined)
        setSaveState('saved')
      },
      () => { setSaveState('error') },
    )
  }, [files, writeFile])

  const reload = () => {
    /* v8 ignore next -- the reload control only renders for a pathed tab. */
    if (path === undefined) return
    files.setDraft(path, undefined)
    setReloadSeen(files.reloadToken(path))
    setBanner(false)
    setOpen({ phase: 'loading', path })
    void readFile(path).then(
      (content) => {
        baselineRef.current = content
        contentRef.current = content
        liveRef.current = { path, dirty: false }
        setDirty(false)
        setPreviewText(content)
        setOpen({ phase: 'ready', path, initial: content })
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

  return (
    <div className={css.root} data-testid="xmart-workbench-editor">
      <div className={css.bar}>
        <div className={css.path} title={path}>{path}</div>
        <span className={saveState === 'error' ? css.error : dirty ? css.dirty : css.status}>
          {saveLabel(saveState, dirty, t)}
        </span>
        <button type="button" className={css.tool} onClick={() => { handleSave() }}>{t('editor.save')}</button>
        {markdown && (
          <>
            <button type="button" className={previewMode === 'edit' ? `${css.tool} ${css.toolActive}` : css.tool} onClick={() => { setPreviewMode('edit') }}>{t('editor.modeEdit')}</button>
            <button type="button" className={previewMode === 'preview' ? `${css.tool} ${css.toolActive}` : css.tool} onClick={() => { setPreviewMode('preview') }}>{t('editor.modePreview')}</button>
            <button type="button" className={previewMode === 'split' ? `${css.tool} ${css.toolActive}` : css.tool} onClick={() => { setPreviewMode('split') }}>{t('editor.modeSplit')}</button>
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
          <MonacoHost
            key={open.path}
            initialValue={open.initial}
            filePath={open.path}
            labels={{ loading: t('editor.engineLoading'), error: t('editor.engineError') }}
            onChange={handleChange}
            onSave={handleSave}
          />
        )}
        {showPreview && <MarkdownPreview text={previewText} />}
      </div>
    </div>
  )
}

function saveLabel(saveState: SaveState, dirty: boolean, t: Translate): string {
  if (saveState === 'saving') return t('editor.saving')
  if (saveState === 'saved') return t('editor.saved')
  if (saveState === 'error') return t('editor.saveError')
  if (dirty) return t('editor.dirty')
  return ''
}
