/**
 * PrecommitSection checklist chrome.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { PrecommitSection } from '../src/client/PrecommitSection.tsx'
import { zh } from '../src/client/locales.ts'
import type { GitChange } from '@deepseek-ai/dsh-client-runtime/client'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh)

const staged: GitChange = { path: 'a.ts', status: 'modified', area: 'index' }
const extra: GitChange[] = Array.from({ length: 9 }, (_, i) => ({
  path: `f${String(i)}.ts`,
  status: 'modified' as const,
  area: 'index' as const,
}))

describe('PrecommitSection', () => {
  it('shows counts only and hides confirm when nothing is staged', () => {
    render(
      <PrecommitSection
        t={t}
        changes={[]}
        confirmed={false}
        blockReason="nothing-staged"
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.getByTestId('xmart-precommit-summary').textContent).toContain('+0')
    expect(screen.getByTestId('xmart-precommit-hint').textContent).toContain('更改')
    expect(screen.queryByTestId('xmart-precommit-files')).toBeNull()
    expect(screen.queryByTestId('xmart-precommit-gates')).toBeNull()
    expect(screen.queryByTestId('xmart-git-confirm')).toBeNull()
    expect(screen.getByTestId('xmart-precommit-note').textContent).toContain('不会自动 push')
  })

  it('keeps counts without a file list and confirms the change set', () => {
    const onConfirm = vi.fn()
    render(
      <PrecommitSection
        t={t}
        changes={[staged, ...extra]}
        confirmed={false}
        blockReason="unconfirmed"
        onConfirm={onConfirm}
      />,
    )
    expect(screen.getByTestId('xmart-precommit-summary').textContent).toContain('~10')
    expect(screen.queryByTestId('xmart-precommit-files')).toBeNull()
    expect(screen.queryByText('a.ts')).toBeNull()
    expect(screen.queryByTestId('xmart-precommit-gates')).toBeNull()
    fireEvent.click(screen.getByTestId('xmart-git-confirm'))
    expect(onConfirm).toHaveBeenCalledWith(true)
    expect(screen.getByTestId('xmart-precommit-block').textContent).toContain('勾选确认')
  })

  it('renders every block reason', () => {
    const { rerender } = render(
      <PrecommitSection
        t={t}
        changes={[staged]}
        confirmed={false}
        blockReason="empty-message"
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.getByTestId('xmart-precommit-block').textContent).toContain('提交说明')
    rerender(
      <PrecommitSection
        t={t}
        changes={[staged]}
        confirmed={false}
        blockReason="unconfirmed"
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.getByTestId('xmart-precommit-block').textContent).toContain('勾选确认')
    rerender(
      <PrecommitSection
        t={t}
        changes={[staged]}
        confirmed
        blockReason="nothing-staged"
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.getByTestId('xmart-precommit-block').textContent).toContain('暂存')
  })
})
