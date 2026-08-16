/**
 * GitTab pre-commit loop: draft message, recommended gates, confirm, Agent.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { GitTab } from '../src/client/GitTab.tsx'
import { createWorkbenchFilesStore } from '../src/client/files-store.ts'
import { createGitBadgeStore } from '../src/client/git-badge.ts'
import { createChecksStore } from '../src/client/checks-store.ts'
import { zh } from '../src/client/locales.ts'
import type { GitStatus } from '@deepseek-ai/dsh-client-runtime/client'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh)

const status: GitStatus = {
  root: '/ws',
  branch: 'main',
  ahead: 0,
  behind: 0,
  detached: false,
  changes: [{ path: 'src/a.ts', status: 'modified', area: 'index' }],
}

function mount(opts?: {
  askAgent?: (text: string) => Promise<void>
  gitCommit?: (path: string, message: string) => Promise<unknown>
}) {
  const askAgentFn = opts?.askAgent ?? (async (_text: string) => {})
  const checks = createChecksStore()
  const start = vi.fn(async () => ({ ok: true as const, runId: 'c1' }))
  const poll = vi.fn(async () => ({
    ok: true,
    status: 'failed' as const,
    exitCode: 1,
    stdout: 'boom\n',
    stderr: '',
    stdoutNext: 5,
    stderrNext: 0,
    lossy: false,
  }))
  const gitCommit = opts?.gitCommit ?? vi.fn(async () => ({ root: '/ws', hash: 'abc' }))
  const askAgent = vi.fn(askAgentFn)
  const openChecks = vi.fn()
  const openFile = vi.fn()
  render(
    <GitTab
      tab={{ id: 'g', type: 'git', title: 'Git' }}
      visible
      sessionId="s1"
      t={t}
      getCwd={() => '/ws'}
      getWorkspacePaths={() => ['/ws']}
      watchSessions={() => () => {}}
      listEntries={async () => ({ path: '/ws', entries: [], truncated: false })}
      gitStatus={async () => status}
      gitStage={async () => {}}
      gitUnstage={async () => {}}
      gitDiscard={async () => {}}
      gitCommit={gitCommit}
      gitLog={async () => []}
      gitSync={async () => {}}
      gitBranches={async () => []}
      gitCheckout={async () => {}}
      gitCheckoutCommit={async () => {}}
      gitSuggestCommit={async () => ({ message: 'feat: 模型说明' })}
      openFile={openFile}
      openDiff={() => {}}
      openCommit={() => {}}
      files={createWorkbenchFilesStore()}
      gitBadge={createGitBadgeStore()}
      checks={checks}
      checksRemote={{ workspaceChecks: { start, poll, stop: vi.fn() } }}
      listCheckEntries={async () => [
        { name: 'package.json', kind: 'file' },
        { name: 'pnpm-lock.yaml', kind: 'file' },
      ]}
      readCheckFile={async () => JSON.stringify({
        scripts: { lint: 'oxlint', typecheck: 'tsc -b' },
      })}
      askAgent={askAgent}
      openChecks={openChecks}
    />,
  )
  return { checks, start, gitCommit, askAgent, openChecks, openFile }
}

describe('GitTab pre-commit', () => {
  it('drafts a conventional message and keeps files out of the summary', async () => {
    const { start, gitCommit, askAgent, openChecks, openFile } = mount()
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.queryByTestId('xmart-precommit-files')).toBeNull()
    expect(openFile).not.toHaveBeenCalled()
    expect((screen.getByLabelText('提交说明（Ctrl+Enter）') as HTMLTextAreaElement).value).toBe('feat: 更新 a.ts')
    expect(screen.getByTestId('xmart-precommit-gate-lint')).toBeTruthy()
    fireEvent.submit(screen.getByLabelText('提交说明（Ctrl+Enter）').closest('form') as HTMLFormElement)
    expect(gitCommit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('xmart-precommit-run'))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(start).toHaveBeenCalled()
    expect(openChecks).toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('xmart-precommit-ask-agent'))
    await act(async () => { await Promise.resolve() })
    expect(askAgent).toHaveBeenCalled()
    expect(String(askAgent.mock.calls[0]?.[0])).toContain('不要 push')
    fireEvent.click(screen.getByTestId('xmart-git-confirm'))
    fireEvent.submit(screen.getByLabelText('提交说明（Ctrl+Enter）').closest('form') as HTMLFormElement)
    expect(gitCommit).not.toHaveBeenCalled()
  })

  it('swallows a failed discovery and no-ops run without a remote', async () => {
    const checks = createChecksStore()
    checks.set({
      workspaceRoot: '/ws',
      packageRoot: '/ws',
      discovered: [{ kind: 'lint', script: 'lint' }],
      rows: [{ kind: 'lint', script: 'lint', status: 'idle', exitCode: null, command: '' }],
    })
    render(
      <GitTab
        tab={{ id: 'g', type: 'git', title: 'Git' }}
        visible
        sessionId="s1"
        t={t}
        getCwd={() => '/ws'}
        getWorkspacePaths={() => ['/ws']}
        watchSessions={() => () => {}}
        listEntries={async () => ({ path: '/ws', entries: [], truncated: false })}
        gitStatus={async () => status}
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
        gitBadge={createGitBadgeStore()}
        checks={checks}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    fireEvent.click(screen.getByTestId('xmart-precommit-run'))
    expect(checks.getSnapshot().busy).toBe(false)
    expect(screen.getByTestId('xmart-workbench-git-action-error').textContent).toContain('检查通道')
  })
})
