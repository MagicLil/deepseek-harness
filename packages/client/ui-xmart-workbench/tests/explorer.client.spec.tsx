// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GitAccessError, type FileListing, type GitStatus } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { ExplorerTab, menuAnchorRect, parentOf } from '../src/client/ExplorerTab.tsx'
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
  roots?: { path: string; title: string }[]
  listEntries?: (path: string, signal?: AbortSignal) => Promise<FileListing>
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
  const listEntries = opts?.listEntries ?? vi.fn(async (path: string, _signal?: AbortSignal) => ({
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
    changes: [{ path: 'a.ts', status: 'modified', area: 'worktree' }],
  }))
  render(
    <ExplorerTab
      tab={{ id: 'ex', type: 'explorer', title: '资源管理器' }}
      visible
      sessionId="s1"
      t={t}
      getRoots={() => opts?.roots ?? (opts?.cwd === undefined ? [{ path: '/ws', title: 'ws' }] : opts.cwd === '' ? [] : [{ path: opts.cwd, title: 'ws' }])}
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

describe('parentOf', () => {
  it('uses a folder itself and a file parent', () => {
    expect(parentOf({ name: 'src', path: '/ws/src', kind: 'directory', hidden: false })).toBe('/ws/src')
    expect(parentOf({ name: 'a.ts', path: '/ws/a.ts', kind: 'file', hidden: false })).toBe('/ws')
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
    expect(screen.getByText('还没有可显示的工作区目录。请在最右列添加工作区。')).toBeTruthy()
  })

  it('loads the current session folder on mount without a section title', async () => {
    const listEntries = vi.fn(async (path: string) => ({
      path,
      truncated: false,
      entries: [{ name: 'a.ts', path: 'D:\\hmdp\\a.ts', kind: 'file' as const, hidden: false }],
    }))
    mount({
      roots: [{ path: 'D:\\hmdp', title: 'hmdp' }],
      listEntries,
    })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('xmart-workbench-root-hmdp')).toBeTruthy()
    expect(screen.getByText('a.ts')).toBeTruthy()
    expect(screen.queryByText('hmdp')).toBeNull()
    expect(listEntries.mock.calls.some(call => call[0] === 'D:\\hmdp')).toBe(true)
  })

  it('labels each tree when more than one root is supplied', async () => {
    const listEntries = vi.fn(async (path: string) => ({
      path,
      truncated: false,
      entries: path === 'D:\\hmdp'
        ? [{ name: 'a.ts', path: 'D:\\hmdp\\a.ts', kind: 'file' as const, hidden: false }]
        : [{ name: 'b.ts', path: 'D:\\tool\\b.ts', kind: 'file' as const, hidden: false }],
    }))
    mount({
      roots: [
        { path: 'D:\\hmdp', title: 'hmdp' },
        { path: 'D:\\tool', title: 'tool' },
      ],
      listEntries,
    })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('hmdp')).toBeTruthy()
    expect(screen.getByText('tool')).toBeTruthy()
    expect(screen.getByText('a.ts')).toBeTruthy()
    expect(screen.getByText('b.ts')).toBeTruthy()
  })

  it('picks up workspace roots when the registry arrives', async () => {
    let roots: { path: string; title: string }[] = []
    let notify = () => {}
    render(
      <ExplorerTab
        tab={{ id: 'ex', type: 'explorer', title: '资源管理器' }}
        visible
        sessionId="s1"
        t={t}
        getRoots={() => roots}
        watchSessions={(fn) => {
          notify = fn
          return () => {}
        }}
        listEntries={async () => ({
          path: '/ws',
          truncated: false,
          entries: [{ name: 'a.ts', path: '/ws/a.ts', kind: 'file', hidden: false }],
        })}
        gitStatus={async () => ({
          root: '/ws', branch: 'main', ahead: 0, behind: 0, detached: false, changes: [],
        })}
        writeFile={async () => {}}
        createDirectory={async () => '/ws/n'}
        openSystem={async () => {}}
        openFile={() => {}}
        mentionFile={() => {}}
        files={createWorkbenchFilesStore()}
      />,
    )
    expect(screen.getByText('还没有可显示的工作区目录。请在最右列添加工作区。')).toBeTruthy()
    roots = [{ path: '/ws', title: 'ws' }]
    act(() => { notify() })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('xmart-workbench-root-ws')).toBeTruthy()
    expect(screen.getByText('a.ts')).toBeTruthy()
  })

  it('relists the workspace when the refresh nonce is bumped', async () => {
    let names = ['a.ts']
    const listEntries = vi.fn(async (path: string) => ({
      path,
      truncated: false,
      entries: names.map(name => ({
        name, path: `/ws/${name}`, kind: 'file' as const, hidden: false,
      })),
    }))
    const { files } = mount({ listEntries })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('a.ts')).toBeTruthy()
    expect(screen.queryByText('b.ts')).toBeNull()
    expect(screen.queryByText('新建文件')).toBeNull()
    expect(screen.queryByText('新建文件夹')).toBeNull()
    names = ['a.ts', 'b.ts']
    act(() => { files.bumpRefresh() })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('b.ts')).toBeTruthy()
    expect(listEntries.mock.calls.length).toBeGreaterThan(1)
  })

  it('creates files and folders from the row context menu', async () => {
    const { writeFile, createDirectory, files } = mount()
    await act(async () => { await Promise.resolve() })
    fireEvent.contextMenu(screen.getByText('src'))
    fireEvent.click(screen.getByText('新建文件'))
    fireEvent.change(screen.getByLabelText('文件名'), { target: { value: 'bad/name' } })
    fireEvent.submit(screen.getByLabelText('文件名').closest('form') as HTMLFormElement)
    expect(writeFile).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('文件名'), { target: { value: 'n.ts' } })
    fireEvent.submit(screen.getByLabelText('文件名').closest('form') as HTMLFormElement)
    await act(async () => { await Promise.resolve() })
    expect(writeFile).toHaveBeenCalledWith('/ws/src/n.ts', '')
    fireEvent.contextMenu(screen.getByText('a.ts'))
    fireEvent.click(screen.getByText('新建文件夹'))
    fireEvent.change(screen.getByLabelText('文件夹名'), { target: { value: 'lib' } })
    fireEvent.submit(screen.getByLabelText('文件夹名').closest('form') as HTMLFormElement)
    await act(async () => { await Promise.resolve() })
    expect(createDirectory).toHaveBeenCalledWith('/ws', 'lib')
    fireEvent.contextMenu(screen.getByText('src'))
    fireEvent.click(screen.getByText('新建文件'))
    fireEvent.click(screen.getByText('取消'))
    expect(files.getSnapshot().refreshNonce).toBeGreaterThan(0)
    cleanup()
    mount({ writeFile: async () => { throw new Error('no') } })
    await act(async () => { await Promise.resolve() })
    fireEvent.contextMenu(screen.getByText('src'))
    fireEvent.click(screen.getByText('新建文件'))
    fireEvent.change(screen.getByLabelText('文件名'), { target: { value: 'z.ts' } })
    fireEvent.submit(screen.getByLabelText('文件名').closest('form') as HTMLFormElement)
    await act(async () => { await Promise.resolve() })
    cleanup()
    mount({ createDirectory: async () => { throw new Error('no') } })
    await act(async () => { await Promise.resolve() })
    fireEvent.contextMenu(screen.getByText('src'))
    fireEvent.click(screen.getByText('新建文件夹'))
    fireEvent.change(screen.getByLabelText('文件夹名'), { target: { value: 'z' } })
    fireEvent.submit(screen.getByLabelText('文件夹名').closest('form') as HTMLFormElement)
    await act(async () => { await Promise.resolve() })
  })

  it('keeps the opened file row selected', async () => {
    let opened: string | undefined
    const listeners = new Set<() => void>()
    render(
      <ExplorerTab
        tab={{ id: 'ex', type: 'explorer', title: '资源管理器' }}
        visible
        sessionId="s1"
        t={t}
        getRoots={() => [{ path: '/ws', title: 'ws' }]}
        watchSessions={() => () => {}}
        listEntries={async path => ({
          path,
          truncated: false,
          entries: path === '/ws'
            ? [{ name: 'a.ts', path: '/ws/a.ts', kind: 'file' as const, hidden: false }]
            : [],
        })}
        gitStatus={async () => ({
          root: '/ws', branch: 'main', ahead: 0, behind: 0, detached: false, changes: [],
        })}
        writeFile={async () => {}}
        createDirectory={async () => '/ws/n'}
        openSystem={async () => {}}
        openFile={(path) => {
          opened = path
          for (const fn of listeners) fn()
        }}
        mentionFile={() => {}}
        files={createWorkbenchFilesStore()}
        getActivePath={() => opened}
        watchWorkbench={(fn) => {
          listeners.add(fn)
          return () => { listeners.delete(fn) }
        }}
      />,
    )
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByText('a.ts'))
    expect(screen.getByText('a.ts').closest('button')?.getAttribute('data-active')).toBe('true')
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
    let settle: (value: GitStatus) => void = () => {}
    const view = render(
      <ExplorerTab
        tab={{ id: 'ex', type: 'explorer', title: '资源管理器' }}
        visible
        sessionId="s1"
        t={t}
        getRoots={() => [{ path: '/ws', title: 'ws' }]}
        watchSessions={() => () => {}}
        listEntries={async () => ({ path: '/ws', entries: [], truncated: false })}
        gitStatus={() => new Promise<GitStatus>((resolve) => { settle = resolve })}
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
        getRoots={() => [{ path: '/ws', title: 'ws' }]}
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
