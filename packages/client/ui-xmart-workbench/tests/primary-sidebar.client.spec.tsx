// @vitest-environment jsdom
/**
 * PrimarySidebar: persist ↔ layout sync and the active activity body.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { PrimarySidebar } from '../src/client/PrimarySidebar.tsx'
import type { PrimarySidebarProps } from '../src/client/contract.ts'
import { createWorkbenchStore } from '../src/client/stores.ts'
import { EMPTY_WORKBENCH_VIEW } from '../src/client/service.ts'
import type { TabBodyProps, WorkbenchView } from '../src/client/types.ts'

afterEach(cleanup)

function hookOf<T>(inst: { subscribe: (fn: () => void) => () => void; getSnapshot: () => T }) {
  return function useSelector<S>(sel: (s: T) => S): S {
    return sel(useSyncExternalStore(inst.subscribe, inst.getSnapshot))
  }
}

function constantHook<T>(value: T) {
  return function useSelector<S>(sel: (s: T) => S): S {
    return sel(value)
  }
}

function Stub({ tab }: TabBodyProps) {
  return <div data-testid="xmart-primary-body">{tab.type}</div>
}

function mount(
  width: number,
  scope = 's1',
  setup?: (inst: ReturnType<ReturnType<typeof createWorkbenchStore>['create']>) => void,
  view: WorkbenchView = EMPTY_WORKBENCH_VIEW,
  resolveBody: PrimarySidebarProps['resolveBody'] = () => Stub,
) {
  const instance = createWorkbenchStore().create(scope)
  setup?.(instance)
  const closeWorkbench = vi.fn()
  const setWorkbench = vi.fn()
  const refreshExplorer = vi.fn()
  const props = {
    width,
    sessionId: scope as SessionId,
    useStore: hookOf(instance),
    actions: instance.actions,
    useSession: (() => null) as never,
    useSessions: (() => null) as never,
    useWorkspaces: (() => null) as never,
    closeWorkbench,
    setWorkbench,
    resolveBody,
    refreshExplorer,
    projectKey: () => undefined,
    keepLiveWidth: () => false,
    useWorkbenchSession: constantHook(view),
    useWorkbenchRegistry: constantHook({ tabs: [], viewers: [], activities: [] }),
    t: ((key: string) => key) as never,
  } as PrimarySidebarProps
  const utils = render(<PrimarySidebar {...props} />)
  return {
    ...utils,
    instance,
    closeWorkbench,
    setWorkbench,
    refreshExplorer,
    rerender: (next: Partial<PrimarySidebarProps>) => {
      utils.rerender(<PrimarySidebar {...props} {...next} />)
    },
  }
}

describe('PrimarySidebar', () => {
  it('renders nothing while the preference is closed', () => {
    mount(0)
    expect(screen.queryByTestId('xmart-primary-sidebar')).toBeNull()
  })

  it('renders the activity body when open', () => {
    mount(260, 's-ui', (inst) => { inst.actions.rememberOpen(260) })
    expect(screen.getByTestId('xmart-primary-sidebar')).toBeTruthy()
    expect(screen.getByTestId('xmart-primary-title').textContent).toBe('activity.explorer')
    expect(screen.getByTestId('xmart-primary-pane-explorer').className).not.toMatch(/paneInactive/)
    expect(screen.getByTestId('xmart-primary-pane-explorer').textContent).toBe('explorer')
  })

  it('puts the explorer refresh icon on the title row', () => {
    const { refreshExplorer, rerender } = mount(260, 's-refresh')
    expect(screen.getByTestId('xmart-workbench-explorer-refresh')).toBeTruthy()
    act(() => { screen.getByTestId('xmart-workbench-explorer-refresh').click() })
    expect(refreshExplorer).toHaveBeenCalledOnce()
    rerender({
      useWorkbenchSession: constantHook({ ...EMPTY_WORKBENCH_VIEW, activity: 'git' }),
    })
    expect(screen.queryByTestId('xmart-workbench-explorer-refresh')).toBeNull()
  })

  it('uses registered activity titles and ids when the registry is live', () => {
    const { rerender } = mount(
      260,
      's-reg',
      undefined,
      { ...EMPTY_WORKBENCH_VIEW, activity: 'custom' },
    )
    expect(screen.getByTestId('xmart-primary-title').textContent).toBe('custom')
    rerender({
      useWorkbenchRegistry: constantHook({
        tabs: [],
        viewers: [],
        activities: [{ id: 'custom', title: '自定义', enabled: true }],
      }),
      resolveBody: (type: string) => type === 'custom' ? Stub : undefined,
    })
    expect(screen.getByTestId('xmart-primary-title').textContent).toBe('自定义')
    expect(screen.getByTestId('xmart-primary-pane-custom').textContent).toBe('custom')
  })

  it('titles Git', () => {
    mount(
      260,
      's-title',
      undefined,
      { ...EMPTY_WORKBENCH_VIEW, activity: 'git' },
    )
    expect(screen.getByTestId('xmart-primary-title').textContent).toBe('activity.git')
  })

  it('keeps the explorer tree mounted when switching to Git and back', () => {
    const { rerender } = mount(
      260,
      's-switch',
      (inst) => { inst.actions.rememberOpen(260) },
      { ...EMPTY_WORKBENCH_VIEW, activity: 'explorer' },
    )
    const explorer = screen.getByTestId('xmart-primary-pane-explorer')
    expect(explorer.className).not.toMatch(/paneInactive/)
    expect(screen.queryByTestId('xmart-primary-pane-git')).toBeNull()
    rerender({
      useWorkbenchSession: constantHook({ ...EMPTY_WORKBENCH_VIEW, activity: 'git' }),
    })
    expect(screen.getByTestId('xmart-primary-pane-explorer')).toBe(explorer)
    expect(explorer.className).toMatch(/paneInactive/)
    expect(screen.getByTestId('xmart-primary-pane-git').className).not.toMatch(/paneInactive/)
    rerender({
      useWorkbenchSession: constantHook({ ...EMPTY_WORKBENCH_VIEW, activity: 'explorer' }),
    })
    expect(screen.getByTestId('xmart-primary-pane-explorer')).toBe(explorer)
    expect(explorer.className).not.toMatch(/paneInactive/)
    expect(screen.queryByTestId('xmart-primary-pane-git')).toBeNull()
  })

  it('shows a fallback when the activity type is unregistered', () => {
    mount(260, 's-empty', undefined, { ...EMPTY_WORKBENCH_VIEW, activity: 'git' }, () => undefined)
    expect(screen.getByTestId('xmart-primary-sidebar')).toBeTruthy()
    expect(screen.getByTestId('xmart-primary-title').textContent).toBe('activity.git')
    expect(screen.queryByTestId('xmart-primary-body')).toBeNull()
    expect(screen.getByTestId('xmart-primary-pane-git').textContent).toBe('sidebar.missing')
  })

  it('keeps the sidebar when an activity body throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Boom(): never {
      throw new Error('boom')
    }
    mount(
      260,
      's-boom',
      undefined,
      { ...EMPTY_WORKBENCH_VIEW, activity: 'git' },
      type => type === 'git' ? Boom : Stub,
    )
    expect(screen.getByTestId('xmart-primary-sidebar')).toBeTruthy()
    expect(screen.getByTestId('xmart-primary-fallback-git').textContent).toBe('sidebar.crashed')
    expect(screen.getByTestId('xmart-primary-pane-explorer').textContent).toBe('explorer')
    spy.mockRestore()
  })

  it('restores a persisted open width into the layout store on mount', () => {
    const { setWorkbench } = mount(0, 's-open', (inst) => {
      inst.actions.rememberOpen(300)
    })
    expect(setWorkbench).toHaveBeenCalledWith(300)
  })

  it('closes a leftover layout preference when this session last left the panel closed', () => {
    const { closeWorkbench } = mount(260, 's-closed', (inst) => {
      inst.actions.rememberClosed()
    })
    expect(closeWorkbench).toHaveBeenCalledOnce()
  })

  it('persists a later drag width after the session sync', () => {
    const { instance, rerender } = mount(0, 's-drag', (inst) => {
      inst.actions.rememberOpen(260)
    })
    act(() => { rerender({ width: 260 }) })
    act(() => { rerender({ width: 300 }) })
    expect(instance.getSnapshot()).toEqual({ open: true, width: 300 })
  })

  it('restores persist after sessionId arrives on a later render', () => {
    const { setWorkbench, rerender } = mount(0, 's-hydrate', (inst) => {
      inst.actions.rememberOpen(300)
    })
    rerender({ sessionId: undefined, width: 0 })
    setWorkbench.mockClear()
    act(() => { rerender({ sessionId: 's-hydrate' as SessionId, width: 0 }) })
    expect(setWorkbench).toHaveBeenCalledWith(300)
  })

  it('does not reopen a closed persist when a session appears after a blank chrome', () => {
    const { setWorkbench, rerender } = mount(0, 's-blank', (inst) => {
      inst.actions.rememberClosed()
    })
    rerender({ sessionId: undefined, width: 0 })
    setWorkbench.mockClear()
    act(() => { rerender({ sessionId: 's-blank' as SessionId, width: 0 }) })
    expect(setWorkbench).not.toHaveBeenCalled()
  })

  it('writes a closed persist when switching sessions with a collapsed rail', () => {
    const first = createWorkbenchStore().create('s-closed-a')
    first.actions.rememberOpen(300)
    const next = createWorkbenchStore().create('s-closed-b')
    next.actions.rememberOpen(260)
    const setWorkbench = vi.fn()
    const closeWorkbench = vi.fn()
    const shared = {
      closeWorkbench,
      setWorkbench,
      resolveBody: () => Stub,
      refreshExplorer: vi.fn(),
      projectKey: () => '/ws',
      keepLiveWidth: () => false,
      useWorkbenchSession: constantHook(EMPTY_WORKBENCH_VIEW),
      useWorkbenchRegistry: constantHook({ tabs: [], viewers: [], activities: [] }),
      useSession: (() => null) as never,
      useSessions: (() => null) as never,
      useWorkspaces: (() => null) as never,
      t: ((key: string) => key) as never,
    }
    const firstProps = {
      ...shared,
      width: 0,
      sessionId: 's-closed-a' as SessionId,
      useStore: hookOf(first),
      actions: first.actions,
    } as PrimarySidebarProps
    const utils = render(<PrimarySidebar {...firstProps} />)
    setWorkbench.mockClear()
    act(() => {
      utils.rerender(
        <PrimarySidebar
          {...firstProps}
          sessionId={'s-closed-b' as SessionId}
          useStore={hookOf(next)}
          actions={next.actions}
        />,
      )
    })
    expect(setWorkbench).not.toHaveBeenCalled()
    expect(closeWorkbench).not.toHaveBeenCalled()
    expect(next.store.getSnapshot()).toEqual({ open: false, width: 260 })
  })

  it('asks layout to adopt the remembered width when opening from a closed persist', () => {
    const { setWorkbench, instance, rerender } = mount(0, 's-reopen', (inst) => {
      inst.actions.rememberOpen(300)
      inst.actions.rememberClosed()
    })
    expect(instance.getSnapshot()).toEqual({ open: false, width: 300 })
    act(() => { rerender({ width: 260 }) })
    expect(setWorkbench).toHaveBeenCalledWith(300)
  })

  it('remembers a later close after the session sync', () => {
    const { instance, rerender } = mount(0, 's-close', (inst) => {
      inst.actions.rememberOpen(260)
    })
    act(() => { rerender({ width: 260 }) })
    act(() => { rerender({ width: 0 }) })
    expect(instance.getSnapshot()).toEqual({ open: false, width: 260 })
  })

  it('keeps the live width when switching to a same-project session', () => {
    const first = createWorkbenchStore().create('s-a')
    first.actions.rememberOpen(300)
    const next = createWorkbenchStore().create('s-b')
    const setWorkbench = vi.fn()
    const closeWorkbench = vi.fn()
    const projectKey = (id: string) => id === 's-a' || id === 's-b' ? '/ws' : undefined
    const shared = {
      closeWorkbench,
      setWorkbench,
      resolveBody: () => Stub,
      refreshExplorer: vi.fn(),
      projectKey,
      keepLiveWidth: () => false,
      useWorkbenchSession: constantHook(EMPTY_WORKBENCH_VIEW),
      useWorkbenchRegistry: constantHook({ tabs: [], viewers: [], activities: [] }),
      useSession: (() => null) as never,
      useSessions: (() => null) as never,
      useWorkspaces: (() => null) as never,
      t: ((key: string) => key) as never,
    }
    const firstProps = {
      ...shared,
      width: 300,
      sessionId: 's-a' as SessionId,
      useStore: hookOf(first),
      actions: first.actions,
    } as PrimarySidebarProps
    const utils = render(<PrimarySidebar {...firstProps} />)
    expect(setWorkbench).toHaveBeenCalledWith(300)
    setWorkbench.mockClear()
    act(() => {
      utils.rerender(
        <PrimarySidebar
          {...firstProps}
          sessionId={'s-b' as SessionId}
          useStore={hookOf(next)}
          actions={next.actions}
        />,
      )
    })
    expect(setWorkbench).not.toHaveBeenCalled()
    expect(closeWorkbench).not.toHaveBeenCalled()
    expect(next.store.getSnapshot()).toEqual({ open: true, width: 300 })
  })

  it('keeps the live width when switching to a different-project session', () => {
    const first = createWorkbenchStore().create('s-a')
    first.actions.rememberOpen(300)
    const next = createWorkbenchStore().create('s-other')
    next.actions.rememberClosed()
    const setWorkbench = vi.fn()
    const closeWorkbench = vi.fn()
    const projectKey = (id: string) => id === 's-a' ? '/ws' : '/other'
    const shared = {
      closeWorkbench,
      setWorkbench,
      resolveBody: () => Stub,
      refreshExplorer: vi.fn(),
      projectKey,
      keepLiveWidth: () => false,
      useWorkbenchSession: constantHook(EMPTY_WORKBENCH_VIEW),
      useWorkbenchRegistry: constantHook({ tabs: [], viewers: [], activities: [] }),
      useSession: (() => null) as never,
      useSessions: (() => null) as never,
      useWorkspaces: (() => null) as never,
      t: ((key: string) => key) as never,
    }
    const firstProps = {
      ...shared,
      width: 300,
      sessionId: 's-a' as SessionId,
      useStore: hookOf(first),
      actions: first.actions,
    } as PrimarySidebarProps
    const utils = render(<PrimarySidebar {...firstProps} />)
    expect(setWorkbench).toHaveBeenCalledWith(300)
    setWorkbench.mockClear()
    act(() => {
      utils.rerender(
        <PrimarySidebar
          {...firstProps}
          sessionId={'s-other' as SessionId}
          useStore={hookOf(next)}
          actions={next.actions}
        />,
      )
    })
    expect(setWorkbench).not.toHaveBeenCalled()
    expect(closeWorkbench).not.toHaveBeenCalled()
    expect(next.store.getSnapshot()).toEqual({ open: true, width: 300 })
  })

  it('keeps the live width on remount when apply marks the same-project inherit', () => {
    const dest = createWorkbenchStore().create('s-remount')
    dest.actions.rememberOpen(260)
    const setWorkbench = vi.fn()
    const closeWorkbench = vi.fn()
    render(
      <PrimarySidebar
        {
          ...{
            width: 400,
            sessionId: 's-remount' as SessionId,
            useStore: hookOf(dest),
            actions: dest.actions,
            closeWorkbench,
            setWorkbench,
            resolveBody: () => Stub,
            refreshExplorer: vi.fn(),
            projectKey: () => '/ws',
            keepLiveWidth: () => true,
            useWorkbenchSession: constantHook(EMPTY_WORKBENCH_VIEW),
            useWorkbenchRegistry: constantHook({ tabs: [], viewers: [], activities: [] }),
            useSession: (() => null) as never,
            useSessions: (() => null) as never,
            useWorkspaces: (() => null) as never,
            t: ((key: string) => key) as never,
          } as PrimarySidebarProps
        }
      />,
    )
    expect(setWorkbench).not.toHaveBeenCalled()
    expect(closeWorkbench).not.toHaveBeenCalled()
    expect(dest.store.getSnapshot()).toEqual({ open: true, width: 400 })
  })

  it('does not rewrite a closed persist when the leftover preference is already zero', () => {
    const { instance, rerender } = mount(260, 's-zero-closed', (inst) => {
      inst.actions.rememberClosed()
    })
    act(() => { rerender({ width: 0 }) })
    expect(instance.getSnapshot()).toEqual({ open: false, width: 260 })
  })
})
