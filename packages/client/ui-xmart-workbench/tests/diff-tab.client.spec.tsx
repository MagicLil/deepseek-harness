// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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
        gitCommitDiff={vi.fn()}
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
        gitCommitDiff={vi.fn()}
      />,
    )
    expect(screen.getByText('这个差异标签没有路径。')).toBeTruthy()
    cleanup()
    render(
      <DiffTab
        tab={{ id: 'd', type: 'diff', title: 'bad', path: 'commit:nope' }}
        visible
        sessionId="s1"
        t={t}
        getCwd={() => '/ws'}
        gitDiff={vi.fn()}
        gitCommitDiff={vi.fn()}
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
        gitCommitDiff={vi.fn()}
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
        gitCommitDiff={vi.fn()}
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
        gitCommitDiff={vi.fn()}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('xmart-workbench-diff').querySelector('[data-kind="add"]')?.textContent).toMatch(/\+new/)
    expect(screen.getByTestId('xmart-workbench-diff').querySelector('[data-kind="del"]')?.textContent).toMatch(/-old/)
  })

  it('opens a commit as collapsible per-file sections', async () => {
    const gitCommitDiff = vi.fn(async () => ({
      root: '/ws',
      side: 'worktree' as const,
      text: [
        'diff --git a/src/a.ts b/src/a.ts',
        'new file mode 100644',
        '--- /dev/null',
        '+++ b/src/a.ts',
        '@@ -0,0 +1,1 @@',
        '+hi',
        'diff --git a/b.ts b/b.ts',
        '--- a/b.ts',
        '+++ b/b.ts',
        '@@ -1 +1 @@',
        '-old',
        '+new',
      ].join('\n'),
    }))
    render(
      <DiffTab
        tab={{ id: 'd', type: 'diff', title: 'abcdef1 init', path: 'commit:abcdef1' }}
        visible
        sessionId="s1"
        t={t}
        getCwd={() => '/ws'}
        gitDiff={vi.fn()}
        gitCommitDiff={gitCommitDiff}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(gitCommitDiff).toHaveBeenCalledWith('/ws', 'abcdef1', expect.any(AbortSignal))
    expect(screen.getByText('abcdef1 init')).toBeTruthy()
    expect(screen.getByText(/2 文件/)).toBeTruthy()
    expect(screen.getByText('a.ts')).toBeTruthy()
    expect(screen.getByText('src')).toBeTruthy()
    const header = screen.getByRole('button', { name: /a\.ts/ })
    expect(header.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(header)
    expect(header.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(header)
    expect(header.getAttribute('aria-expanded')).toBe('true')
    cleanup()
    render(
      <DiffTab
        tab={{ id: 'd', type: 'diff', title: 'abcdef1', path: 'commit:abcdef1' }}
        visible
        sessionId="s1"
        t={t}
        getCwd={() => '/ws'}
        gitDiff={vi.fn()}
        gitCommitDiff={async () => ({
          root: '/ws', side: 'worktree', text: 'diff --git \n@@ -1 +1 @@\n+x',
        })}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(screen.getByRole('button', { expanded: true })).toBeTruthy()
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
        gitCommitDiff={vi.fn()}
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
        gitCommitDiff={vi.fn()}
      />,
    )
    dying.unmount()
    await act(async () => { fail(new Error('late')); await Promise.resolve() })
  })
})
