/**
 * Hidden image / binary tab bodies. Images load through host.readFileBytes;
 * binary stays a path + system-open fallback.
 */
import { useEffect, useState } from 'react'
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import type { WorkbenchFilesStore } from './files-store.ts'
import css from './MediaTabs.module.css'

/** Locale thunk. */
type Translate = (key: WorkbenchKey) => string

/** Shared media-tab callbacks. */
export type MediaTabProps = TabBodyProps & {
  t: Translate
  openSystem: (path: string) => Promise<void>
}

/** Image tab: bytes RPC plus reload tokens from the files store. */
export type ImageTabProps = MediaTabProps & {
  readFileBytes: (path: string, signal?: AbortSignal) => Promise<{ bytes: Uint8Array; mimeType: string }>
  files: WorkbenchFilesStore
}

/** In-column image preview. */
export function ImageTab({ tab, t, openSystem, readFileBytes, files }: ImageTabProps) {
  const path = tab.path
  const [src, setSrc] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    path === undefined ? 'idle' : 'loading',
  )
  const [reloadAt, setReloadAt] = useState(() => path === undefined ? 0 : files.getSnapshot().reloadAt[path] ?? 0)

  useEffect(() => files.subscribe(() => {
    if (path === undefined) return
    setReloadAt(files.getSnapshot().reloadAt[path] ?? 0)
  }), [files, path])

  useEffect(() => {
    if (path === undefined) {
      setStatus('idle')
      setSrc(null)
      return
    }
    const controller = new AbortController()
    let created: string | undefined
    setStatus('loading')
    setSrc(null)
    void readFileBytes(path, controller.signal).then(({ bytes, mimeType }) => {
      if (controller.signal.aborted) return
      const copy = new Uint8Array(bytes.byteLength)
      copy.set(bytes)
      created = URL.createObjectURL(new Blob([copy.buffer], { type: mimeType }))
      setSrc(created)
      setStatus('ready')
    }, () => {
      if (controller.signal.aborted) return
      setStatus('error')
    })
    return () => {
      controller.abort()
      if (created !== undefined) URL.revokeObjectURL(created)
    }
  }, [path, reloadAt, readFileBytes])

  return (
    <div className={css.root} data-testid="xmart-workbench-image">
      {status === 'loading' && <p className={css.note}>{t('viewer.image.loading')}</p>}
      {status === 'error' && <p className={css.note}>{t('viewer.image.error')}</p>}
      {status === 'idle' && <p className={css.note}>{t('viewer.image.body')}</p>}
      {status === 'ready' && src !== null && (
        <img className={css.preview} src={src} alt={tab.title} data-testid="xmart-workbench-image-preview" />
      )}
      {path !== undefined && (
        <p className={css.note}>
          <button type="button" className={css.tool} onClick={() => { void openSystem(path) }}>
            {t('explorer.openSystem')}
          </button>
        </p>
      )}
    </div>
  )
}

/** Binary placeholder (NUL / file-binary). */
export function BinaryTab({ tab, t, openSystem }: MediaTabProps) {
  const path = tab.path
  return (
    <div className={css.note} data-testid="xmart-workbench-binary">
      <p>{t('viewer.binary.body')}</p>
      {path !== undefined && <code>{path}</code>}
      {path !== undefined && (
        <p>
          <button type="button" className={css.tool} onClick={() => { void openSystem(path) }}>
            {t('explorer.openSystem')}
          </button>
        </p>
      )}
    </div>
  )
}
