// @vitest-environment jsdom
/**
 * MenuBar: product menus and keyboard accelerators.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { MenuBar } from '../src/client/MenuBar.tsx'
import type { MenuBarProps } from '../src/client/contract.ts'
import { EMPTY_WORKBENCH_VIEW } from '../src/client/service.ts'
import type { WorkbenchView } from '../src/client/types.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh) as never

function constantHook<T>(value: T) {
  return function useSelector<S>(sel: (s: T) => S): S {
    return sel(value)
  }
}

function mount(view: WorkbenchView = EMPTY_WORKBENCH_VIEW) {
  const run = vi.fn()
  const props = {
    sessionId: 's1' as SessionId,
    useSession: (() => null) as never,
    useSessions: (() => null) as never,
    useWorkspaces: (() => null) as never,
    run,
    useWorkbenchSession: constantHook(view),
    t,
  } as MenuBarProps
  render(<MenuBar {...props} />)
  return { run }
}

describe('MenuBar', () => {
  it('runs File / View / Terminal commands from the product menus', () => {
    const { run } = mount({
      ...EMPTY_WORKBENCH_VIEW,
      tabs: [{ id: 'editor:1', type: 'editor', title: 'a.ts', path: '/a.ts' }],
    })
    act(() => { screen.getByTestId('xmart-menu-file').click() })
    act(() => { screen.getByRole('menuitem', { name: '新会话' }).click() })
    act(() => { screen.getByTestId('xmart-menu-file').click() })
    act(() => { screen.getByRole('menuitem', { name: '打开工作区…' }).click() })
    act(() => { screen.getByTestId('xmart-menu-file').click() })
    act(() => { screen.getByRole('menuitem', { name: '保存' }).click() })
    act(() => { screen.getByTestId('xmart-menu-file').click() })
    act(() => { screen.getByRole('menuitem', { name: '关闭编辑器' }).click() })
    act(() => { screen.getByTestId('xmart-menu-file').click() })
    act(() => { screen.getByRole('menuitem', { name: '设置' }).click() })
    act(() => { screen.getByTestId('xmart-menu-view').click() })
    act(() => { screen.getByRole('menuitem', { name: '源代码管理' }).click() })
    act(() => { screen.getByTestId('xmart-menu-view').click() })
    act(() => { screen.getByRole('menuitem', { name: '切换左侧边栏' }).click() })
    act(() => { screen.getByTestId('xmart-menu-view').click() })
    act(() => { screen.getByRole('menuitem', { name: '切换会话列表' }).click() })
    act(() => { screen.getByTestId('xmart-menu-terminal').click() })
    act(() => { screen.getByRole('menuitem', { name: '新建终端' }).click() })
    act(() => { screen.getByTestId('xmart-menu-terminal').click() })
    act(() => { screen.getByRole('menuitem', { name: '切换终端' }).click() })
    expect(run.mock.calls.map(row => row[0])).toEqual([
      'session-new', 'workspace-open', 'file-save', 'file-close', 'settings-open',
      'activity-git', 'sidebar-primary', 'sidebar-sessions',
      'terminal-new', 'terminal-toggle',
    ])
  })

  it('disables New Terminal at the session quota and Close Editor when empty', () => {
    mount({
      ...EMPTY_WORKBENCH_VIEW,
      tabs: [
        { id: 'terminal:1', type: 'terminal', title: '终端 1' },
        { id: 'terminal:2', type: 'terminal', title: '终端 2' },
        { id: 'terminal:3', type: 'terminal', title: '终端 3' },
      ],
    })
    act(() => { screen.getByTestId('xmart-menu-terminal').click() })
    expect((screen.getByRole('menuitem', { name: '新建终端' }) as HTMLButtonElement).disabled).toBe(true)
    act(() => { screen.getByTestId('xmart-menu-file').click() })
    expect((screen.getByRole('menuitem', { name: '关闭编辑器' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('runs accelerators and ignores chords that are not ours', () => {
    const { run } = mount()
    act(() => { fireEvent.keyDown(window, { key: '`', ctrlKey: true, code: 'Backquote' }) })
    act(() => { fireEvent.keyDown(window, { key: 'n', ctrlKey: true, code: 'KeyN' }) })
    act(() => { fireEvent.keyDown(window, { key: 'o', metaKey: true, code: 'KeyO' }) })
    act(() => { fireEvent.keyDown(window, { key: 's', ctrlKey: true, code: 'KeyS' }) })
    act(() => { fireEvent.keyDown(window, { key: 'f', ctrlKey: true, code: 'KeyF' }) })
    act(() => { fireEvent.keyDown(window, { key: 'h', ctrlKey: true, code: 'KeyH' }) })
    act(() => { fireEvent.keyDown(window, { key: 'p', ctrlKey: true, code: 'KeyP' }) })
    act(() => { fireEvent.keyDown(window, { key: 'g', ctrlKey: true, code: 'KeyG' }) })
    act(() => { fireEvent.keyDown(window, { key: 'P', ctrlKey: true, shiftKey: true, code: 'KeyP' }) })
    act(() => { fireEvent.keyDown(window, { key: ',', ctrlKey: true, code: 'Comma' }) })
    act(() => { fireEvent.keyDown(window, { key: 'b', ctrlKey: true, code: 'KeyB' }) })
    act(() => { fireEvent.keyDown(window, { key: 'L', ctrlKey: true, shiftKey: true, code: 'KeyL' }) })
    act(() => { fireEvent.keyDown(window, { key: '`', ctrlKey: true, altKey: true, code: 'Backquote' }) })
    act(() => { fireEvent.keyDown(window, { key: 'j', ctrlKey: true, code: 'KeyJ' }) })
    act(() => { fireEvent.keyDown(window, { key: 's', ctrlKey: true, shiftKey: true, code: 'KeyS' }) })
    act(() => { fireEvent.keyDown(window, { key: 'b', ctrlKey: true, shiftKey: true, code: 'KeyB' }) })
    act(() => { fireEvent.keyDown(window, { key: 'l', ctrlKey: true, code: 'KeyL' }) })
    expect(run.mock.calls.map(row => row[0])).toEqual([
      'terminal-toggle', 'session-new', 'workspace-open', 'file-save',
      'file-find', 'file-replace', 'file-quick-open', 'file-goto-line',
      'settings-open', 'sidebar-primary', 'sidebar-sessions',
    ])
  })

  it('runs web Edit via execCommand and shows About', () => {
    const exec = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { configurable: true, value: exec })
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const { run } = mount()
    act(() => { screen.getByTestId('xmart-menu-edit').click() })
    act(() => { screen.getByRole('menuitem', { name: '撤销' }).click() })
    act(() => { screen.getByTestId('xmart-menu-edit').click() })
    act(() => { screen.getByRole('menuitem', { name: '重做' }).click() })
    act(() => { screen.getByTestId('xmart-menu-edit').click() })
    act(() => { screen.getByRole('menuitem', { name: '剪切' }).click() })
    act(() => { screen.getByTestId('xmart-menu-edit').click() })
    act(() => { screen.getByRole('menuitem', { name: '复制' }).click() })
    act(() => { screen.getByTestId('xmart-menu-edit').click() })
    act(() => { screen.getByRole('menuitem', { name: '粘贴' }).click() })
    act(() => { screen.getByTestId('xmart-menu-edit').click() })
    act(() => { screen.getByRole('menuitem', { name: '全选' }).click() })
    act(() => { screen.getByTestId('xmart-menu-edit').click() })
    act(() => { screen.getByRole('menuitem', { name: '查找' }).click() })
    act(() => { screen.getByTestId('xmart-menu-edit').click() })
    act(() => { screen.getByRole('menuitem', { name: '替换' }).click() })
    act(() => { screen.getByTestId('xmart-menu-go').click() })
    act(() => { screen.getByRole('menuitem', { name: '转到文件' }).click() })
    act(() => { screen.getByTestId('xmart-menu-go').click() })
    act(() => { screen.getByRole('menuitem', { name: '转到定义' }).click() })
    act(() => { screen.getByTestId('xmart-menu-help').click() })
    act(() => { screen.getByRole('menuitem', { name: '关于万物智汇' }).click() })
    expect(exec.mock.calls.map(row => row[0])).toEqual([
      'undo', 'redo', 'cut', 'copy', 'paste', 'selectAll',
    ])
    expect(run.mock.calls.map(row => row[0])).toEqual([
      'file-find', 'file-replace', 'file-quick-open', 'file-goto-definition',
    ])
    expect(alert).toHaveBeenCalledWith('万物智汇\n桌面 / Web AI Agent 工作台。')
    alert.mockRestore()
  })

  it('closes an open menu when its title is clicked again', () => {
    mount()
    act(() => { screen.getByTestId('xmart-menu-file').click() })
    expect(screen.getByRole('menuitem', { name: '新会话' })).toBeTruthy()
    act(() => { screen.getByTestId('xmart-menu-file').click() })
    expect(screen.queryByRole('menuitem', { name: '新会话' })).toBeNull()
  })
})
