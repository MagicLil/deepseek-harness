// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { RunningToolCall, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import { FileChangeCard } from '../src/client/FileChangeCard.tsx'
import { zh, type WorkbenchKey } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const t = (key: WorkbenchKey) => zh[key]
const ARGS = '{"file_path":"/ws/notes/demo.ts","old_string":"hello","new_string":"hello fixture"}'
const callDiff = {
  card: 'diff' as const,
  diffs: [{ path: '/ws/notes/demo.ts', oldText: 'hello', newText: 'hello fixture' }],
}

const running = (over?: Partial<RunningToolCall>): RunningToolCall => ({
  callId: 'c1', name: 'edit', argsRaw: ARGS,
  turn: 1, step: 1, time: 1_000, callView: callDiff, subCalls: [], ...over,
})

const settled = (over?: Partial<ToolResultNode>): ToolResultNode => ({
  kind: 'tool-result', seq: 10, time: 2_000, callId: 'c1',
  call: { name: 'edit', argsRaw: ARGS },
  callTime: 1_000,
  content: [{ type: 'text', text: 'ok' }],
  isError: false,
  callView: callDiff,
  resultView: callDiff,
  subCalls: [],
  ...over,
})

function renderCard(
  block: RunningToolCall | ToolResultNode,
  openInWorkbench = vi.fn(),
  extra?: {
    toolName?: string
    readFile?: (path: string) => Promise<string | undefined>
    openReviewDiff?: (path: string) => void
  },
) {
  const view = render(
    <FileChangeCard
      toolName={extra?.toolName ?? 'edit'}
      block={block}
      cwd="/ws"
      openInWorkbench={openInWorkbench}
      {...(extra?.readFile === undefined ? {} : { readFile: extra.readFile })}
      {...(extra?.openReviewDiff === undefined ? {} : { openReviewDiff: extra.openReviewDiff })}
      t={t}
    />,
  )
  return { view, openInWorkbench }
}

function stubClipboard(writeText: () => Promise<void> = async () => {}) {
  vi.stubGlobal('navigator', {
    ...navigator,
    clipboard: { writeText },
  })
  return writeText
}

