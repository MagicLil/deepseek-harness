// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { DiffTab } from '../src/client/DiffTab.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh)

describe('DiffTab', () => {
  it('shows no-path copy when the seed or cwd is missing', () => {
    render(
      <DiffTab
        tab={{ id: 'd', type: 'diff', title: 'a.ts' }}
        visible
        sessionId="s1"
        t={t}
        getCwd={() => '/ws'}
        gitDiff={vi.fn()}
      />,
    )
    expect(screen.getByText('这个差异标签没有路径。')).toBeTruthy()
    cleanup()
    render(
      <DiffTab
        tab={{ id: 'd', type: 'diff', title: 'a.ts', path: 'worktree:a.ts' }}
        visible
        sessionId="s1"
        t={t}
        getCwd={() => ''}
        gitDiff={vi.fn()}
      />,
    )
    expect(screen.getByText('这个差异标签没有路径。')).toBeTruthy()
  })

  it('renders empty, error, and colored lines', async () => {
    render(
      <DiffTab
        tab={{ id: 'd', type: 'diff', title: 'a.ts', path: 'worktree:a.ts' }}
        visible
        sessionId="s1"
        t={t}
        getCwd={() => '/ws'}
        gitDiff={async () => ({ root: '/ws', side: 'worktree', text: '' })}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('这一侧没有差异。')).toBeTruthy()
    cleanup()
    render(
      <DiffTab
        tab={{ id: 'd', type: 'diff', title: 'a.ts', path: 'staged:a.ts' }}
        visible
        sessionId="s1"
        t={t}
        getCwd={() => '/ws'}
        gitDiff={async () => { throw new Error('no') }}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('差异读取失败。')).toBeTruthy()
    cleanup()
    render(
      <DiffTab
        tab={{ id: 'd', type: 'diff', title: 'a.ts', path: 'worktree:a.ts' }}
        visible
        sessionId="s1"
        t={t}
        getCwd={() => '/ws'}
        gitDiff={async () => ({
          root: '/ws',
          side: 'worktree',
          text: 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-old\n+new\n\n keep',
        })}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('xmart-workbench-diff').querySelector('[data-kind="add"]')?.textContent).toBe('+new')
    expect(screen.getByTestId('xmart-workbench-diff').querySelector('[data-kind="del"]')?.textContent).toBe('-old')
  })

  it('ignores a late resolve and reject after unmount', async () => {
    let settle: (value: { root: string; side: 'worktree'; text: string }) => void = () => {}
    const view = render(
      <DiffTab
        tab={{ id: 'd', type: 'diff', title: 'a.ts', path: 'worktree:a.ts' }}
        visible
        sessionId="s1"
        t={t}
        getCwd={() => '/ws'}
        gitDiff={() => new Promise((resolve) => { settle = resolve })}
      />,
    )
    expect(screen.getByText('正在读取差异…')).toBeTruthy()
    view.unmount()
    await act(async () => { settle({ root: '/ws', side: 'worktree', text: 'x' }); await Promise.resolve() })
    cleanup()
    let fail: (reason: unknown) => void = () => {}
    const dying = render(
      <DiffTab
        tab={{ id: 'd', type: 'diff', title: 'a.ts', path: 'worktree:a.ts' }}
        visible
        sessionId="s1"
        t={t}
        getCwd={() => '/ws'}
        gitDiff={() => new Promise((_, reject) => { fail = reject })}
      />,
    )
    dying.unmount()
    await act(async () => { fail(new Error('late')); await Promise.resolve() })
  })
})
