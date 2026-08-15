// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GitAccessError, type GitStatus } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { GitTab, gitMenuAnchor, handleGitMenuSelect } from '../src/client/GitTab.tsx'
import { createWorkbenchFilesStore } from '../src/client/files-store.ts'
import { zh } from '../src/client/locales.ts'

beforeEach(() => { localStorage.clear() })
afterEach(() => {
  localStorage.clear()
  cleanup()
})

const t = makeTranslate(zh, commonZh)
const status: GitStatus = {
  root: '/ws',
  branch: 'main',
  ahead: 1,
  behind: 0,
  detached: false,
  changes: [{ path: 'a.ts', status: 'modified' }],
}

const emptyListing = { path: '/ws', entries: [], truncated: false }

function mount(opts?: {
  cwd?: string
  gitStatus?: (path: string) => Promise<GitStatus>
  gitLog?: () => Promise<{ hash: string; subject: string; author: string; timestamp: number }[]>
  gitCommit?: (path: string, message: string) => Promise<unknown>
  gitStage?: (path: string, files: readonly string[]) => Promise<void>
  listEntries?: () => Promise<typeof emptyListing>
}) {
  const files = createWorkbenchFilesStore()
  const gitStatus = opts?.gitStatus ?? vi.fn(async () => status)
  const gitLog = opts?.gitLog ?? vi.fn(async () => [
    { hash: 'abcdef1', subject: 'init', author: 'Ann', timestamp: 1 },
  ])
  const gitStage = opts?.gitStage ?? vi.fn(async () => {})
  const gitUnstage = vi.fn(async () => {})
  const gitDiscard = vi.fn(async () => {})
  const gitCommit = opts?.gitCommit ?? vi.fn(async () => ({ root: '/ws', hash: 'abc' }))
  const openFile = vi.fn()
  const openDiff = vi.fn()
  render(
    <GitTab
      tab={{ id: 'g', type: 'git', title: 'Git' }}
      visible
      sessionId="s1"
      t={t}
      getCwd={() => opts?.cwd === undefined ? '/ws' : opts.cwd}
      watchSessions={(fn) => {
        fn()
        return () => {}
      }}
      listEntries={opts?.listEntries ?? (async () => emptyListing)}
      gitStatus={gitStatus}
      gitStage={gitStage}
      gitUnstage={gitUnstage}
      gitDiscard={gitDiscard}
      gitCommit={gitCommit}
      gitLog={gitLog}
      openFile={openFile}
      openDiff={openDiff}
      files={files}
    />,
  )
  return { files, gitStage, gitUnstage, gitDiscard, gitCommit, openFile, openDiff }
}

