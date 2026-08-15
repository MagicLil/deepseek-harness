// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GitAccessError, type FileListing, type GitStatus } from '@deepseek-ai/dsh-client-runtime/client'
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
  changes: [{ path: 'a.ts', status: 'modified', area: 'worktree' }],
}

const emptyListing: FileListing = { path: '/ws', entries: [], truncated: false }

function mount(opts?: {
  cwd?: string
  gitStatus?: (path: string) => Promise<GitStatus>
  gitLog?: () => Promise<{ hash: string; subject: string; author: string; timestamp: number }[]>
  gitCommit?: (path: string, message: string) => Promise<unknown>
  gitStage?: (path: string, files: readonly string[]) => Promise<void>
  gitSync?: (path: string, mode: 'fetch' | 'pull' | 'push') => Promise<void>
  gitBranches?: (path: string) => Promise<{ name: string; current: boolean }[]>
  gitCheckout?: (path: string, name: string, create?: boolean) => Promise<void>
  gitCheckoutCommit?: (path: string, hash: string) => Promise<void>
  gitSuggestCommit?: (path: string, sessionId: string) => Promise<{ message: string }>
  openCommit?: (hash: string, subject: string) => void
  listEntries?: (path: string, signal?: AbortSignal) => Promise<FileListing>
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
  const gitSync = opts?.gitSync ?? vi.fn(async () => {})
  const gitBranches = opts?.gitBranches ?? vi.fn(async () => [])
  const gitCheckout = opts?.gitCheckout ?? vi.fn(async () => {})
  const gitCheckoutCommit = opts?.gitCheckoutCommit ?? vi.fn(async () => {})
  const gitSuggestCommit = opts?.gitSuggestCommit ?? vi.fn(async () => ({ message: 'feat: generated' }))
  const openFile = vi.fn()
  const openDiff = vi.fn()
  const openCommit = opts?.openCommit ?? vi.fn()
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
      gitSync={gitSync}
      gitBranches={gitBranches}
      gitCheckout={gitCheckout}
      gitCheckoutCommit={gitCheckoutCommit}
      gitSuggestCommit={gitSuggestCommit}
      openFile={openFile}
      openDiff={openDiff}
      openCommit={openCommit}
      files={files}
    />,
  )
  return {
    files, gitStage, gitUnstage, gitDiscard, gitCommit, gitSync, gitCheckout,
    gitCheckoutCommit, gitSuggestCommit, openFile, openDiff, openCommit,
  }
}

function gitPathButton(key: string) {
  return within(screen.getByTestId(`xmart-git-row-${key}`)).getByRole('button', { name: /\./ })
}

