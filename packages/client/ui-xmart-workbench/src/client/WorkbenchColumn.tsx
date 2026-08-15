/**
 * Center editor column: file tab strip and the active file body.
 * Explorer / Git / Tasks / terminal are filtered out of the strip — they
 * live on the activity bar, primary sidebar, and bottom panel.
 */
import type { ComponentType } from 'react'
import type { WorkbenchColumnProps } from './contract.ts'
import type { TabBodyProps, WorkbenchTab } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import { isShellTabType } from './types.ts'
import { TabBar } from './TabBar.tsx'
import { TabPlaceholder } from './TabPlaceholder.tsx'
import css from './WorkbenchColumn.module.css'

/** Editor column (see module doc). */
export function WorkbenchColumn({
  sessionId,
  openTab,
  closeTab,
  activateTab,
  resolveBody,
  useWorkbenchSession,
  t,
}: WorkbenchColumnProps) {
  const view = useWorkbenchSession(s => s)
  const tabs = view.tabs.filter(tab => !isShellTabType(tab.type))
  const active = tabs.find(tab => tab.id === view.activeTabId) ?? tabs[tabs.length - 1]

  return (
    <div className={css.root} data-testid="xmart-workbench">
      <TabBar
        tabs={tabs}
        activeTabId={active?.id ?? null}
        menu={view.menu}
        t={t}
        onActivate={activateTab}
        onClose={closeTab}
        onOpen={openTab}
      />
      <div className={css.body}>
        {renderPane(active, active === undefined ? undefined : resolveBody(active.type), sessionId, t)}
      </div>
    </div>
  )
}

function renderPane(
  tab: WorkbenchTab | undefined,
  Body: ComponentType<TabBodyProps> | undefined,
  sessionId: string,
  t: (key: WorkbenchKey) => string,
) {
  if (tab === undefined) return <div className={css.empty}>{t('column.empty')}</div>
  if (Body === undefined) return <TabPlaceholder type={tab.type} t={t} />
  return <Body tab={tab} visible sessionId={sessionId} />
}
