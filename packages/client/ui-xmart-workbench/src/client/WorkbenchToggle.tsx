/**
 * Right-edge overlay control that opens the workbench when a live session
 * exists and the workbench preference is closed.
 */
import type { WorkbenchToggleProps } from './contract.ts'
import css from './WorkbenchToggle.module.css'

/** Overlay reopen control (see module doc). */
export function WorkbenchToggle({
  useSessions,
  useWorkbenchOpen,
  openWorkbench,
  t,
}: WorkbenchToggleProps) {
  const session = useSessions((s) => {
    const current = s.current
    return current !== undefined && s.byId[current]?.blank === false ? current : undefined
  })
  const open = useWorkbenchOpen(value => value)
  if (session === undefined || open) return null
  return (
    <button
      type="button"
      className={css.toggle}
      data-testid="xmart-workbench-toggle"
      onClick={() => { openWorkbench() }}
    >
      {t('toggle.open')}
    </button>
  )
}