describe('FileChangeCard', () => {
  it('shows the path, +/- counts, and the diff snippet by default', () => {
    renderCard(settled())
    const card = screen.getByTestId('file-change-card')
    expect(card).toBeTruthy()
    expect(screen.getByTestId('file-change-path').textContent).toBe('notes/demo.ts')
    expect(screen.getByText('+1')).toBeTruthy()
    expect(screen.getByText('-1')).toBeTruthy()
    expect(card.textContent).toContain('hello fixture')
    expect(card.textContent).toContain('hello')
  })

  it('opens the file in the workbench from the path, not from the collapse toggle', () => {
    const { openInWorkbench } = renderCard(settled())
    fireEvent.click(screen.getByTestId('file-change-toggle'))
    expect(openInWorkbench).not.toHaveBeenCalled()
    expect(screen.queryByTestId('file-change-line')).toBeNull()
    fireEvent.click(screen.getByTestId('file-change-path'))
    expect(openInWorkbench).toHaveBeenCalledWith('/ws/notes/demo.ts')
  })

  it('caps a long snippet and expands the rest on demand', () => {
    const newText = Array.from({ length: 12 }, (_, i) => `line-${i}`).join('\n')
    renderCard(settled({
      resultView: { card: 'diff', diffs: [{ path: 'long.ts', oldText: null, newText }] },
    }))
    expect(screen.getByText('line-0')).toBeTruthy()
    expect(screen.queryByText('line-11')).toBeNull()
    fireEvent.click(screen.getByTestId('file-change-more'))
    expect(screen.getByText('line-11')).toBeTruthy()
  })

  it('falls back to a one-line error row when there is no diff', () => {
    const { openInWorkbench } = renderCard(settled({
      isError: true,
      resultView: { card: 'generic' },
      content: [{ type: 'text', text: 'Permission denied' }],
    }))
    expect(screen.getByTestId('file-change-fallback').textContent).toContain('Permission denied')
    fireEvent.click(screen.getByTestId('file-change-path'))
    expect(openInWorkbench).toHaveBeenCalledWith('/ws/notes/demo.ts')
  })

  it('shows a running card as soon as the intended diff arrives', () => {
    renderCard(running())
    expect(screen.getByTestId('file-change-card').getAttribute('data-state')).toBe('running')
    expect(screen.getByTestId('file-change-card').textContent).toContain('hello fixture')
  })

  it('collapses the extra lines back after expanding them', () => {
    const newText = Array.from({ length: 12 }, (_, i) => `line-${i}`).join('\n')
    renderCard(settled({
      resultView: { card: 'diff', diffs: [{ path: 'long.ts', oldText: null, newText }] },
    }))
    fireEvent.click(screen.getByTestId('file-change-more'))
    expect(screen.getByText('line-11')).toBeTruthy()
    fireEvent.click(screen.getByTestId('file-change-more'))
    expect(screen.queryByText('line-11')).toBeNull()
  })

  it('omits +/- chips when the applied hunk has no lines', () => {
    renderCard(settled({
      resultView: { card: 'diff', diffs: [{ path: 'empty.ts', oldText: '', newText: '' }] },
    }))
    expect(screen.queryByText('+0')).toBeNull()
    expect(screen.queryByText('-0')).toBeNull()
    expect(screen.getByTestId('file-change-path').textContent).toBe('empty.ts')
    expect(screen.queryByTestId('file-change-copy')).toBeNull()
  })

  it('renders a non-clickable fallback when the call has no path', () => {
    renderCard(running({ argsRaw: '{', callView: null }), vi.fn(), { toolName: 'write' })
    expect(screen.getByTestId('file-change-fallback').textContent).toContain('write')
    expect(screen.queryByTestId('file-change-path')).toBeNull()
  })

  it('copies a git-style patch and ignores a second click while copied', async () => {
    const writeText = vi.fn(async () => {})
    stubClipboard(writeText)
    renderCard(settled({
      resultView: { card: 'diff', diffs: [{ path: 'n.ts', oldText: null, newText: 'one\ntwo' }] },
    }))
    fireEvent.click(screen.getByTestId('file-change-copy'))
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('+++ b/n.ts'))
    })
    expect(writeText.mock.calls[0]?.[0]).toContain('+one')
    await waitFor(() => {
      expect(screen.getByTestId('file-change-copy').getAttribute('title')).toBe('已复制')
    })
    fireEvent.click(screen.getByTestId('file-change-copy'))
    expect(writeText).toHaveBeenCalledTimes(1)
  })

  it('leaves the copy label alone when the clipboard refuses the write', async () => {
    stubClipboard(async () => { throw new Error('denied') })
    renderCard(settled())
    fireEvent.click(screen.getByTestId('file-change-copy'))
    await waitFor(() => {
      expect(screen.getByTestId('file-change-copy').getAttribute('title')).toBe('复制差异')
    })
  })

  it('opens the full review diff from the header action', () => {
    const openReviewDiff = vi.fn()
    renderCard(settled(), vi.fn(), { openReviewDiff })
    fireEvent.click(screen.getByTestId('file-change-review'))
    expect(openReviewDiff).toHaveBeenCalledWith('/ws/notes/demo.ts')
  })

  it('jumps to a numbered line after reading the file, and lands the path click on the first change', async () => {
    const openInWorkbench = vi.fn()
    renderCard(settled(), openInWorkbench, {
      readFile: async () => 'hello fixture\n',
    })
    await waitFor(() => {
      expect(screen.getAllByTestId('file-change-line').some(node => node.getAttribute('data-line') === '1')).toBe(true)
    })
    fireEvent.click(screen.getByTestId('file-change-path'))
    expect(openInWorkbench).toHaveBeenCalledWith('/ws/notes/demo.ts', { line: 0, character: 0 })
    const numbered = screen.getAllByTestId('file-change-line').find(node => node.getAttribute('data-kind') === 'add')
    expect(numbered).toBeTruthy()
    fireEvent.click(numbered as HTMLElement)
    expect(openInWorkbench).toHaveBeenLastCalledWith('/ws/notes/demo.ts', { line: 0, character: 0 })
  })

  it('numbers a create from line 1 without reading the file', () => {
    const { openInWorkbench } = renderCard(settled({
      resultView: { card: 'diff', diffs: [{ path: '/ws/n.ts', oldText: null, newText: 'one' }] },
    }))
    expect(screen.getByTestId('file-change-line').getAttribute('data-line')).toBe('1')
    fireEvent.click(screen.getByTestId('file-change-path'))
    expect(openInWorkbench).toHaveBeenCalledWith('/ws/n.ts', { line: 0, character: 0 })
  })

  it('ignores a late read after unmount and a rejected read', async () => {
    let finish: ((text: string) => void) | undefined
    let fail: ((error: Error) => void) | undefined
    const readFile = vi.fn(() => new Promise<string>((resolve) => { finish = resolve }))
    const { view } = renderCard(settled(), vi.fn(), { readFile })
    view.unmount()
    finish?.('hello fixture\n')
    const pendingReject = vi.fn(() => new Promise<string>((_, reject) => { fail = reject }))
    const late = renderCard(settled(), vi.fn(), { readFile: pendingReject })
    late.view.unmount()
    fail?.(new Error('missing'))
    const rejected = vi.fn(async () => {
      throw new Error('missing')
    })
    renderCard(settled(), vi.fn(), { readFile: rejected })
    await waitFor(() => {
      expect(rejected).toHaveBeenCalled()
    })
    expect(screen.getAllByTestId('file-change-line').every(node => node.getAttribute('data-line') === null)).toBe(true)
  })

  it('renders context, a hunk gap, and deleted-word marks', () => {
    renderCard(settled({
      resultView: {
        card: 'diff',
        diffs: [
          { path: '/ws/a.ts', oldText: 'a\nhello world\nc', newText: 'a\nhello\nc' },
          { path: '/ws/a.ts', oldText: 'z', newText: 'Z' },
        ],
      },
    }))
    const kinds = screen.getAllByTestId('file-change-line').map(node => node.getAttribute('data-kind'))
    expect(kinds).toContain('ctx')
    expect(kinds).toContain('gap')
    expect(screen.getByTestId('file-change-card').textContent).toContain('world')
  })

  it('resets the copied label after the feedback window', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn(async () => {})
    stubClipboard(writeText)
    renderCard(settled({
      resultView: { card: 'diff', diffs: [{ path: 'n.ts', oldText: null, newText: 'one' }] },
    }))
    fireEvent.click(screen.getByTestId('file-change-copy'))
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByTestId('file-change-copy').getAttribute('title')).toBe('已复制')
    act(() => { vi.advanceTimersByTime(1200) })
    expect(screen.getByTestId('file-change-copy').getAttribute('title')).toBe('复制差异')
  })
})
