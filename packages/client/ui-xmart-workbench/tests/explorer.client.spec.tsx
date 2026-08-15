// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GitAccessError } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { ExplorerTab, createParent, menuAnchorRect } from '../src/client/ExplorerTab.tsx'
import { createWorkbenchFilesStore } from '../src/client/files-store.ts'
import { zh } from '../src/client/locales.ts'

beforeEach(() => { localStorage.clear() })
afterEach(() => {
  localStorage.clear()
  cleanup()
})

const t = makeTranslate(zh, commonZh)

function mount(opts?: {
  cwd?: string
  listEntries?: () => Promise<{ path: string; entries: never[]; truncated: boolean }>
  gitStatus?: () => Promise<unknown>
  writeFile?: (path: string, content: string) => Promise<void>
  createDirectory?: (path: string, name: string) => Promise<string>
}) {
  const files = createWorkbenchFilesStore()
  const writeFile = opts?.writeFile ?? vi.fn(async () => {})
  const createDirectory = opts?.createDirectory ?? vi.fn(async () => '/ws/n')
  const openSystem = vi.fn(async () => {})
  const openFile = vi.fn()
  const mentionFile = vi.fn()
  const listEntries = opts?.listEntries ?? vi.fn(async (path: string) => ({
    path,
    truncated: false,
    entries: path === '/ws'
      ? [
        { name: 'a.ts', path: '/ws/a.ts', kind: 'file' as const, hidden: false },
        { name: 'src', path: '/ws/src', kind: 'directory' as const, hidden: false },
      ]
      : [],
  }))
  const gitStatus = opts?.gitStatus ?? vi.fn(async () => ({
    root: '/ws', branch: 'main', ahead: 0, behind: 0, detached: false,
    changes: [{ path: 'a.ts', status: 'modified' }],
  }))
  render(
    <ExplorerTab
      tab={{ id: 'ex', type: 'explorer', title: '资源管理器' }}
      visible
      sessionId="s1"
      t={t}
      getCwd={() => opts?.cwd === undefined ? '/ws' : opts.cwd}
      watchSessions={(fn) => {
        fn()
        return () => {}
      }}
      listEntries={listEntries}
      gitStatus={gitStatus as never}
      writeFile={writeFile}
      createDirectory={createDirectory}
      openSystem={openSystem}
      openFile={openFile}
      mentionFile={mentionFile}
      files={files}
    />,
  )
  return { files, writeFile, createDirectory, openSystem, openFile, mentionFile }
}

describe('createParent', () => {
  it('uses the last expanded folder', () => {
    expect(createParent('/ws', {})).toBe('/ws')
    expect(createParent('/ws', { '/ws/src': true })).toBe('/ws/src')
  })

  it('builds a menu anchor rect', () => {
    expect(menuAnchorRect(null).x).toBe(0)
    expect(menuAnchorRect(null).toJSON()).toEqual({})
    expect(menuAnchorRect({ entry: { name: 'a', path: '/a', kind: 'file', hidden: false }, x: 4, y: 8 }).y).toBe(8)
  })
})

