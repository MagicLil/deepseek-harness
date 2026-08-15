// @vitest-environment jsdom
/**
 * WorkbenchColumn: editor tab strip, shell-type filtering, and body routing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { WorkbenchColumn } from '../src/client/WorkbenchColumn.tsx'
import type { WorkbenchColumnProps } from '../src/client/contract.ts'
import { EMPTY_WORKBENCH_VIEW } from '../src/client/service.ts'
import type { TabBodyProps, WorkbenchView } from '../src/client/types.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh) as never

function constantHook<T>(value: T) {
  return function useSelector<S>(sel: (s: T) => S): S {
    return sel(value)
  }
}

function Stub({ tab }: TabBodyProps) {
  return <div data-testid="xmart-workbench-stub">{tab.title}</div>
}

function viewOf(partial: Partial<WorkbenchView>): WorkbenchView {
  return { ...EMPTY_WORKBENCH_VIEW, ...partial }
}

function mount(
  view: WorkbenchView = EMPTY_WORKBENCH_VIEW,
  resolveBody: WorkbenchColumnProps['resolveBody'] = () => undefined,
) {
  const openTab = vi.fn()
  const closeTab = vi.fn()
  const activateTab = vi.fn()
  const props = {
    width: 400,
    sessionId: 's1' as SessionId,
    useSession: (() => null) as never,
    useSessions: (() => null) as never,
    useWorkspaces: (() => null) as never,
    openTab,
    closeTab,
    activateTab,
    resolveBody,
    useWorkbenchSession: constantHook(view),
    useWorkbenchRegistry: constantHook({ tabs: [], viewers: [], activities: [] }),
    t,
  } as WorkbenchColumnProps
  const utils = render(<WorkbenchColumn {...props} />)
  return { ...utils, openTab, closeTab, activateTab }
}

describe('WorkbenchColumn', () => {
  it('always renders the editor column and empty copy', () => {
    mount()
    expect(screen.getByTestId('xmart-workbench')).toBeTruthy()
    expect(screen.getByText('从资源管理器打开文件后，会显示在这里。')).toBeTruthy()
    expect(screen.getByTestId('xmart-workbench-tabbar')).toBeTruthy()
    expect(screen.queryByLabelText('关闭工作台')).toBeNull()
  })

  it('keeps the tab strip when the session view omits menu or tabs', () => {
    mount({ ...EMPTY_WORKBENCH_VIEW, menu: undefined as never, tabs: undefined as never })
    expect(screen.getByTestId('xmart-workbench-tabbar')).toBeTruthy()
    expect(screen.getByText('从资源管理器打开文件后，会显示在这里。')).toBeTruthy()
  })

  it('renders a registered tab body and a placeholder for an unknown type', () => {
    mount(viewOf({
      tabs: [{ id: 'demo:1', type: 'demo', title: '演示' }],
      activeTabId: 'demo:1',
      nextSeq: 2,
    }), type => type === 'demo' ? Stub : undefined)
    expect(screen.getByTestId('xmart-workbench-stub').textContent).toBe('演示')

    cleanup()
    mount(viewOf({
      tabs: [{ id: 'gone:1', type: 'gone', title: 'Gone' }],
      activeTabId: 'gone:1',
      nextSeq: 2,
    }))
    expect(screen.getByTestId('xmart-workbench-placeholder')).toBeTruthy()
    expect(screen.getByText('gone')).toBeTruthy()
  })

  it('keeps explorer / git / tasks / terminal off the editor strip', () => {
    mount(viewOf({
      tabs: [
        { id: 'explorer:1', type: 'explorer', title: '资源管理器' },
        { id: 'ed', type: 'editor', title: 'a.ts' },
      ],
      activeTabId: 'explorer:1',
      nextSeq: 3,
    }), () => Stub)
    expect(screen.queryByRole('tab', { name: '资源管理器' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'a.ts' })).toBeTruthy()
    expect(screen.getByTestId('xmart-workbench-stub').textContent).toBe('a.ts')
  })

  it('keeps the tab strip when the file body throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Boom(): never {
      throw new Error('boom')
    }
    mount(viewOf({
      tabs: [{ id: 'ed', type: 'editor', title: 'B.java', path: '/B.java' }],
      activeTabId: 'ed',
      nextSeq: 2,
    }), () => Boom)
    expect(screen.getByRole('tab', { name: 'B.java' })).toBeTruthy()
    expect(screen.getByTestId('xmart-workbench-crashed').textContent).toContain('这个文件打不开。关掉标签再点一次，或换一个文件。')
    expect(screen.getByTestId('xmart-workbench-crashed-detail').textContent).toBe('boom')
    cleanup()
    function Empty(): never {
      throw new Error('')
    }
    mount(viewOf({
      tabs: [{ id: 'ed2', type: 'editor', title: 'C.java', path: '/C.java' }],
      activeTabId: 'ed2',
      nextSeq: 3,
    }), () => Empty)
    expect(screen.queryByTestId('xmart-workbench-crashed-detail')).toBeNull()
    cleanup()
    function Nope(): never {
      throw 'nope'
    }
    mount(viewOf({
      tabs: [{ id: 'ed3', type: 'editor', title: 'D.java', path: '/D.java' }],
      activeTabId: 'ed3',
      nextSeq: 4,
    }), () => Nope)
    expect(screen.getByTestId('xmart-workbench-crashed-detail').textContent).toBe('nope')
    spy.mockRestore()
  })

  it('activates and closes tabs from the strip', () => {
    const { activateTab, closeTab } = mount(viewOf({
      tabs: [
        { id: 'a', type: 'demo', title: 'A' },
        { id: 'b', type: 'demo', title: 'B' },
      ],
      activeTabId: 'a',
      nextSeq: 3,
      menu: [{ id: 'demo', title: '演示', disabled: false }],
    }), () => Stub)
    act(() => { screen.getByRole('tab', { name: 'B' }).click() })
    expect(activateTab).toHaveBeenCalledWith('b')
    act(() => { screen.getAllByLabelText('关闭标签')[0]!.click() })
    expect(closeTab).toHaveBeenCalledWith('a')
    act(() => { fireEvent.mouseDown(screen.getByTestId('xmart-workbench-tab-b'), { button: 1 }) })
    expect(closeTab).toHaveBeenCalledWith('b')
  })
})
