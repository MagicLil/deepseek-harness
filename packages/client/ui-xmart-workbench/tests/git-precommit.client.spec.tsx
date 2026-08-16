/**
 * GitTab pre-commit loop: draft message, confirm, then create the commit.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { GitTab } from '../src/client/GitTab.tsx'
import { createWorkbenchFilesStore } from '../src/client/files-store.ts'
import { createGitBadgeStore } from '../src/client/git-badge.ts'
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
  gitCommit?: (path: string, message: string) => Promise<unknown>
}) {
  const gitCommit = opts?.gitCommit ?? vi.fn(async () => ({ root: '/ws', hash: 'abc' }))
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
    />,
  )
  return { gitCommit, openFile }
}

describe('GitTab pre-commit', () => {
  it('drafts a conventional message and commits after confirm', async () => {
    const { gitCommit, openFile } = mount()
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.queryByTestId('xmart-precommit-files')).toBeNull()
    expect(screen.queryByTestId('xmart-precommit-gates')).toBeNull()
    expect(openFile).not.toHaveBeenCalled()
    expect(screen.getByLabelText('提交说明（Ctrl+Enter）')).toHaveProperty('value', 'feat: 更新 a.ts')
    fireEvent.submit(screen.getByLabelText('提交说明（Ctrl+Enter）').closest('form') as HTMLFormElement)
    expect(gitCommit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('xmart-git-confirm'))
    fireEvent.submit(screen.getByLabelText('提交说明（Ctrl+Enter）').closest('form') as HTMLFormElement)
    await act(async () => { await Promise.resolve() })
    expect(gitCommit).toHaveBeenCalledWith('/ws', 'feat: 更新 a.ts')
  })
})
