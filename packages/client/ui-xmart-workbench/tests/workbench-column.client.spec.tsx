// @vitest-environment jsdom
/**
 * WorkbenchColumn: empty-state copy, close gesture, and persist ↔ layout sync.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { WorkbenchColumn } from '../src/client/WorkbenchColumn.tsx'
import type { WorkbenchColumnProps } from '../src/client/contract.ts'
import { createWorkbenchStore } from '../src/client/stores.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh) as never

function hookOf<T>(inst: { subscribe: (fn: () => void) => () => void; getSnapshot: () => T }) {
  return function useSelector<S>(sel: (s: T) => S): S {
    return sel(useSyncExternalStore(inst.subscribe, inst.getSnapshot))
  }
}

function mount(width: number, scope = 's1', setup?: (inst: ReturnType<ReturnType<typeof createWorkbenchStore>['create']>) => void) {
  const instance = createWorkbenchStore().create(scope)
  setup?.(instance)
  const closeWorkbench = vi.fn()
  const setWorkbench = vi.fn()
  const reportOpen = vi.fn()
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
    t,
  } as WorkbenchColumnProps
  const utils = render(<WorkbenchColumn {...props} />)
  return {
    ...utils,
    instance,
    closeWorkbench,
    setWorkbench,
    reportOpen,
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

  it('renders the title, empty copy, and close control when open', () => {
    const { closeWorkbench } = mount(400, 's-ui', (inst) => {
      inst.actions.rememberOpen(400)
    })
    expect(screen.getByTestId('xmart-workbench')).toBeTruthy()
    expect(screen.getByText('工作台')).toBeTruthy()
    expect(screen.getByText('工作台即将提供文件、编辑、Git 与终端。')).toBeTruthy()
    act(() => { screen.getByLabelText('关闭工作台').click() })
    expect(closeWorkbench).toHaveBeenCalledOnce()
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
