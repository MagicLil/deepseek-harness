// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { FileSearchResult } from '@deepseek-ai/dsh-client-runtime/client'
import { WORKBENCH_SEARCH_EVENT } from '../src/client/app-menu-dispatch.ts'
import { SearchTab, SEARCH_DEBOUNCE_MS } from '../src/client/SearchTab.tsx'
import { createWorkbenchFilesStore } from '../src/client/files-store.ts'
import { createWorkbenchSearchStore } from '../src/client/search-store.ts'
import { zh } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const t = makeTranslate(zh, commonZh)

const page = (overrides: Partial<FileSearchResult> = {}): FileSearchResult => ({
  root: '/ws',
  hits: [{ path: '/ws/src/a.ts', line: 3, text: 'const js = 1', spans: [{ start: 6, end: 8 }] }],
  fileCount: 1,
  truncated: false,
  ...overrides,
})

function mount(opts?: {
  roots?: { path: string; title: string }[]
  getRoots?: () => { path: string; title: string }[]
  visible?: boolean
  sessionId?: string
  search?: (path: string, query: string, options: object, signal?: AbortSignal) => Promise<FileSearchResult>
  openHit?: (sessionId: string, path: string, reveal: {
    line: number
    character: number
    end?: number
  }) => void
  watchSessions?: (fn: () => void) => () => void
  store?: ReturnType<typeof createWorkbenchSearchStore>
  files?: ReturnType<typeof createWorkbenchFilesStore>
}) {
  const store = opts?.store ?? createWorkbenchSearchStore()
  const search = opts?.search ?? vi.fn(async () => page())
  const openHit = opts?.openHit ?? vi.fn()
  const getRoots = opts?.getRoots ?? (() => opts?.roots ?? [{ path: '/ws', title: 'ws' }])
  render(
    <SearchTab
      tab={{ id: 'search', type: 'search', title: '搜索' }}
      visible={opts?.visible ?? true}
      sessionId={opts?.sessionId ?? 's1'}
      t={t}
      getRoots={getRoots}
      watchSessions={opts?.watchSessions ?? (() => () => {})}
      search={search}
      openHit={openHit}
      store={store}
      files={opts?.files}
    />,
  )
  return { search, openHit, store }
}