describe('GitTab', () => {
  it('shows the empty-workspace copy', () => {
    mount({ cwd: '' })
    expect(screen.getByText('当前会话没有工作区。请先在对话里选一个工作区，或用最右列添加。')).toBeTruthy()
  })

  it('shows missing and error states, then retries', async () => {
    mount({
      gitStatus: async () => {
        throw new GitAccessError({ code: 'git-unavailable', message: 'no' } as never)
      },
    })
    await act(async () => { await Promise.resolve() })
    expect(await screen.findByText(/当前打开的文件夹不是 Git 仓库/)).toBeTruthy()
    cleanup()
    const { files } = mount({
      gitStatus: async () => {
        throw new GitAccessError({ code: 'git-failed', message: 'no' } as never)
      },
    })
    expect(await screen.findByText('Git 状态读取失败。')).toBeTruthy()
    expect(screen.getByText('no')).toBeTruthy()
    fireEvent.click(screen.getByText('重试'))
    expect(files.getSnapshot().refreshNonce).toBeGreaterThan(0)
    cleanup()
    mount({ gitStatus: async () => { throw new Error('plain') } })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText(/main ↑1 ↓0/)).toBeTruthy()
  })

  it('renders changes, commits, and opens a file', async () => {
    const { gitCommit, openFile, files } = mount()
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText(/main ↑1 ↓0/)).toBeTruthy()
    expect(screen.getByText(/abcdef1 init/)).toBeTruthy()
    fireEvent.click(screen.getByText('M a.ts'))
    expect(openFile).toHaveBeenCalledWith('/ws/a.ts')
    fireEvent.change(screen.getByLabelText('提交说明（Ctrl+Enter）'), { target: { value: '   ' } })
    fireEvent.submit(screen.getByLabelText('提交说明（Ctrl+Enter）').closest('form') as HTMLFormElement)
    expect(gitCommit).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('提交说明（Ctrl+Enter）'), { target: { value: 'fix' } })
    fireEvent.keyDown(screen.getByLabelText('提交说明（Ctrl+Enter）'), { key: 'Enter', ctrlKey: true })
    fireEvent.submit(screen.getByLabelText('提交说明（Ctrl+Enter）').closest('form') as HTMLFormElement)
    await act(async () => { await Promise.resolve() })
    expect(gitCommit).toHaveBeenCalledWith('/ws', 'fix')
    fireEvent.change(screen.getByLabelText('提交说明（Ctrl+Enter）'), { target: { value: 'again' } })
    fireEvent.keyDown(screen.getByLabelText('提交说明（Ctrl+Enter）'), { key: 'Enter' })
    fireEvent.keyDown(screen.getByLabelText('提交说明（Ctrl+Enter）'), { key: 'Enter', metaKey: true })
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByText('刷新'))
    expect(files.getSnapshot().refreshNonce).toBeGreaterThan(0)
  })

  it('treats a non-array log as empty history', async () => {
    mount({ gitLog: async () => undefined as never })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText(/main ↑1 ↓0/)).toBeTruthy()
    expect(screen.queryByText(/abcdef1/)).toBeNull()
  })

  it('keeps status when gitLog throws', async () => {
    mount({
      gitLog: () => {
        throw new Error('no method')
      },
    })
    expect(await screen.findByText(/main ↑1 ↓0/)).toBeTruthy()
  })

  it('discovers git repos in child folders and can switch between them', async () => {
    const gitStatus = vi.fn(async (path: string) => {
      if (path === '/ws') {
        throw new GitAccessError({ code: 'git-unavailable', message: 'not a git repository' } as never)
      }
      if (path.endsWith('xmart-web')) {
        return { ...status, root: '/ws/xmart-web', branch: 'web' }
      }
      return { ...status, root: '/ws/xmart-backend', branch: 'backend' }
    })
    mount({
      gitStatus,
      listEntries: async () => ({
        path: '/ws',
        truncated: false,
        entries: [
          { name: 'xmart-backend', path: '/ws/xmart-backend', kind: 'directory', hidden: false },
          { name: 'xmart-web', path: '/ws/xmart-web', kind: 'directory', hidden: false },
          { name: '.cursor', path: '/ws/.cursor', kind: 'directory', hidden: true },
        ],
      }),
    })
    expect(await screen.findByText(/backend ↑1 ↓0/)).toBeTruthy()
    const picker = screen.getByTestId('xmart-workbench-git-repo') as HTMLSelectElement
    expect(picker.options).toHaveLength(2)
    fireEvent.change(picker, { target: { value: '/ws/xmart-web' } })
    expect(await screen.findByText(/web ↑1 ↓0/)).toBeTruthy()
  })

  it('shows an error when the selected child repo fails', async () => {
    let webReads = 0
    mount({
      gitStatus: async (path: string) => {
        if (path === '/ws') {
          throw new GitAccessError({ code: 'git-unavailable', message: 'not a git repository' } as never)
        }
        if (path.endsWith('web')) {
          webReads += 1
          if (webReads > 1) throw new GitAccessError({ code: 'git-failed', message: 'boom' } as never)
          return { ...status, root: '/ws/web', branch: 'web' }
        }
        return { ...status, root: '/ws/backend', branch: 'backend' }
      },
      listEntries: async () => ({
        path: '/ws',
        truncated: false,
        entries: [
          { name: 'backend', path: '/ws/backend', kind: 'directory', hidden: false },
          { name: 'web', path: '/ws/web', kind: 'directory', hidden: false },
        ],
      }),
    })
    expect(await screen.findByText(/backend ↑1 ↓0/)).toBeTruthy()
    fireEvent.change(screen.getByTestId('xmart-workbench-git-repo'), { target: { value: '/ws/web' } })
    expect(await screen.findByText('Git 状态读取失败。')).toBeTruthy()
    expect(screen.getByText('boom')).toBeTruthy()
  })

  it('stays missing when listing children fails', async () => {
    mount({
      gitStatus: async () => {
        throw new GitAccessError({ code: 'git-unavailable', message: 'not a git repository' } as never)
      },
      listEntries: async () => { throw new Error('no list') },
    })
    expect(await screen.findByText(/当前打开的文件夹不是 Git 仓库/)).toBeTruthy()
  })

  it('shows an error when a discovered child repo then fails to load', async () => {
    let backendReads = 0
    mount({
      gitStatus: async (path: string) => {
        if (path === '/ws') {
          throw new GitAccessError({ code: 'git-unavailable', message: 'not a git repository' } as never)
        }
        backendReads += 1
        if (backendReads === 1) return { ...status, root: '/ws/backend' }
        throw new GitAccessError({ code: 'git-failed', message: 'lock' } as never)
      },
      listEntries: async () => ({
        path: '/ws',
        truncated: false,
        entries: [{ name: 'backend', path: '/ws/backend', kind: 'directory', hidden: false }],
      }),
    })
    expect(await screen.findByText('Git 状态读取失败。')).toBeTruthy()
    expect(screen.getByText('lock')).toBeTruthy()
  })

  it('stays missing when a discovered child is not a repo on the second read', async () => {
    let backendReads = 0
    mount({
      gitStatus: async (path: string) => {
        if (path === '/ws') {
          throw new GitAccessError({ code: 'git-unavailable', message: 'not a git repository' } as never)
        }
        backendReads += 1
        if (backendReads === 1) return { ...status, root: '/ws/backend' }
        throw new GitAccessError({ code: 'git-unavailable', message: 'gone' } as never)
      },
      listEntries: async () => ({
        path: '/ws',
        truncated: false,
        entries: [{ name: 'backend', path: '/ws/backend', kind: 'directory', hidden: false }],
      }),
    })
    expect(await screen.findByText(/当前打开的文件夹不是 Git 仓库/)).toBeTruthy()
  })

  it('omits an empty host error detail', async () => {
    mount({
      gitStatus: async () => {
        throw new GitAccessError({ code: 'git-failed', message: '' } as never)
      },
    })
    expect(await screen.findByText('Git 状态读取失败。')).toBeTruthy()
    expect(screen.queryByText('no')).toBeNull()
  })

  it('shows clean and detached copy', async () => {
    mount({
      gitStatus: async () => ({
        root: '/ws', branch: 'HEAD', ahead: 0, behind: 0, detached: true, changes: [],
      }),
      gitLog: async () => [],
    })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText(/分离 HEAD/)).toBeTruthy()
    expect(screen.getByText('工作区是干净的。')).toBeTruthy()
  })

  it('runs context-menu verbs and still refreshes after a failed commit', async () => {
    const { gitStage, openDiff, files } = mount({
      gitCommit: async () => { throw new Error('no') },
    })
    await act(async () => { await Promise.resolve() })
    fireEvent.contextMenu(screen.getByText('M a.ts'))
    fireEvent.click(screen.getByText('暂存'))
    await act(async () => { await Promise.resolve() })
    expect(gitStage).toHaveBeenCalledWith('/ws', ['a.ts'])
    fireEvent.contextMenu(screen.getByText('M a.ts'))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.contextMenu(screen.getByText('M a.ts'))
    fireEvent.click(screen.getByText('查看工作区差异'))
    expect(openDiff).toHaveBeenCalledWith('worktree', 'a.ts')
    fireEvent.change(screen.getByLabelText('提交说明（Ctrl+Enter）'), { target: { value: 'x' } })
    fireEvent.submit(screen.getByLabelText('提交说明（Ctrl+Enter）').closest('form') as HTMLFormElement)
    await act(async () => { await Promise.resolve() })
    expect(files.getSnapshot().refreshNonce).toBeGreaterThan(0)
  })

  it('ignores a late status after unmount', async () => {
    let settle: (value: GitStatus) => void = () => {}
    const view = render(
      <GitTab
        tab={{ id: 'g', type: 'git', title: 'Git' }}
        visible
        sessionId="s1"
        t={t}
        getCwd={() => '/ws'}
        watchSessions={() => () => {}}
        gitStatus={() => new Promise<GitStatus>((resolve) => { settle = resolve })}
        gitStage={async () => {}}
        gitUnstage={async () => {}}
        gitDiscard={async () => {}}
        gitCommit={async () => ({})}
        gitLog={async () => []}
        openFile={() => {}}
        openDiff={() => {}}
        files={createWorkbenchFilesStore()}
      />,
    )
    expect(screen.getByText('正在读取 Git 状态…')).toBeTruthy()
    view.unmount()
    await act(async () => { settle(status); await Promise.resolve() })
    cleanup()
    let fail: (reason: unknown) => void = () => {}
    const dying = render(
      <GitTab
        tab={{ id: 'g', type: 'git', title: 'Git' }}
        visible
        sessionId="s1"
        t={t}
        getCwd={() => '/ws'}
        watchSessions={() => () => {}}
        listEntries={async () => emptyListing}
        gitStatus={() => new Promise((_, reject) => { fail = reject })}
        gitStage={async () => {}}
        gitUnstage={async () => {}}
        gitDiscard={async () => {}}
        gitCommit={async () => ({})}
        gitLog={async () => []}
        openFile={() => {}}
        openDiff={() => {}}
        files={createWorkbenchFilesStore()}
      />,
    )
    dying.unmount()
    await act(async () => { fail(new Error('late')); await Promise.resolve() })
  })
})

