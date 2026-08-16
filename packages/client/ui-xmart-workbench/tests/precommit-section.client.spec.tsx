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

const t = makeTranslate(zh, commonZh) as (key: string) => string

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
        gates={[]}
        rows={[]}
        busy={false}
        asking={false}
        confirmed={false}
        blockReason="nothing-staged"
        onConfirm={vi.fn()}
        onRunRecommended={vi.fn()}
      />,
    )
    expect(screen.getByTestId('xmart-precommit-summary').textContent).toContain('+0')
    expect(screen.getByTestId('xmart-precommit-hint').textContent).toContain('更改')
    expect(screen.queryByTestId('xmart-precommit-files')).toBeNull()
    expect(screen.queryByTestId('xmart-git-confirm')).toBeNull()
    expect(screen.getByTestId('xmart-precommit-note').textContent).toContain('不会自动 push')
  })

  it('keeps counts without a file list and hands failed rows to the Agent', () => {
    const onConfirm = vi.fn()
    const onRun = vi.fn()
    const onRunGate = vi.fn()
    const onAsk = vi.fn()
    render(
      <PrecommitSection
        t={t}
        changes={[staged, ...extra]}
        gates={[
          { kind: 'build', script: 'build', command: 'pnpm run build', recommended: false },
          { kind: 'lint', script: 'lint', command: 'pnpm run lint -- a.ts', recommended: true },
          { kind: 'test', script: 'test', command: 'pnpm run test', recommended: true },
        ]}
        rows={[
          { kind: 'lint', script: 'lint', status: 'stopped', exitCode: null, command: 'pnpm run lint -- a.ts' },
          { kind: 'build', script: 'build', status: 'idle', exitCode: null, command: '' },
        ]}
        busy={false}
        asking={false}
        confirmed={false}
        blockReason="gates-failed"
        onConfirm={onConfirm}
        onRunRecommended={onRun}
        onRunGate={onRunGate}
        onAskAgent={onAsk}
      />,
    )
    expect(screen.getByTestId('xmart-precommit-summary').textContent).toContain('~10')
    expect(screen.queryByTestId('xmart-precommit-files')).toBeNull()
    expect(screen.queryByText('a.ts')).toBeNull()
    expect(screen.getByTestId('xmart-precommit-gate-lint').getAttribute('data-status')).toBe('stopped')
    expect(screen.getByTestId('xmart-precommit-gate-test').getAttribute('data-status')).toBe('idle')
    expect(screen.getByTestId('xmart-precommit-gate-test').textContent).toContain('pnpm run test')
    expect(screen.getByTestId('xmart-precommit-gate-build').textContent).toContain('与本次改动无关')
    fireEvent.click(screen.getByTestId('xmart-precommit-run'))
    fireEvent.click(screen.getByTestId('xmart-precommit-run-lint'))
    fireEvent.click(screen.getByTestId('xmart-precommit-ask-agent'))
    fireEvent.click(screen.getByTestId('xmart-git-confirm'))
    expect(onRun).toHaveBeenCalledOnce()
    expect(onRunGate).toHaveBeenCalledWith('lint')
    expect(onAsk).toHaveBeenCalledOnce()
    expect(onConfirm).toHaveBeenCalledWith(true)
    expect(screen.getByTestId('xmart-precommit-block').textContent).toContain('失败')
  })

  it('renders every block reason and pending/running status labels', () => {
    const { rerender } = render(
      <PrecommitSection
        t={t}
        changes={[staged]}
        gates={[{ kind: 'lint', script: 'lint', command: 'pnpm run lint', recommended: true }]}
        rows={[{ kind: 'lint', script: 'lint', status: 'idle', exitCode: null, command: '' }]}
        busy
        asking
        confirmed={false}
        blockReason="gates-pending"
        onConfirm={vi.fn()}
        onRunRecommended={vi.fn()}
        onAskAgent={vi.fn()}
      />,
    )
    expect(screen.getByTestId('xmart-precommit-run')).toHaveProperty('disabled', true)
    expect(screen.getByTestId('xmart-precommit-block').textContent).toContain('推荐门禁')
    rerender(
      <PrecommitSection
        t={t}
        changes={[staged]}
        gates={[{ kind: 'lint', script: 'lint', command: 'pnpm run lint', recommended: true }]}
        rows={[{ kind: 'lint', script: 'lint', status: 'running', exitCode: null, command: 'pnpm run lint' }]}
        busy={false}
        asking={false}
        confirmed={false}
        blockReason="empty-message"
        onConfirm={vi.fn()}
        onRunRecommended={vi.fn()}
      />,
    )
    expect(screen.getByTestId('xmart-precommit-gate-lint').getAttribute('data-status')).toBe('running')
    expect(screen.getByTestId('xmart-precommit-block').textContent).toContain('提交说明')
    rerender(
      <PrecommitSection
        t={t}
        changes={[staged]}
        gates={[]}
        rows={[]}
        busy={false}
        asking={false}
        confirmed={false}
        blockReason="unconfirmed"
        onConfirm={vi.fn()}
        onRunRecommended={vi.fn()}
      />,
    )
    expect(screen.getByTestId('xmart-precommit-block').textContent).toContain('勾选确认')
    rerender(
      <PrecommitSection
        t={t}
        changes={[staged]}
        gates={[]}
        rows={[]}
        busy={false}
        asking={false}
        confirmed
        blockReason="nothing-staged"
        onConfirm={vi.fn()}
        onRunRecommended={vi.fn()}
      />,
    )
    expect(screen.getByTestId('xmart-precommit-block').textContent).toContain('暂存')
  })

  it('collapses recommended gates while keeping the run button', () => {
    render(
      <PrecommitSection
        t={t}
        changes={[staged, ...extra]}
        gates={[{ kind: 'lint', script: 'lint', command: 'pnpm run lint', recommended: true }]}
        rows={[]}
        busy={false}
        asking={false}
        confirmed={false}
        blockReason={undefined}
        onConfirm={vi.fn()}
        onRunRecommended={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('xmart-precommit-files')).toBeNull()
    expect(screen.queryByTestId('xmart-precommit-summary-toggle')).toBeNull()
    expect(screen.getByTestId('xmart-precommit-gates-head-actions').textContent).toContain('运行推荐门禁')
    fireEvent.click(screen.getByTestId('xmart-precommit-gates-head-toggle'))
    expect(screen.queryByTestId('xmart-precommit-gates')).toBeNull()
    expect(screen.getByTestId('xmart-precommit-run')).toBeTruthy()
    fireEvent.click(screen.getByTestId('xmart-precommit-gates-head-toggle'))
    expect(screen.getByTestId('xmart-precommit-gates')).toBeTruthy()
  })
})
