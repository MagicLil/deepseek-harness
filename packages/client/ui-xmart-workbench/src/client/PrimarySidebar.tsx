/**
 * Left primary sidebar: Explorer / Git / Tasks stay mounted and swap with
 * `hidden`, so switching icons does not remount the file tree. Syncs the
 * session persist store to ctx.layout on session identity change, then
 * writes persist from later preference changes (drag / toggle).
 */
import { Component, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PrimarySidebarProps } from './contract.ts'
import { PRIMARY_ACTIVITIES, isPrimaryActivity } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import css from './PrimarySidebar.module.css'

const TITLE_KEY = {
  explorer: 'activity.explorer',
  git: 'activity.git',
  tasks: 'activity.tasks',
} as const satisfies Record<typeof PRIMARY_ACTIVITIES[number], WorkbenchKey>

/**
 * Isolate one activity body so a throw does not blank the whole sidebar
 * slot (the frame error boundary would otherwise paint an empty column).
 */
export class ActivityPaneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false }
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }
  override render(): ReactNode {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}

/** Primary sidebar (see module doc). */
export function PrimarySidebar({
  width,
  sessionId,
  useStore,
  actions,
  closeWorkbench,
  setWorkbench,
  resolveBody,
  refreshExplorer,
  projectKey,
  keepLiveWidth,
  useWorkbenchSession,
  useWorkbenchRegistry,
  t,
}: PrimarySidebarProps) {
  const persisted = useStore(s => s)
  const persistRef = useRef(persisted)
  persistRef.current = persisted
  const writes = useRef({ closeWorkbench, setWorkbench, actions })
  writes.current = { closeWorkbench, setWorkbench, actions }
  const syncGen = useRef(0)
  const seenGen = useRef(-1)
  const activity = useWorkbenchSession(s => s.activity)
  const registered = useWorkbenchRegistry(s => s.activities)
  const ids = registered.length > 0 ? registered.map(row => row.id) : [...PRIMARY_ACTIVITIES]
  const title = registered.find(row => row.id === activity)?.title
    ?? (isPrimaryActivity(activity) ? t(TITLE_KEY[activity]) : activity)
  const prevSession = useRef(sessionId)

  useLayoutEffect(() => {
    const prev = prevSession.current
    prevSession.current = sessionId
    const from = projectKey(prev)
    const sameProject = prev !== sessionId && from !== undefined && from === projectKey(sessionId)
    if (sameProject || keepLiveWidth()) {
      syncGen.current += 1
      seenGen.current = syncGen.current
      if (width > 0) writes.current.actions.rememberOpen(width)
      else writes.current.actions.rememberClosed()
      return
    }
    syncGen.current += 1
    const snap = persistRef.current
    if (snap.open) writes.current.setWorkbench(snap.width)
    else if (width > 0) writes.current.closeWorkbench()
  }, [keepLiveWidth, projectKey, sessionId])

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
      return
    }
    if (snap.open) writes.current.actions.rememberClosed()
  }, [width])

  if (width === 0) return null

  return (
    <div className={css.root} data-testid="xmart-primary-sidebar">
      <div className={css.title}>
        <div className={css.titleLabel} data-testid="xmart-primary-title">{title}</div>
        {activity === 'explorer' && (
          <button
            type="button"
            className={css.refresh}
            data-testid="xmart-workbench-explorer-refresh"
            aria-label={t('explorer.refresh')}
            onClick={() => { refreshExplorer() }}
          >
            <IconRefreshOutline16 size={14} />
          </button>
        )}
      </div>
      {ids.map((id) => {
        const Body = resolveBody(id)
        const active = id === activity
        // Keep Explorer mounted across icon switches so the file tree does
        // not remount. Git / Tasks mount only while selected.
        if (!active && id !== 'explorer') return null
        const fallback = (
          <div className={css.fallback} data-testid={`xmart-primary-fallback-${id}`}>
            {t(Body === undefined ? 'sidebar.missing' : 'sidebar.crashed')}
          </div>
        )
        return (
          <div
            key={id}
            className={active ? css.pane : `${css.pane} ${css.paneInactive}`}
            data-testid={`xmart-primary-pane-${id}`}
          >
            <ActivityPaneBoundary fallback={fallback}>
              {Body === undefined
                ? fallback
                : (
                  <Body
                    tab={{ id, type: id, title: id }}
                    visible={active}
                    sessionId={sessionId}
                  />
                )}
            </ActivityPaneBoundary>
          </div>
        )
      })}
    </div>
  )
}