describe('SearchTab', () => {
  it('asks for a workspace when none is registered', () => {
    mount({ roots: [] })
    expect(screen.getByTestId('xmart-workbench-search').textContent).toContain('还没有可搜索的工作区目录')
  })

  it('debounces typing into workspaces.search and opens a hit at the match', async () => {
    vi.useFakeTimers()
    const { search, openHit } = mount()
    const input = screen.getByTestId('xmart-search-input')
    await act(async () => { fireEvent.change(input, { target: { value: 'js' } }) })
    expect(search).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS) })
    expect(search).toHaveBeenCalledWith('/ws', 'js', {
      regex: false, caseSensitive: false, wholeWord: false,
    }, expect.any(AbortSignal))
    expect(screen.getByTestId('xmart-search-summary').textContent).toBe('1 个结果，1 个文件')
    expect(screen.getByTestId('xmart-search-file').textContent).toContain('a.ts')
    expect(screen.getByTestId('xmart-search-file').textContent).toContain('src')
    expect(screen.getByRole('mark').textContent).toBe('js')
    await act(async () => { screen.getByTestId('xmart-search-hit').click() })
    expect(openHit).toHaveBeenCalledWith('s1', '/ws/src/a.ts', { line: 2, character: 6, end: 8 })
  })

  it('flushes on Enter, toggles flags and globs, and collapses a file group', async () => {
    vi.useFakeTimers()
    const search = vi.fn(async () => page({ truncated: true }))
    mount({ search })
    const input = screen.getByTestId('xmart-search-input')
    await act(async () => { fireEvent.change(input, { target: { value: 'js' } }) })
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(search).toHaveBeenCalledOnce()
    await act(async () => { screen.getByTestId('xmart-search-case').click() })
    await act(async () => { screen.getByTestId('xmart-search-word').click() })
    await act(async () => { screen.getByTestId('xmart-search-regex').click() })
    await act(async () => { screen.getByTestId('xmart-search-filters').click() })
    await act(async () => { fireEvent.change(screen.getByTestId('xmart-search-include'), { target: { value: '*.ts' } }) })
    await act(async () => { fireEvent.change(screen.getByTestId('xmart-search-exclude'), { target: { value: '*.md' } }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS) })
    expect(search).toHaveBeenLastCalledWith('/ws', 'js', {
      regex: true, caseSensitive: true, wholeWord: true, include: '*.ts', exclude: '*.md',
    }, expect.any(AbortSignal))
    expect(screen.getByTestId('xmart-search-truncated').textContent).toContain('只显示前 1 条')
    await act(async () => { screen.getByTestId('xmart-search-file').click() })
    expect(screen.queryByTestId('xmart-search-hit')).toBeNull()
  })

  it('shows empty, searching, failed, and invalid-pattern states', async () => {
    vi.useFakeTimers()
    let finishEmpty!: (value: FileSearchResult) => void
    const empty = vi.fn(() => new Promise<FileSearchResult>((resolve) => { finishEmpty = resolve }))
    const { store } = mount({ search: empty })
    await act(async () => { fireEvent.change(screen.getByTestId('xmart-search-input'), { target: { value: 'none' } }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS) })
    expect(screen.getByText('正在搜索…')).toBeTruthy()
    await act(async () => { finishEmpty(page({ hits: [], fileCount: 0 })) })
    expect(screen.getByTestId('xmart-search-empty').textContent).toBe('没有找到结果。')

    cleanup()
    const unavailable = vi.fn(async () => {
      throw { rpcError: { code: 'search-unavailable' } }
    })
    mount({ search: unavailable })
    await act(async () => { fireEvent.change(screen.getByTestId('xmart-search-input'), { target: { value: 'x' } }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS) })
    expect(screen.getByTestId('xmart-search-error').textContent).toBe('搜索引擎不可用。')

    cleanup()
    const failed = vi.fn(async () => {
      throw { rpcError: { code: 'search-failed' } }
    })
    mount({ search: failed })
    await act(async () => { fireEvent.change(screen.getByTestId('xmart-search-input'), { target: { value: 'y' } }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS) })
    expect(screen.getByTestId('xmart-search-error').textContent).toBe('搜索失败。')

    cleanup()
    const invalid = vi.fn(async () => {
      throw { rpcError: { code: 'search-invalid' } }
    })
    mount({ search: invalid, store })
    await act(async () => { fireEvent.change(screen.getByTestId('xmart-search-input'), { target: { value: '[' } }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS) })
    expect(screen.getByTestId('xmart-search-error').textContent).toBe('正则表达式不合法。')

    cleanup()
    const badGlob = vi.fn(async () => {
      throw { rpcError: { code: 'search-invalid', message: 'error parsing glob' } }
    })
    mount({ search: badGlob })
    await act(async () => { fireEvent.change(screen.getByTestId('xmart-search-input'), { target: { value: 'z' } }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS) })
    expect(screen.getByTestId('xmart-search-error').textContent).toBe('文件筛选不合法。')
  })

  it('ignores a superseded search and refocuses the input on the menu event', async () => {
    vi.useFakeTimers()
    let release!: (value: FileSearchResult) => void
    const first = new Promise<FileSearchResult>((resolve) => { release = resolve })
    const search = vi.fn((_path: string, query: string) => {
      if (query === 'a') return first
      return Promise.resolve(page({ hits: [], fileCount: 0 }))
    })
    const { store } = mount({ search, visible: false })
    await act(async () => { fireEvent.change(screen.getByTestId('xmart-search-input'), { target: { value: 'a' } }) })
    await act(async () => { fireEvent.keyDown(screen.getByTestId('xmart-search-input'), { key: 'x' }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS) })
    await act(async () => { fireEvent.change(screen.getByTestId('xmart-search-input'), { target: { value: 'ab' } }) })
    await act(async () => { release(page()) })
    expect(store.stateOf('s1').hits).toEqual([])
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS) })
    expect(store.stateOf('s1').status).toBe('done')
    const input = screen.getByTestId('xmart-search-input') as HTMLInputElement
    await act(async () => { window.dispatchEvent(new Event(WORKBENCH_SEARCH_EVENT)) })
    expect(document.activeElement).toBe(input)
  })

  it('ignores a superseded rejection', async () => {
    vi.useFakeTimers()
    let fail!: (error: unknown) => void
    const first = new Promise<FileSearchResult>((_, reject) => { fail = reject })
    const search = vi.fn((_path: string, query: string) => {
      if (query === 'a') return first
      return Promise.resolve(page({ hits: [], fileCount: 0 }))
    })
    const { store } = mount({ search })
    await act(async () => { fireEvent.change(screen.getByTestId('xmart-search-input'), { target: { value: 'a' } }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS) })
    await act(async () => { fireEvent.change(screen.getByTestId('xmart-search-input'), { target: { value: 'ab' } }) })
    await act(async () => { fail({ rpcError: { code: 'search-failed' } }) })
    expect(store.stateOf('s1').status).not.toBe('error')
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS) })
    expect(store.stateOf('s1').status).toBe('done')
  })

  it('clears results when the query is emptied and follows session root changes', async () => {
    vi.useFakeTimers()
    let roots: { path: string; title: string }[] = [{ path: '/ws', title: 'ws' }]
    let notify = (): void => {}
    const search = vi.fn(async () => page())
    mount({
      search,
      getRoots: () => roots,
      watchSessions: (fn) => {
        notify = fn
        return () => {}
      },
    })
    await act(async () => { fireEvent.change(screen.getByTestId('xmart-search-input'), { target: { value: 'js' } }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS) })
    expect(search).toHaveBeenCalledOnce()
    await act(async () => { fireEvent.change(screen.getByTestId('xmart-search-input'), { target: { value: '' } }) })
    expect(screen.queryByTestId('xmart-search-summary')).toBeNull()
    roots = []
    await act(async () => { notify() })
    expect(screen.getByTestId('xmart-workbench-search').textContent).toContain('还没有可搜索的工作区目录')
  })

  it('keeps stale hits while a later search is in flight', async () => {
    vi.useFakeTimers()
    let finishNext!: (value: FileSearchResult) => void
    const search = vi.fn((_path: string, query: string) => {
      if (query === 'js') return Promise.resolve(page())
      return new Promise<FileSearchResult>((resolve) => { finishNext = resolve })
    })
    mount({ search })
    await act(async () => { fireEvent.change(screen.getByTestId('xmart-search-input'), { target: { value: 'js' } }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS) })
    expect(screen.getByTestId('xmart-search-summary')).toBeTruthy()
    await act(async () => { fireEvent.change(screen.getByTestId('xmart-search-input'), { target: { value: 'jsx' } }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS) })
    expect(screen.getByTestId('xmart-search-summary')).toBeTruthy()
    expect(screen.getByTestId('xmart-search-searching').textContent).toBe('正在搜索…')
    await act(async () => { finishNext(page({ hits: [], fileCount: 0 })) })
    expect(screen.getByTestId('xmart-search-empty')).toBeTruthy()
  })

  it('opens the selected hit with the keyboard and re-searches after a disk refresh', async () => {
    vi.useFakeTimers()
    const files = createWorkbenchFilesStore()
    const search = vi.fn(async () => page({
      hits: [
        { path: '/ws/src/a.ts', line: 3, text: 'const js = 1', spans: [{ start: 6, end: 8 }] },
        { path: '/ws/src/b.ts', line: 1, text: 'js()', spans: [{ start: 0, end: 2 }] },
      ],
      fileCount: 2,
    }))
    const { openHit, store } = mount({ search, files })
    const input = screen.getByTestId('xmart-search-input')
    await act(async () => { fireEvent.keyDown(input, { key: 'ArrowDown' }) })
    await act(async () => { fireEvent.change(input, { target: { value: 'js' } }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS) })
    expect(search).toHaveBeenCalledOnce()
    await act(async () => { fireEvent.keyDown(input, { key: 'ArrowDown' }) })
    await act(async () => { fireEvent.keyDown(input, { key: 'ArrowUp' }) })
    await act(async () => { fireEvent.keyDown(input, { key: 'ArrowDown' }) })
    await act(async () => { fireEvent.keyDown(input, { key: 'ArrowDown' }) })
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    expect(openHit).toHaveBeenCalledWith('s1', '/ws/src/b.ts', { line: 0, character: 0, end: 2 })
    await act(async () => { store.update('s1', { selectedKey: '/missing\n9' }) })
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    expect(openHit).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(search).toHaveBeenCalledTimes(2)
    await act(async () => { files.bumpRefresh() })
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS) })
    expect(search).toHaveBeenCalledTimes(3)
  })
})