describe('gitMenuAnchor', () => {
  it('uses the click point or the origin', () => {
    expect(gitMenuAnchor(null)).toMatchObject({ x: 0, y: 0 })
    expect(gitMenuAnchor(null).toJSON()).toEqual({})
    expect(gitMenuAnchor({ x: 4, y: 8 })).toMatchObject({ x: 4, y: 8, top: 8, left: 4 })
  })
})

describe('handleGitMenuSelect', () => {
  it('no-ops without a change and dispatches every verb', () => {
    const run = vi.fn((op: () => Promise<unknown>) => { void op() })
    const gitStage = vi.fn(async () => {})
    const gitUnstage = vi.fn(async () => {})
    const gitDiscard = vi.fn(async () => {})
    const openDiff = vi.fn()
    const openFile = vi.fn()
    const ops = { run, gitStage, gitUnstage, gitDiscard, openDiff, openFile }
    handleGitMenuSelect('stage', undefined, '/ws', '/ws', ops)
    expect(run).not.toHaveBeenCalled()
    const change = { path: 'a.ts', status: 'modified' as const }
    handleGitMenuSelect('stage', change, '/ws', '/ws', ops)
    handleGitMenuSelect('unstage', change, '/ws', '/ws', ops)
    handleGitMenuSelect('discard', change, '/ws', '/ws', ops)
    handleGitMenuSelect('diff-work', change, '/ws', '/ws', ops)
    handleGitMenuSelect('diff-staged', change, '/ws', '/ws', ops)
    handleGitMenuSelect('open', change, '/ws', '/ws', ops)
    handleGitMenuSelect('other', change, '/ws', '/ws', ops)
    expect(gitStage).toHaveBeenCalledWith('/ws', ['a.ts'])
    expect(gitUnstage).toHaveBeenCalledWith('/ws', ['a.ts'])
    expect(gitDiscard).toHaveBeenCalledWith('/ws', ['a.ts'])
    expect(openDiff).toHaveBeenCalledWith('worktree', 'a.ts')
    expect(openDiff).toHaveBeenCalledWith('staged', 'a.ts')
    expect(openFile).toHaveBeenCalledWith('/ws/a.ts')
  })
})
