// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { FileListing } from '@deepseek-ai/dsh-client-runtime/client'
import { QuickOpen } from '../src/client/QuickOpen.tsx'
import { WORKBENCH_QUICK_OPEN_EVENT } from '../src/client/app-menu-dispatch.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh) as never

function listing(entries: FileListing['entries']): FileListing {
  return { path: '/ws', entries, truncated: false }
}

describe('QuickOpen', () => {
  it('opens from the menu event, filters, and opens a file', async () => {
    const openFile = vi.fn()
    const listEntries = vi.fn(async () => listing([
      { name: 'UserService.java', path: '/ws/UserService.java', kind: 'file', hidden: false },
      { name: 'App.vue', path: '/ws/App.vue', kind: 'file', hidden: false },
    ]))
    render(
      <QuickOpen
        t={t}
        getRoots={() => [{ path: '/ws', title: 'ws' }]}
        listEntries={listEntries}
        openFile={openFile}
      />,
    )
    expect(screen.queryByTestId('xmart-quick-open')).toBeNull()
    await act(async () => { window.dispatchEvent(new Event(WORKBENCH_QUICK_OPEN_EVENT)) })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByTestId('xmart-quick-open')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('输入文件名…'), { target: { value: 'user' } })
    expect(screen.getByRole('option', { name: /UserService\.java/ })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /App\.vue/ })).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: /UserService\.java/ }))
    expect(openFile).toHaveBeenCalledWith('/ws/UserService.java')
    expect(screen.queryByTestId('xmart-quick-open')).toBeNull()
  })

  it('moves the highlight with arrows, Enter opens, Escape and backdrop close', async () => {
    const openFile = vi.fn()
    render(
      <QuickOpen
        t={t}
        getRoots={() => [{ path: '/ws', title: 'ws' }]}
        listEntries={async () => listing([
          { name: 'a.ts', path: '/ws/a.ts', kind: 'file', hidden: false },
          { name: 'b.ts', path: '/ws/b.ts', kind: 'file', hidden: false },
        ])}
        openFile={openFile}
      />,
    )
    await act(async () => { window.dispatchEvent(new Event(WORKBENCH_QUICK_OPEN_EVENT)) })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    const input = screen.getByPlaceholderText('输入文件名…')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.mouseEnter(screen.getByRole('option', { name: /b\.ts/ }))
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(openFile).toHaveBeenCalledWith('/ws/b.ts')
    await act(async () => { window.dispatchEvent(new Event(WORKBENCH_QUICK_OPEN_EVENT)) })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    fireEvent.keyDown(screen.getByPlaceholderText('输入文件名…'), { key: 'Escape' })
    expect(screen.queryByTestId('xmart-quick-open')).toBeNull()
    await act(async () => { window.dispatchEvent(new Event(WORKBENCH_QUICK_OPEN_EVENT)) })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(screen.getByTestId('xmart-quick-open')).toBeTruthy()
    fireEvent.mouseDown(screen.getByTestId('xmart-quick-open'))
    expect(screen.queryByTestId('xmart-quick-open')).toBeNull()
  })

  it('shows the no-workspace note and ignores Enter with no match', async () => {
    const openFile = vi.fn()
    render(
      <QuickOpen
        t={t}
        getRoots={() => []}
        listEntries={async () => listing([])}
        openFile={openFile}
      />,
    )
    await act(async () => { window.dispatchEvent(new Event(WORKBENCH_QUICK_OPEN_EVENT)) })
    expect(screen.getByText('没有工作区可搜索')).toBeTruthy()
    fireEvent.keyDown(screen.getByPlaceholderText('输入文件名…'), { key: 'Enter' })
    expect(openFile).not.toHaveBeenCalled()
  })

  it('shows empty when the walk fails and drops a late result after close', async () => {
    let settle: ((value: FileListing) => void) | undefined
    const listEntries = vi.fn(() => new Promise<FileListing>((resolve) => { settle = resolve }))
    const { unmount } = render(
      <QuickOpen
        t={t}
        getRoots={() => [{ path: '/ws', title: 'ws' }]}
        listEntries={listEntries}
        openFile={() => {}}
      />,
    )
    await act(async () => { window.dispatchEvent(new Event(WORKBENCH_QUICK_OPEN_EVENT)) })
    unmount()
    await act(async () => {
      settle?.(listing([{ name: 'a.ts', path: '/ws/a.ts', kind: 'file', hidden: false }]))
    })
    render(
      <QuickOpen
        t={t}
        getRoots={() => [{ path: '/ws', title: 'ws' }]}
        listEntries={async () => { throw new Error('nope') }}
        openFile={() => {}}
      />,
    )
    await act(async () => { window.dispatchEvent(new Event(WORKBENCH_QUICK_OPEN_EVENT)) })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText('没有匹配的文件')).toBeTruthy()
  })
})
