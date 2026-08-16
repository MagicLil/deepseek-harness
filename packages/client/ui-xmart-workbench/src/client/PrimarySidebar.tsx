/**
 * Left primary sidebar: Explorer / Git stay mounted and swap with
 * `hidden`, so switching icons does not remount the file tree. Syncs the
 * session persist store to ctx.layout on first mount, then writes persist
 * from later preference changes (drag / toggle). A later session switch
 * keeps the live rail width so the frame grid does not ease.
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
  useSessions,
  useWorkbenchPersist,
  actions,
  closeWorkbench,
  setWorkbench,
  resolveBody,
  refreshExplorer,
  keepLiveWidth,
  useWorkbenchSession,
  useWorkbenchRegistry,
  t,
}: PrimarySidebarProps) {
  const persisted = useWorkbenchPersist(s => s)
  const persistRef = useRef(persisted)
  persistRef.current = persisted
  const writes = useRef({ closeWorkbench, setWorkbench, actions })
  writes.current = { closeWorkbench, setWorkbench, actions }
  const keepLiveRef = useRef(keepLiveWidth)
  keepLiveRef.current = keepLiveWidth
  const syncGen = useRef(0)
  const seenGen = useRef(-1)
  const activity = useWorkbenchSession(s => s.activity)
  const registered = useWorkbenchRegistry(s => s.activities)
  const ids = registered.length > 0 ? registered.map(row => row.id) : [...PRIMARY_ACTIVITIES]
  const title = registered.find(row => row.id === activity)?.title
    ?? (isPrimaryActivity(activity) ? t(TITLE_KEY[activity]) : activity)
  const listedCurrent = useSessions(s => s.current)
  const boundSession = sessionId ?? (typeof listedCurrent === 'string' ? listedCurrent : undefined)
  // Start unset so the first bind is a hydrate (restore open persist, never
  // auto-close). Initializing to sessionId made first mount look like a
  // remount and closed the rail whenever persist said closed — then a later
  // keepLiveWidth identity change closed it again after the user clicked open.
  const prevSession = useRef<string | undefined>(undefined)

  useLayoutEffect(() => {
    const prev = prevSession.current
    prevSession.current = sessionId
    if (sessionId === undefined) return
    if (keepLiveRef.current()) {
      syncGen.current += 1
      seenGen.current = syncGen.current
      if (width > 0) writes.current.actions.rememberOpen(width)
      else writes.current.actions.rememberClosed()
      return
    }
    if (prev === undefined) {
      syncGen.current += 1
      const snap = persistRef.current
      if (snap.open) writes.current.setWorkbench(snap.width)
      return
    }
    if (prev !== sessionId) {
      syncGen.current += 1
      seenGen.current = syncGen.current
      if (width > 0) writes.current.actions.rememberOpen(width)
      else writes.current.actions.rememberClosed()
      return
    }
  }, [sessionId])

  useEffect(() => {
    if (seenGen.current !== syncGen.current) {
      seenGen.current = syncGen.current
      return
    }
    const snap = persistRef.current
    if (width > 0) {
      if (!snap.open && snap.width > 0 && snap.width !== width) {
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
        {activity === 'explorer' && boundSession !== undefined && (
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
      {boundSession === undefined
        ? null
        : ids.map((id) => {
          const Body = resolveBody(id)
          const active = id === activity
          // Keep Explorer mounted across icon switches so the file tree does
          // not remount. Git mounts only while selected.
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
                      sessionId={boundSession}
                    />
                  )}
              </ActivityPaneBoundary>
            </div>
          )
        })}
    </div>
  )
}
