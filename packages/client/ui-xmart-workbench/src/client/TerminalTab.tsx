/**
 * Terminal tab placeholder. Interactive PTY needs host.terminal* RPCs and
 * a desktop bundle that mounts ctx.terminals — those are not in the default
 * web/desktop patches yet. The tab stays registered so + and persist work.
 */
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import css from './ExplorerTab.module.css'

type Translate = (key: WorkbenchKey) => string

export type TerminalTabProps = TabBodyProps & { t: Translate }

/** Terminal seat (host PTY bridge not mounted in the default desktop bundle). */
export function TerminalTab({ t }: TerminalTabProps) {
  return (
    <div className={css.note} data-testid="xmart-workbench-terminal">
      {t('terminal.unavailable')}
    </div>
  )
}