function gitRowAction(key: string, label: string) {
  return within(screen.getByTestId(`xmart-git-row-${key}`)).getByLabelText(label)
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
    expect(await screen.findByText('Git 状态读取失败。')).toBeTruthy()
  })

  it('renders changes, commits, and opens a worktree diff', async () => {
    const { gitCommit, openDiff, openFile, files } = mount({
      gitStatus: async () => ({
        ...status,
        changes: [
          { path: 'src/foo/a.ts', status: 'modified', area: 'worktree' },
          { path: 'b.ts', status: 'modified', area: 'index' },
        ],
      }),
    })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('main')).toBeTruthy()
    expect(screen.getByTestId('xmart-workbench-git-sync').textContent).toMatch(/↑1/)
    expect(screen.getByTestId('xmart-git-history')).toBeTruthy()
    expect(screen.getByText('图表')).toBeTruthy()
    expect(screen.getByText('init')).toBeTruthy()
    expect(screen.getByText('Ann')).toBeTruthy()
    expect(within(screen.getByTestId('xmart-git-graph-abcdef1')).queryByText(/abcdef1/)).toBeNull()
    expect(screen.getByText('a.ts')).toBeTruthy()
    expect(screen.getByText('src/foo')).toBeTruthy()
    fireEvent.click(gitPathButton('worktree:src/foo/a.ts'))
    expect(openDiff).toHaveBeenCalledWith('worktree', 'src/foo/a.ts')
    expect(openFile).not.toHaveBeenCalled()
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
    fireEvent.click(screen.getByLabelText('刷新'))
    expect(files.getSnapshot().refreshNonce).toBeGreaterThan(0)
  })

  it('paints merge edges on the graph', async () => {
    mount({
      gitLog: async () => [
        { hash: 'm1merge', subject: 'merge', author: 'Ann', timestamp: 2, parents: ['aaaaaaa', 'bbbbbbb'] },
        { hash: 'aaaaaaa', subject: 'a', author: 'Ann', timestamp: 1, parents: [] },
      ],
    })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('xmart-git-graph-m1merge').querySelector('path')).toBeTruthy()
  })

  it('fills the commit box from a generated message', async () => {
    const { gitSuggestCommit } = mount({
      gitStatus: async () => ({
        ...status,
        changes: [{ path: 'a.ts', status: 'modified', area: 'index' }],
      }),
    })
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByTestId('xmart-git-suggest'))
    await act(async () => { await Promise.resolve() })
    expect(gitSuggestCommit).toHaveBeenCalledWith('/ws', 's1')
    expect((screen.getByLabelText('提交说明（Ctrl+Enter）') as HTMLTextAreaElement).value).toBe('feat: generated')
  })

  it('opens a commit diff from the graph and still checks out from pills', async () => {
    const { gitCheckout, gitCheckoutCommit, openCommit } = mount({
      gitLog: async () => [
        {
          hash: 'abcdef1',
          subject: 'init',
          author: 'Ann',
          timestamp: 1,
          refs: [
            { kind: 'head', name: 'HEAD' },
            { kind: 'branch', name: 'main' },
            { kind: 'remote', name: 'origin/main' },
            { kind: 'tag', name: 'v1' },
          ],
        },
      ],
    })
    await act(async () => { await Promise.resolve() })
    const graphRow = () => screen.getByTestId('xmart-git-graph-abcdef1')
    expect(graphRow().querySelectorAll('circle').length).toBeGreaterThan(1)
    fireEvent.click(screen.getByLabelText('查看此提交'))
    expect(openCommit).toHaveBeenCalledWith('abcdef1', 'init')
    expect(gitCheckoutCommit).not.toHaveBeenCalled()
    expect(graphRow().getAttribute('data-active')).toBe('true')
    fireEvent.click(within(graphRow()).getByText('main'))
    await act(async () => { await Promise.resolve() })
    expect(gitCheckout).toHaveBeenCalledWith('/ws', 'main')
    fireEvent.click(within(graphRow()).getByText('origin/main'))
    await act(async () => { await Promise.resolve() })
    fireEvent.click(within(graphRow()).getByText('v1'))
    await act(async () => { await Promise.resolve() })
    expect(gitCheckoutCommit).toHaveBeenCalledTimes(2)
    expect(within(graphRow()).getByText('HEAD')).toHaveProperty('disabled', true)
    fireEvent.click(within(graphRow()).getByText('HEAD'))
    expect(gitCheckout).toHaveBeenCalledTimes(1)
  })

  it('hides the author when the log row has none', async () => {
    mount({
      gitLog: async () => [{ hash: 'deadbee', subject: 'solo', author: '', timestamp: 1 }],
    })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('solo')).toBeTruthy()
    expect(screen.queryByText('Ann')).toBeNull()
  })

  it('keeps the commit box when generate fails', async () => {
    const { gitSuggestCommit } = mount({
      gitStatus: async () => ({
        ...status,
        changes: [{ path: 'a.ts', status: 'modified', area: 'index' }],
      }),
      gitSuggestCommit: vi.fn(async () => { throw new Error('no model') }),
    })
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByTestId('xmart-git-suggest'))
    await act(async () => { await Promise.resolve() })
    expect(gitSuggestCommit).toHaveBeenCalled()
    expect(screen.getByText('no model')).toBeTruthy()
  })

  it('does not commit when nothing is staged', async () => {
    const { gitCommit } = mount()
    await act(async () => { await Promise.resolve() })
    fireEvent.change(screen.getByLabelText('提交说明（Ctrl+Enter）'), { target: { value: 'fix' } })
    expect(screen.getByRole('button', { name: '提交' })).toHaveProperty('disabled', true)
    fireEvent.submit(screen.getByLabelText('提交说明（Ctrl+Enter）').closest('form') as HTMLFormElement)
    expect(gitCommit).not.toHaveBeenCalled()
    const suggest = screen.getByTestId('xmart-git-suggest')
    expect(suggest).toHaveProperty('disabled', true)
    fireEvent.click(suggest)
    expect(screen.queryByTestId('xmart-workbench-git-action-error')).toBeNull()
  })

  it('disables generate while a suggestion is in flight', async () => {
    let finish: (value: { message: string }) => void = () => {}
    const hung = new Promise<{ message: string }>((resolve) => { finish = resolve })
    const { gitSuggestCommit } = mount({
      gitStatus: async () => ({
        ...status,
        changes: [{ path: 'a.ts', status: 'modified', area: 'index' }],
      }),
      gitSuggestCommit: vi.fn(() => hung),
    })
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByTestId('xmart-git-suggest'))
    await act(async () => { await Promise.resolve() })
    expect(screen.getByLabelText('正在生成…')).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByTestId('xmart-git-suggest'))
    expect(gitSuggestCommit).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ message: 'feat: later' }) })
    expect((screen.getByLabelText('提交说明（Ctrl+Enter）') as HTMLTextAreaElement).value).toBe('feat: later')
  })

  it('keeps the branch label when listing branches fails', async () => {
    mount({ gitBranches: async () => { throw new Error('no refs') } })
    expect(await screen.findByText('main')).toBeTruthy()
  })

  it('treats a non-array log as empty history', async () => {
    mount({ gitLog: async () => undefined as never })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('main')).toBeTruthy()
    expect(screen.getByTestId('xmart-workbench-git-sync').textContent).toMatch(/↑1/)
    expect(screen.queryByText(/abcdef1/)).toBeNull()
  })

  it('keeps status when gitLog throws', async () => {
    mount({
      gitLog: () => {
        throw new Error('no method')
      },
    })
    expect(await screen.findByText('main')).toBeTruthy()
    expect(screen.getByTestId('xmart-workbench-git-sync').textContent).toMatch(/↑1/)
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
    expect(await screen.findByText('backend')).toBeTruthy()
    const picker = screen.getByTestId('xmart-workbench-git-repo') as HTMLSelectElement
    expect(picker.options).toHaveLength(2)
    fireEvent.change(picker, { target: { value: '/ws/xmart-web' } })
    expect(await screen.findByText('web')).toBeTruthy()
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
    expect(await screen.findByTestId('xmart-workbench-git-repo')).toBeTruthy()
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

  it('shows only the staged section when the worktree is clean', async () => {
    mount({
      gitStatus: async () => ({
        ...status,
        changes: [{ path: 'ok.ts', status: 'added', area: 'index' }],
      }),
      gitLog: async () => [],
    })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('xmart-git-staged')).toBeTruthy()
    expect(screen.queryByTestId('xmart-git-changes')).toBeNull()
    expect(screen.queryByTestId('xmart-git-history')).toBeNull()
  })

  it('splits staged and unstaged, stages from the row, and opens the matching diff', async () => {
    const { gitStage, gitUnstage, gitDiscard, openDiff, openFile } = mount({
      gitStatus: async () => ({
        ...status,
        changes: [
          { path: 'staged.ts', status: 'modified', area: 'index' },
          { path: 'both.ts', status: 'modified', area: 'index' },
          { path: 'both.ts', status: 'modified', area: 'worktree' },
          { path: 'dirty.ts', status: 'modified', area: 'worktree' },
        ],
      }),
    })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('xmart-git-staged')).toBeTruthy()
    expect(screen.getByTestId('xmart-git-changes')).toBeTruthy()
    fireEvent.click(gitPathButton('index:staged.ts'))
    expect(openDiff).toHaveBeenCalledWith('staged', 'staged.ts')
    fireEvent.click(gitRowAction('worktree:dirty.ts', '暂存'))
    await act(async () => { await Promise.resolve() })
    expect(gitStage).toHaveBeenCalledWith('/ws', ['dirty.ts'])
    fireEvent.click(gitRowAction('index:staged.ts', '取消暂存'))
    await act(async () => { await Promise.resolve() })
    expect(gitUnstage).toHaveBeenCalledWith('/ws', ['staged.ts'])
    fireEvent.click(gitRowAction('worktree:dirty.ts', '还原'))
    await act(async () => { await Promise.resolve() })
    expect(gitDiscard).toHaveBeenCalledWith('/ws', ['dirty.ts'])
    fireEvent.contextMenu(gitPathButton('index:staged.ts'))
    fireEvent.click(screen.getByText('查看暂存差异'))
    expect(openDiff).toHaveBeenCalledWith('staged', 'staged.ts')
    fireEvent.contextMenu(gitPathButton('index:staged.ts'))
    fireEvent.click(screen.getByText('打开文件'))
    expect(openFile).toHaveBeenCalledWith('/ws/staged.ts')
    fireEvent.click(screen.getByText('全部暂存'))
    await act(async () => { await Promise.resolve() })
    expect(gitStage).toHaveBeenCalledWith('/ws', ['both.ts', 'dirty.ts'])
    fireEvent.click(screen.getByText('全部取消暂存'))
    await act(async () => { await Promise.resolve() })
    expect(gitUnstage).toHaveBeenCalledWith('/ws', ['staged.ts', 'both.ts'])
    fireEvent.click(screen.getByText('全部还原'))
    await act(async () => { await Promise.resolve() })
    expect(gitDiscard).toHaveBeenCalledWith('/ws', ['both.ts', 'dirty.ts'])
  })

  it('runs context-menu verbs and still refreshes after a failed commit', async () => {
    const { gitStage, openDiff, files } = mount({
      gitStatus: async () => ({
        ...status,
        changes: [
          { path: 'a.ts', status: 'modified', area: 'worktree' },
          { path: 'b.ts', status: 'modified', area: 'index' },
        ],
      }),
      gitCommit: async () => { throw new Error('no') },
    })
    await act(async () => { await Promise.resolve() })
    fireEvent.contextMenu(gitPathButton('worktree:a.ts'))
    fireEvent.click(screen.getByText('暂存'))
    await act(async () => { await Promise.resolve() })
    expect(gitStage).toHaveBeenCalledWith('/ws', ['a.ts'])
    fireEvent.contextMenu(gitPathButton('worktree:a.ts'))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.contextMenu(gitPathButton('worktree:a.ts'))
    fireEvent.click(screen.getByText('查看工作区差异'))
    expect(openDiff).toHaveBeenCalledWith('worktree', 'a.ts')
    fireEvent.change(screen.getByLabelText('提交说明（Ctrl+Enter）'), { target: { value: 'x' } })
    fireEvent.submit(screen.getByLabelText('提交说明（Ctrl+Enter）').closest('form') as HTMLFormElement)
    await act(async () => { await Promise.resolve() })
    expect(files.getSnapshot().refreshNonce).toBeGreaterThan(0)
  })

  it('syncs remotes, switches branches, and rejects a bad new name', async () => {
    const gitStatus = vi.fn(async () => ({ ...status, ahead: 1, behind: 1 }))
    const { gitSync, gitCheckout } = mount({
      gitStatus,
      gitBranches: async () => [
        { name: 'main', current: true },
        { name: 'feat', current: false },
      ],
    })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    fireEvent.click(screen.getByTestId('xmart-workbench-git-sync'))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(gitSync).toHaveBeenCalledWith('/ws', 'fetch')
    expect(gitSync).toHaveBeenCalledWith('/ws', 'pull')
    expect(gitSync).toHaveBeenCalledWith('/ws', 'push')
    fireEvent.change(screen.getByTestId('xmart-workbench-git-branch'), { target: { value: 'main' } })
    expect(gitCheckout).not.toHaveBeenCalled()
    fireEvent.change(screen.getByTestId('xmart-workbench-git-branch'), { target: { value: 'feat' } })
    await act(async () => { await Promise.resolve() })
    expect(gitCheckout).toHaveBeenCalledWith('/ws', 'feat')
    fireEvent.change(screen.getByLabelText('新分支名'), { target: { value: 'bad..name' } })
    fireEvent.submit(screen.getByLabelText('新分支名').closest('form') as HTMLFormElement)
    expect(screen.getByTestId('xmart-workbench-git-action-error').textContent).toMatch(/不合法/)
    fireEvent.change(screen.getByLabelText('新分支名'), { target: { value: 'ok-branch' } })
    fireEvent.submit(screen.getByLabelText('新分支名').closest('form') as HTMLFormElement)
    await act(async () => { await Promise.resolve() })
    expect(gitCheckout).toHaveBeenCalledWith('/ws', 'ok-branch', true)
  })

  it('disables the branch picker while detached and shows syncing copy', async () => {
    let release: () => void = () => {}
    mount({
      gitStatus: async () => ({
        ...status, branch: 'HEAD', detached: true, ahead: 0, behind: 0, changes: [],
      }),
      gitLog: async () => [],
      gitBranches: async () => [{ name: 'main', current: false }],
      gitSync: () => new Promise((resolve) => { release = () => { resolve() } }),
    })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByTestId('xmart-workbench-git-branch')).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByTestId('xmart-workbench-git-sync'))
    expect(screen.getByText(/同步中/)).toBeTruthy()
    await act(async () => { release(); await Promise.resolve() })
  })

  it('surfaces a failed sync and still refreshes', async () => {
    const gitSync = vi.fn(async () => { throw new Error('rejected') })
    const { files } = mount({ gitSync })
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByTestId('xmart-workbench-git-sync'))
    await act(async () => { await Promise.resolve() })
    expect(gitSync).toHaveBeenCalled()
    expect(screen.getByText('rejected')).toBeTruthy()
    expect(files.getSnapshot().refreshNonce).toBeGreaterThan(0)
  })

  it('ignores a late branch list after unmount', async () => {
    let settle: (value: { name: string; current: boolean }[]) => void = () => {}
    const view = render(
      <GitTab
        tab={{ id: 'g', type: 'git', title: 'Git' }}
        visible
        sessionId="s1"
        t={t}
        getCwd={() => '/ws'}
        watchSessions={() => () => {}}
        listEntries={async () => emptyListing}
        gitStatus={async () => status}
        gitStage={async () => {}}
        gitUnstage={async () => {}}
        gitDiscard={async () => {}}
        gitCommit={async () => ({})}
        gitLog={async () => []}
        gitSync={async () => {}}
        gitBranches={() => new Promise((resolve) => { settle = resolve })}
        gitCheckout={async () => {}}
        gitCheckoutCommit={async () => {}}
        gitSuggestCommit={async () => ({ message: 'x' })}
        openFile={() => {}}
        openDiff={() => {}}
        openCommit={() => {}}
        files={createWorkbenchFilesStore()}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    view.unmount()
    await act(async () => { settle([{ name: 'main', current: true }]); await Promise.resolve() })
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
        listEntries={async () => emptyListing}
        gitStatus={() => new Promise<GitStatus>((resolve) => { settle = resolve })}
        gitStage={async () => {}}
        gitUnstage={async () => {}}
        gitDiscard={async () => {}}
        gitCommit={async () => ({})}
        gitLog={async () => []}
        gitSync={async () => {}}
        gitBranches={async () => []}
        gitCheckout={async () => {}}
        gitCheckoutCommit={async () => {}}
        gitSuggestCommit={async () => ({ message: 'x' })}
        openFile={() => {}}
        openDiff={() => {}}
        openCommit={() => {}}
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
        gitSync={async () => {}}
        gitBranches={async () => []}
        gitCheckout={async () => {}}
        gitCheckoutCommit={async () => {}}
        gitSuggestCommit={async () => ({ message: 'x' })}
        openFile={() => {}}
        openDiff={() => {}}
        openCommit={() => {}}
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
    const change = { path: 'a.ts', status: 'modified' as const, area: 'worktree' as const }
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