describe('ExplorerTab', () => {
  it('shows the empty-workspace copy', () => {
    mount({ cwd: '' })
    expect(screen.getByText('当前会话没有工作区目录。')).toBeTruthy()
  })

  it('creates files and folders and refreshes', async () => {
    const { writeFile, createDirectory, files } = mount()
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByText('刷新'))
    fireEvent.click(screen.getByText('新建文件'))
    fireEvent.change(screen.getByLabelText('文件名'), { target: { value: 'bad/name' } })
    fireEvent.submit(screen.getByLabelText('文件名').closest('form') as HTMLFormElement)
    expect(writeFile).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('文件名'), { target: { value: 'n.ts' } })
    fireEvent.submit(screen.getByLabelText('文件名').closest('form') as HTMLFormElement)
    await act(async () => { await Promise.resolve() })
    expect(writeFile).toHaveBeenCalled()
    fireEvent.click(screen.getByText('新建文件夹'))
    fireEvent.change(screen.getByLabelText('文件夹名'), { target: { value: 'lib' } })
    fireEvent.submit(screen.getByLabelText('文件夹名').closest('form') as HTMLFormElement)
    await act(async () => { await Promise.resolve() })
    expect(createDirectory).toHaveBeenCalled()
    fireEvent.click(screen.getByText('新建文件'))
    fireEvent.click(screen.getByText('取消'))
    expect(files.getSnapshot().refreshNonce).toBeGreaterThan(0)
    cleanup()
    mount({ writeFile: async () => { throw new Error('no') } })
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByText('新建文件'))
    fireEvent.change(screen.getByLabelText('文件名'), { target: { value: 'z.ts' } })
    fireEvent.submit(screen.getByLabelText('文件名').closest('form') as HTMLFormElement)
    await act(async () => { await Promise.resolve() })
    cleanup()
    mount({ createDirectory: async () => { throw new Error('no') } })
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByText('新建文件夹'))
    fireEvent.change(screen.getByLabelText('文件夹名'), { target: { value: 'z' } })
    fireEvent.submit(screen.getByLabelText('文件夹名').closest('form') as HTMLFormElement)
    await act(async () => { await Promise.resolve() })
  })

  it('opens a file and runs context-menu actions', async () => {
    const writeText = vi.fn()
    Object.assign(navigator, { clipboard: { writeText } })
    const { openFile, mentionFile, openSystem } = mount()
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByText('src'))
    fireEvent.click(screen.getByText('a.ts'))
    expect(openFile).toHaveBeenCalledWith('/ws/a.ts')
    fireEvent.contextMenu(screen.getByText('a.ts'))
    fireEvent.click(screen.getByText('复制相对路径'))
    expect(writeText).toHaveBeenCalledWith('a.ts')
    fireEvent.contextMenu(screen.getByText('a.ts'))
    fireEvent.click(screen.getByText('复制绝对路径'))
    expect(writeText).toHaveBeenCalledWith('/ws/a.ts')
    fireEvent.contextMenu(screen.getByText('a.ts'))
    fireEvent.click(screen.getByText('@ 到输入框'))
    expect(mentionFile).toHaveBeenCalledWith('/ws/a.ts')
    fireEvent.contextMenu(screen.getByText('a.ts'))
    fireEvent.click(screen.getByText('用系统应用打开'))
    expect(openSystem).toHaveBeenCalledWith('/ws/a.ts')
    fireEvent.contextMenu(screen.getByText('a.ts'))
    fireEvent.keyDown(document, { key: 'Escape' })
  })

  it('swallows git errors', async () => {
    mount({
      gitStatus: async () => {
        throw new GitAccessError({ code: 'git-unavailable', message: 'no' } as never)
      },
    })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('xmart-workbench-explorer')).toBeTruthy()
    cleanup()
    mount({
      gitStatus: async () => {
        throw new GitAccessError({ code: 'git-failed', message: 'no' } as never)
      },
    })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('xmart-workbench-explorer')).toBeTruthy()
    cleanup()
    mount({
      gitStatus: async () => {
        throw new Error('plain')
      },
    })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('xmart-workbench-explorer')).toBeTruthy()
    cleanup()
    let settle: (value: unknown) => void = () => {}
    const view = render(
      <ExplorerTab
        tab={{ id: 'ex', type: 'explorer', title: '资源管理器' }}
        visible
        sessionId="s1"
        t={t}
        getCwd={() => '/ws'}
        watchSessions={() => () => {}}
        listEntries={async () => ({ path: '/ws', entries: [], truncated: false })}
        gitStatus={() => new Promise((resolve) => { settle = resolve })}
        writeFile={async () => {}}
        createDirectory={async () => '/ws/n'}
        openSystem={async () => {}}
        openFile={() => {}}
        mentionFile={() => {}}
        files={createWorkbenchFilesStore()}
      />,
    )
    view.unmount()
    await act(async () => { settle({
      root: '/ws', branch: 'main', ahead: 0, behind: 0, detached: false, changes: [],
    }); await Promise.resolve() })
    cleanup()
    let fail: (reason: unknown) => void = () => {}
    const dying = render(
      <ExplorerTab
        tab={{ id: 'ex', type: 'explorer', title: '资源管理器' }}
        visible
        sessionId="s1"
        t={t}
        getCwd={() => '/ws'}
        watchSessions={() => () => {}}
        listEntries={async () => ({ path: '/ws', entries: [], truncated: false })}
        gitStatus={() => new Promise((_, reject) => { fail = reject })}
        writeFile={async () => {}}
        createDirectory={async () => '/ws/n'}
        openSystem={async () => {}}
        openFile={() => {}}
        mentionFile={() => {}}
        files={createWorkbenchFilesStore()}
      />,
    )
    dying.unmount()
    await act(async () => { fail(new Error('late')); await Promise.resolve() })
  })
})
