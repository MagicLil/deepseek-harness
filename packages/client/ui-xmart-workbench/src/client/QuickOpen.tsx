/**
 * Cursor-style Ctrl+P file palette. Walks the session explorer roots and
 * opens the chosen path through the same `openFile` path as the tree.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FileListing } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkbenchKey } from './locales.ts'
import type { ExplorerRoot } from './explorer-roots.ts'
import { WORKBENCH_QUICK_OPEN_EVENT } from './app-menu-dispatch.ts'
import { collectQuickOpenFiles, filterQuickOpenFiles, type QuickOpenFile } from './quick-open.ts'
import css from './QuickOpen.module.css'

/** Locale thunk. */
type Translate = (key: WorkbenchKey) => string

/** Quick-open palette props. */
export function QuickOpen({
  t, getRoots, listEntries, openFile,
}: {
  t: Translate
  getRoots: () => readonly ExplorerRoot[]
  listEntries: (path: string, signal?: AbortSignal) => Promise<FileListing>
  openFile: (path: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<readonly QuickOpenFile[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onOpen = (): void => {
      setQuery('')
      setIndex(0)
      setOpen(true)
    }
    window.addEventListener(WORKBENCH_QUICK_OPEN_EVENT, onOpen)
    return () => { window.removeEventListener(WORKBENCH_QUICK_OPEN_EVENT, onOpen) }
  }, [])

  useEffect(() => {
    if (!open) return
    const roots = getRoots()
    if (roots.length === 0) {
      setFiles([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    void collectQuickOpenFiles(roots, listEntries, controller.signal).then(
      (next) => {
        if (controller.signal.aborted) return
        setFiles(next)
        setLoading(false)
      },
      /* v8 ignore start -- walk already swallows listing errors. */
      () => {
        if (controller.signal.aborted) return
        setFiles([])
        setLoading(false)
      },
      /* v8 ignore stop */
    )
    return () => { controller.abort() }
  }, [open, getRoots, listEntries])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const matches = useMemo(() => filterQuickOpenFiles(files, query), [files, query])
  useEffect(() => { setIndex(0) }, [query, files])

  if (!open) return null

  const close = (): void => { setOpen(false) }
  const choose = (file: QuickOpenFile | undefined): void => {
    if (file === undefined) return
    openFile(file.path)
    close()
  }
  const roots = getRoots()
  const empty = !loading && matches.length === 0
    ? (roots.length === 0 ? t('quickOpen.noWorkspace') : t('quickOpen.empty'))
    : null

  return (
    <div className={css.backdrop} data-testid="xmart-quick-open" onMouseDown={close}>
      <div
        className={css.panel}
        role="dialog"
        aria-label={t('menu.go.file')}
        onMouseDown={(event) => { event.stopPropagation() }}
      >
        <input
          ref={inputRef}
          className={css.input}
          value={query}
          placeholder={t('quickOpen.placeholder')}
          spellCheck={false}
          onChange={(event) => { setQuery(event.target.value) }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              close()
              return
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setIndex(i => Math.min(i + 1, Math.max(matches.length - 1, 0)))
              return
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setIndex(i => Math.max(i - 1, 0))
              return
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              choose(matches[index])
            }
          }}
        />
        <div className={css.list} role="listbox">
          {matches.map((file, i) => (
            <button
              key={file.path}
              type="button"
              role="option"
              aria-selected={i === index}
              className={i === index ? `${css.row} ${css.rowActive}` : css.row}
              onMouseEnter={() => { setIndex(i) }}
              onClick={() => { choose(file) }}
            >
              <span className={css.name}>{file.name}</span>
              <span className={css.rel}>{file.rel}</span>
            </button>
          ))}
          {empty !== null && <div className={css.empty}>{empty}</div>}
        </div>
      </div>
    </div>
  )
}
