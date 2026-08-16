/**
 * Center editor column: file tab strip and the active file body.
 * Explorer / Git / terminal are filtered out of the strip — they
 * live on the activity bar, primary sidebar, and bottom panel.
 */
import { Component, type ComponentType, type ReactNode } from 'react'
import type { WorkbenchColumnProps } from './contract.ts'
import type { TabBodyProps, WorkbenchTab } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import { isShellTabType } from './types.ts'
import { TabBar } from './TabBar.tsx'
import { TabPlaceholder } from './TabPlaceholder.tsx'
import { QuickOpen } from './QuickOpen.tsx'
import { EditorLspSync } from './EditorLspSync.tsx'
import { EditorLspWarmup } from './EditorLspWarmup.tsx'
import css from './WorkbenchColumn.module.css'

/**
 * Keep the tab strip up when a file body throws. The frame slot boundary
 * would otherwise blank the whole editor column — click-to-open then looks
 * like it did nothing.
 */
export class EditorPaneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean; message: string }
> {
  override state = { failed: false, message: '' }
  static getDerivedStateFromError(error: unknown): { failed: boolean; message: string } {
    return { failed: true, message: error instanceof Error ? error.message : String(error) }
  }
  override render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <div className={css.empty} data-testid="xmart-workbench-crashed">
        <div>{this.props.fallback}</div>
        {this.state.message !== '' && (
          <code data-testid="xmart-workbench-crashed-detail">{this.state.message}</code>
        )}
      </div>
    )
  }
}

/** Editor column (see module doc). */
export function WorkbenchColumn({
  sessionId,
  openTab,
  closeTab,
  activateTab,
  resolveBody,
  listEntries,
  getRoots,
  openFile,
  getRemotes,
  getWorkspaceRoot,
  watchWorkspace,
  readFile,
  files,
  useWorkbenchSession,
  t,
}: WorkbenchColumnProps) {
  const view = useWorkbenchSession(s => s)
  const tabs = (view.tabs ?? []).filter(tab => !isShellTabType(tab.type))
  const active = tabs.find(tab => tab.id === view.activeTabId) ?? tabs[tabs.length - 1]
  if (sessionId === undefined) return null

  return (
    <div className={css.root} data-testid="xmart-workbench">
      <TabBar
        tabs={tabs}
        activeTabId={active?.id ?? null}
        menu={view.menu ?? []}
        t={t}
        onActivate={activateTab}
        onClose={closeTab}
        onOpen={openTab}
      />
      <div className={css.body}>
        <EditorPaneBoundary
          key={active?.id ?? 'empty'}
          fallback={t('column.crashed')}
        >
          {renderPane(active, active === undefined ? undefined : resolveBody(active.type), sessionId, t)}
        </EditorPaneBoundary>
      </div>
      <EditorLspWarmup
        {...(getRemotes === undefined ? {} : { getRemotes })}
        {...(getWorkspaceRoot === undefined ? {} : { getWorkspaceRoot })}
        {...(getRoots === undefined ? {} : { getRoots })}
        {...(watchWorkspace === undefined ? {} : { watchWorkspace })}
        {...(listEntries === undefined ? {} : { listEntries })}
        {...(readFile === undefined ? {} : { readFile })}
      />
      <EditorLspSync
        tabs={tabs}
        {...(getRemotes === undefined ? {} : { getRemotes })}
        {...(getWorkspaceRoot === undefined ? {} : { getWorkspaceRoot })}
        {...(watchWorkspace === undefined ? {} : { watchWorkspace })}
        {...(readFile === undefined ? {} : { readFile })}
        {...(files === undefined ? {} : { files })}
      />
      <QuickOpen
        t={t}
        getRoots={getRoots ?? (() => [])}
        listEntries={listEntries ?? (async () => ({ path: '', entries: [], truncated: false }))}
        openFile={openFile ?? (() => {})}
      />
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
