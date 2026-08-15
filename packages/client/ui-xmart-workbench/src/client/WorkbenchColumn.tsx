/**
 * Empty workbench column: title, close, and placeholder copy. Syncs the
 * session persist store to ctx.layout on session identity change, then
 * writes persist from later preference changes (drag / toggle).
 */
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { WorkbenchColumnProps } from './contract.ts'
import css from './WorkbenchColumn.module.css'

/** Empty workbench column (see module doc). */
export function WorkbenchColumn({
  width,
  sessionId,
  useStore,
  actions,
  closeWorkbench,
  setWorkbench,
  reportOpen,
  t,
}: WorkbenchColumnProps) {
  const persisted = useStore(s => s)
  const persistRef = useRef(persisted)
  persistRef.current = persisted
  const writes = useRef({ closeWorkbench, setWorkbench, reportOpen, actions })
  writes.current = { closeWorkbench, setWorkbench, reportOpen, actions }
  const syncGen = useRef(0)
  const seenGen = useRef(-1)

  useLayoutEffect(() => {
    syncGen.current += 1
    const snap = persistRef.current
    if (snap.open) writes.current.setWorkbench(snap.width)
    else if (width > 0) writes.current.closeWorkbench()
    writes.current.reportOpen(snap.open)
  }, [sessionId])

  useEffect(() => {
    if (seenGen.current !== syncGen.current) {
      seenGen.current = syncGen.current
      return
    }
    const snap = persistRef.current
    if (width > 0) {
      if (!snap.open && snap.width !== width) {
        writes.current.setWorkbench(snap.width)
        return
      }
      writes.current.actions.rememberOpen(width)
      writes.current.reportOpen(true)
      return
    }
    if (snap.open) {
      writes.current.actions.rememberClosed()
      writes.current.reportOpen(false)
    }
  }, [width])

  if (width === 0) return null

  return (
    <div className={css.root} data-testid="xmart-workbench">
      <div className={css.header}>
        <div className={css.title}>{t('column.title')}</div>
        <button
          type="button"
          className={css.close}
          aria-label={t('column.close')}
          onClick={() => { closeWorkbench() }}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className={css.body}>
        <div className={css.empty}>{t('column.empty')}</div>
      </div>
    </div>
  )
}
