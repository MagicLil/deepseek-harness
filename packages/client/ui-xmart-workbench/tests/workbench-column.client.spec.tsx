// @vitest-environment jsdom
/**
 * WorkbenchColumn: chrome, persist ↔ layout sync, tab strip, and body routing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { WorkbenchColumn } from '../src/client/WorkbenchColumn.tsx'
import type { WorkbenchColumnProps } from '../src/client/contract.ts'
import { createWorkbenchStore } from '../src/client/stores.ts'
import { EMPTY_WORKBENCH_VIEW } from '../src/client/service.ts'
import type { TabBodyProps, WorkbenchView } from '../src/client/types.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh) as never

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
  return <div data-testid="xmart-workbench-stub">{tab.title}</div>
}

function mount(
  width: number,
  scope = 's1',
  setup?: (inst: ReturnType<ReturnType<typeof createWorkbenchStore>['create']>) => void,
  view: WorkbenchView = EMPTY_WORKBENCH_VIEW,
  resolveBody: WorkbenchColumnProps['resolveBody'] = () => undefined,
) {
  const instance = createWorkbenchStore().create(scope)
  setup?.(instance)
  const closeWorkbench = vi.fn()
  const setWorkbench = vi.fn()
  const reportOpen = vi.fn()
  const openTab = vi.fn()
  const closeTab = vi.fn()
  const activateTab = vi.fn()
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
    reportOpen,
    openTab,
    closeTab,
    activateTab,
    resolveBody,
    useWorkbenchSession: constantHook(view),
    useWorkbenchRegistry: constantHook({ tabs: [], viewers: [] }),
    t,
  } as WorkbenchColumnProps
  const utils = render(<WorkbenchColumn {...props} />)
  return {
    ...utils,
    instance,
    closeWorkbench,
    setWorkbench,
    reportOpen,
    openTab,
    closeTab,
    activateTab,
    rerender: (next: Partial<WorkbenchColumnProps>) => {
      utils.rerender(<WorkbenchColumn {...props} {...next} />)
    },
  }
}

describe('WorkbenchColumn', () => {
  it('renders nothing while the preference is closed', () => {
    mount(0)
    expect(screen.queryByTestId('xmart-workbench')).toBeNull()
  })

  it('renders the title, empty copy, tab bar, and close control when open', () => {
    const { closeWorkbench } = mount(400, 's-ui', (inst) => {
      inst.actions.rememberOpen(400)
    })
    expect(screen.getByTestId('xmart-workbench')).toBeTruthy()
    expect(screen.getByText('工作台')).toBeTruthy()
    expect(screen.getByText('从 + 打开资源管理器，浏览并编辑工作区文件。')).toBeTruthy()
    expect(screen.getByTestId('xmart-workbench-tabbar')).toBeTruthy()
    act(() => { screen.getByLabelText('关闭工作台').click() })
    expect(closeWorkbench).toHaveBeenCalledOnce()
  })

  it('renders a registered tab body and a placeholder for an unknown type', () => {
    const known: WorkbenchView = {
      tabs: [{ id: 'demo:1', type: 'demo', title: '演示' }],
      activeTabId: 'demo:1',
      nextSeq: 2,
      menu: [],
    }
    mount(400, 's-body', (inst) => { inst.actions.rememberOpen(400) }, known, (type) => {
      return type === 'demo' ? Stub : undefined
    })
    expect(screen.getByTestId('xmart-workbench-stub').textContent).toBe('演示')

    const unknown: WorkbenchView = {
      tabs: [{ id: 'gone:1', type: 'gone', title: 'Gone' }],
      activeTabId: 'gone:1',
      nextSeq: 2,
      menu: [],
    }
    cleanup()
    mount(400, 's-ph', (inst) => { inst.actions.rememberOpen(400) }, unknown)
    expect(screen.getByTestId('xmart-workbench-placeholder')).toBeTruthy()
    expect(screen.getByText('gone')).toBeTruthy()
  })

  it('activates and closes tabs from the strip', () => {
    const view: WorkbenchView = {
      tabs: [
        { id: 'a', type: 'demo', title: 'A' },
        { id: 'b', type: 'demo', title: 'B' },
      ],
      activeTabId: 'a',
      nextSeq: 3,
      menu: [{ id: 'demo', title: '演示', disabled: false }],
    }
    const { activateTab, closeTab } = mount(400, 's-tabs', (inst) => {
      inst.actions.rememberOpen(400)
    }, view, () => Stub)
    act(() => { screen.getByRole('tab', { name: 'B' }).click() })
    expect(activateTab).toHaveBeenCalledWith('b')
    act(() => { screen.getAllByLabelText('关闭标签')[0]!.click() })
    expect(closeTab).toHaveBeenCalledWith('a')
    act(() => { fireEvent.mouseDown(screen.getByTestId('xmart-workbench-tab-b'), { button: 1 }) })
    expect(closeTab).toHaveBeenCalledWith('b')
  })

  it('restores a persisted open width into the layout store on mount', () => {
    const { setWorkbench, reportOpen } = mount(0, 's-open', (inst) => {
      inst.actions.rememberOpen(520)
    })
    expect(setWorkbench).toHaveBeenCalledWith(520)
    expect(reportOpen).toHaveBeenCalledWith(true)
  })

  it('closes a leftover layout preference when this session last left the panel closed', () => {
    const { closeWorkbench, reportOpen } = mount(400, 's-closed')
    expect(closeWorkbench).toHaveBeenCalledOnce()
    expect(reportOpen).toHaveBeenCalledWith(false)
  })

  it('persists a later drag width after the session sync', () => {
    const { instance, rerender } = mount(0, 's-drag', (inst) => {
      inst.actions.rememberOpen(400)
    })
    act(() => { rerender({ width: 400 }) })
    act(() => { rerender({ width: 480 }) })
    expect(instance.getSnapshot()).toEqual({ open: true, width: 480 })
  })

  it('asks layout to adopt the remembered width when opening from a closed persist', () => {
    const { setWorkbench, instance, rerender } = mount(0, 's-reopen', (inst) => {
      inst.actions.rememberOpen(520)
      inst.actions.rememberClosed()
    })
    expect(instance.getSnapshot()).toEqual({ open: false, width: 520 })
    act(() => { rerender({ width: 400 }) })
    expect(setWorkbench).toHaveBeenCalledWith(520)
  })

  it('remembers a later close after the session sync', () => {
    const { instance, reportOpen, rerender } = mount(0, 's-close', (inst) => {
      inst.actions.rememberOpen(400)
    })
    act(() => { rerender({ width: 400 }) })
    act(() => { rerender({ width: 0 }) })
    expect(instance.getSnapshot()).toEqual({ open: false, width: 400 })
    expect(reportOpen).toHaveBeenCalledWith(false)
  })

  it('does not rewrite a closed persist when the leftover preference is already zero', () => {
    const { instance, reportOpen, rerender } = mount(400, 's-zero-closed')
    act(() => { rerender({ width: 0 }) })
    expect(instance.getSnapshot()).toEqual({ open: false, width: 400 })
    expect(reportOpen.mock.calls.at(-1)).toEqual([false])
  })
})
