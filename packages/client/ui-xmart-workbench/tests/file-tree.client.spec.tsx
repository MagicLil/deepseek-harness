// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { FileEntry, FileListing } from '@deepseek-ai/dsh-client-runtime/client'
import { FileTree, isUnder } from '../src/client/FileTree.tsx'

afterEach(cleanup)

const labels = {
  loading: '加载中…', empty: '空目录', error: '目录读取失败', retry: '重试', truncated: '截断',
}

function entry(partial: Partial<FileEntry> & Pick<FileEntry, 'name' | 'path' | 'kind'>): FileEntry {
  return { hidden: false, ...partial }
}

describe('isUnder', () => {
  it('accepts the root and both separators', () => {
    expect(isUnder('/ws', '/ws')).toBe(true)
    expect(isUnder('/ws/a', '/ws')).toBe(true)
    expect(isUnder('C:\\ws\\a', 'C:\\ws')).toBe(true)
    expect(isUnder('/other', '/ws')).toBe(false)
  })
})

describe('FileTree', () => {
  it('loads, opens files, expands dirs, and shows git/dirty/hidden', async () => {
    const listing: FileListing = {
      path: '/ws',
      truncated: true,
      entries: [
        entry({ name: 'src', path: '/ws/src', kind: 'directory', hidden: true }),
        entry({ name: 'a.ts', path: '/ws/a.ts', kind: 'file' }),
      ],
    }
    const child: FileListing = { path: '/ws/src', truncated: false, entries: [] }
    const listEntries = vi.fn(async (path: string) => path === '/ws/src' ? child : listing)
    const onToggleDir = vi.fn()
    const onOpenFile = vi.fn()
    const onContextMenu = vi.fn()
    render(
      <FileTree
        root="/ws"
        expanded={{}}
        openFile="/ws/a.ts"
        dirtyPaths={{ '/ws/a.ts': 'x' }}
        gitByPath={{ '/ws/a.ts': 'modified', '/ws/src': 'added' }}
        refreshNonce={0}
        listEntries={listEntries}
        onToggleDir={onToggleDir}
        onOpenFile={onOpenFile}
        onContextMenu={onContextMenu}
        labels={labels}
      />,
    )
    expect(screen.getByText('加载中…')).toBeTruthy()
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('a.ts')).toBeTruthy()
    expect(screen.getByText('a.ts').closest('button')?.querySelector('[data-file-icon="typescript"]')).toBeTruthy()
    expect(screen.getByText('a.ts').closest('button')?.getAttribute('data-path')).toBe('/ws/a.ts')
    expect(screen.getByText('a.ts').closest('button')?.getAttribute('data-active')).toBe('true')
    expect(screen.getByText('截断')).toBeTruthy()
    fireEvent.click(screen.getByText('a.ts'))
    expect(onOpenFile).toHaveBeenCalled()
    fireEvent.contextMenu(screen.getByText('a.ts'))
    expect(onContextMenu).toHaveBeenCalled()
    fireEvent.click(screen.getByText('src'))
    expect(onToggleDir).toHaveBeenCalledWith('/ws/src', true)
    fireEvent.contextMenu(screen.getByText('src'))
    expect(onContextMenu).toHaveBeenCalledTimes(2)
  })

  it('shows empty, error+retry, and reloads on refresh', async () => {
    let fail = true
    const listEntries = vi.fn(async () => {
      if (fail) throw new Error('boom')
      return { path: '/ws', entries: [], truncated: false }
    })
    const view = render(
      <FileTree
        root="/ws"
        expanded={{}}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={0}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('目录读取失败')).toBeTruthy()
    fail = false
    fireEvent.click(screen.getByText('重试'))
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('空目录')).toBeTruthy()
    view.rerender(
      <FileTree
        root="/ws"
        expanded={{}}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={1}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(listEntries.mock.calls.length).toBeGreaterThan(2)
    cleanup()
    const stringFail = vi.fn(async () => { throw 'boom' })
    render(
      <FileTree
        root="/ws"
        expanded={{}}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={0}
        listEntries={stringFail}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('目录读取失败')).toBeTruthy()
  })

  it('loads expanded children and aborts in-flight work on unmount', async () => {
    let settle: (value: FileListing) => void = () => {}
    const listEntries = vi.fn(() => new Promise<FileListing>((resolve) => { settle = resolve }))
    const view = render(
      <FileTree
        root="/ws"
        expanded={{ '/ws/src': true }}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={0}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    view.unmount()
    settle({ path: '/ws', entries: [], truncated: false })
    await act(async () => { await Promise.resolve() })
    cleanup()
    let reject: (reason: unknown) => void = () => {}
    const failing = vi.fn(() => new Promise<FileListing>((_, r) => { reject = r }))
    const dying = render(
      <FileTree
        root="/ws"
        expanded={{ '/other': true }}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={0}
        listEntries={failing}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    dying.unmount()
    reject(new Error('late'))
    await act(async () => { await Promise.resolve() })
  })

  it('renders every git letter', async () => {
    const statuses = ['modified', 'added', 'deleted', 'untracked', 'renamed', 'conflict'] as const
    const listEntries = vi.fn(async () => ({
      path: '/ws',
      truncated: false,
      entries: statuses.map(status => entry({ name: status, path: `/ws/${status}`, kind: 'file' as const })),
    }))
    const gitByPath = Object.fromEntries(statuses.map(status => [`/ws/${status}`, status]))
    render(
      <FileTree
        root="/ws"
        expanded={{}}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={gitByPath}
        refreshNonce={0}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('M')).toBeTruthy()
    expect(screen.getByText('C')).toBeTruthy()
  })

  it('renders an expanded child and ignores context menu without a handler', async () => {
    const listEntries = vi.fn(async (path: string) => path === '/ws/src'
      ? { path: '/ws/src', entries: [], truncated: false }
      : {
        path: '/ws',
        truncated: false,
        entries: [entry({ name: 'src', path: '/ws/src', kind: 'directory' })],
      })
    render(
      <FileTree
        root="/ws"
        expanded={{ '/ws/src': true }}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={0}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    await act(async () => { await Promise.resolve() })
    fireEvent.contextMenu(screen.getByText('src'))
    expect(screen.getByText('空目录')).toBeTruthy()
  })

  it('shows files again after an unmount and remount', async () => {
    const listing: FileListing = {
      path: '/ws',
      truncated: false,
      entries: [entry({ name: 'a.ts', path: '/ws/a.ts', kind: 'file' })],
    }
    const listEntries = vi.fn(async () => listing)
    const view = render(
      <FileTree
        root="/ws"
        expanded={{}}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={0}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('a.ts')).toBeTruthy()
    view.unmount()
    render(
      <FileTree
        root="/ws"
        expanded={{}}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={0}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('a.ts')).toBeTruthy()
  })

  it('keeps the previous listing painted until the new root is ready', async () => {
    let settleNew: (value: FileListing) => void = () => {}
    const listEntries = vi.fn((path: string) => {
      if (path === '/other') return new Promise<FileListing>((resolve) => { settleNew = resolve })
      return Promise.resolve({
        path: '/ws',
        truncated: false,
        entries: [entry({ name: 'old.ts', path: '/ws/old.ts', kind: 'file' })],
      })
    })
    const view = render(
      <FileTree
        root="/ws"
        expanded={{}}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={0}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('old.ts')).toBeTruthy()
    view.rerender(
      <FileTree
        root="/other"
        expanded={{}}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={0}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    expect(screen.getByText('old.ts')).toBeTruthy()
    expect(screen.queryByText('加载中…')).toBeNull()
    await act(async () => {
      settleNew({
        path: '/other',
        truncated: false,
        entries: [entry({ name: 'new.ts', path: '/other/new.ts', kind: 'file' })],
      })
      await Promise.resolve()
    })
    expect(screen.getByText('new.ts')).toBeTruthy()
    expect(screen.queryByText('old.ts')).toBeNull()
  })

  it('keeps the previous listing when the root and refresh nonce change together', async () => {
    const pending = new Map<string, (value: FileListing) => void>()
    const listEntries = vi.fn((path: string) => {
      if (path === '/other' || path === '/other/src') {
        return new Promise<FileListing>((resolve) => { pending.set(path, resolve) })
      }
      return Promise.resolve({
        path: '/ws',
        truncated: false,
        entries: [entry({ name: 'old.ts', path: '/ws/old.ts', kind: 'file' })],
      })
    })
    const view = render(
      <FileTree
        root="/ws"
        expanded={{}}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={0}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('old.ts')).toBeTruthy()
    view.rerender(
      <FileTree
        root="/other"
        expanded={{ '/other/src': true }}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={1}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    expect(screen.getByText('old.ts')).toBeTruthy()
    await act(async () => {
      pending.get('/other/src')?.({
        path: '/other/src',
        truncated: false,
        entries: [entry({ name: 'child.ts', path: '/other/src/child.ts', kind: 'file' })],
      })
      await Promise.resolve()
    })
    expect(screen.getByText('old.ts')).toBeTruthy()
    await act(async () => {
      pending.get('/other')?.({
        path: '/other',
        truncated: false,
        entries: [entry({ name: 'src', path: '/other/src', kind: 'directory' })],
      })
      await Promise.resolve()
    })
    expect(screen.getByText('src')).toBeTruthy()
    expect(screen.queryByText('old.ts')).toBeNull()
  })

  it('aborts an in-flight listing when the root changes', async () => {
    let settleOld: (value: FileListing) => void = () => {}
    const listEntries = vi.fn((path: string) => {
      if (path === '/ws') return new Promise<FileListing>((resolve) => { settleOld = resolve })
      return Promise.resolve({
        path: '/other',
        truncated: false,
        entries: [entry({ name: 'new.ts', path: '/other/new.ts', kind: 'file' })],
      })
    })
    const view = render(
      <FileTree
        root="/ws"
        expanded={{}}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={0}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    view.rerender(
      <FileTree
        root="/other"
        expanded={{}}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={0}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    await act(async () => {
      settleOld({
        path: '/ws',
        truncated: false,
        entries: [entry({ name: 'late.ts', path: '/ws/late.ts', kind: 'file' })],
      })
      await Promise.resolve()
    })
    expect(screen.queryByText('late.ts')).toBeNull()
    expect(screen.getByText('new.ts')).toBeTruthy()
  })

  it('keeps an in-flight child listing when the root widens', async () => {
    let settleChild: (value: FileListing) => void = () => {}
    const listEntries = vi.fn((path: string) => {
      if (path === '/ws/src') return new Promise<FileListing>((resolve) => { settleChild = resolve })
      return Promise.resolve({
        path: '/ws',
        truncated: false,
        entries: [entry({ name: 'src', path: '/ws/src', kind: 'directory' })],
      })
    })
    const view = render(
      <FileTree
        root="/ws/src"
        expanded={{}}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={0}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    view.rerender(
      <FileTree
        root="/ws"
        expanded={{ '/ws/src': true }}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={0}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    await act(async () => {
      settleChild({ path: '/ws/src', entries: [], truncated: false })
      await Promise.resolve()
    })
    expect(screen.getByText('src')).toBeTruthy()
    expect(screen.getByText('空目录')).toBeTruthy()
  })

  it('aborts an in-flight listing when refreshNonce changes', async () => {
    let settle: (value: FileListing) => void = () => {}
    const listEntries = vi.fn(() => new Promise<FileListing>((resolve) => { settle = resolve }))
    const view = render(
      <FileTree
        root="/ws"
        expanded={{}}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={0}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    view.rerender(
      <FileTree
        root="/ws"
        expanded={{}}
        openFile={undefined}
        dirtyPaths={{}}
        gitByPath={{}}
        refreshNonce={1}
        listEntries={listEntries}
        onToggleDir={() => {}}
        onOpenFile={() => {}}
        labels={labels}
      />,
    )
    await act(async () => {
      settle({ path: '/ws', entries: [], truncated: false })
      await Promise.resolve()
    })
  })
})
