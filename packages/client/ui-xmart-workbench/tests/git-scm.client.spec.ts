import { describe, expect, it, vi } from 'vitest'
import type { GitChange } from '@deepseek-ai/dsh-client-runtime/client'
import {
  gitActionMessage, gitChangeKey, gitDiffSideOf, gitMenuItemIds, gitSectionPaths,
  isGitBranchName, partitionGitChanges, runGitSyncSequence,
} from '../src/client/git-scm.ts'

const staged: GitChange = { path: 'a.ts', status: 'modified', area: 'index' }
const dirty: GitChange = { path: 'a.ts', status: 'modified', area: 'worktree' }
const extra: GitChange = { path: 'b.ts', status: 'untracked', area: 'worktree' }

describe('partitionGitChanges', () => {
  it('splits index rows from worktree rows', () => {
    expect(partitionGitChanges([staged, dirty, extra])).toEqual({
      staged: [staged],
      unstaged: [dirty, extra],
    })
  })
})

describe('gitSectionPaths', () => {
  it('dedupes paths in one section', () => {
    expect(gitSectionPaths([staged, dirty, extra])).toEqual(['a.ts', 'b.ts'])
  })
})

describe('gitDiffSideOf / gitChangeKey / gitMenuItemIds', () => {
  it('maps area to the diff side, row key, and menu verbs', () => {
    expect(gitDiffSideOf(staged)).toBe('staged')
    expect(gitDiffSideOf(dirty)).toBe('worktree')
    expect(gitChangeKey(staged)).toBe('index:a.ts')
    expect(gitChangeKey(dirty)).toBe('worktree:a.ts')
    expect(gitMenuItemIds('index')).toEqual(['unstage', 'diff-staged', 'open'])
    expect(gitMenuItemIds('worktree')).toEqual(['stage', 'discard', 'diff-work', 'open'])
    expect(gitMenuItemIds(undefined)).toEqual(['stage', 'discard', 'diff-work', 'open'])
  })
})

describe('isGitBranchName / gitActionMessage / runGitSyncSequence', () => {
  it('accepts a safe name and rejects the host-schema rejects', () => {
    expect(isGitBranchName('feat/ok')).toBe(true)
    expect(isGitBranchName('')).toBe(false)
    expect(isGitBranchName('-x')).toBe(false)
    expect(isGitBranchName('a..b')).toBe(false)
    expect(isGitBranchName('a@{b')).toBe(false)
    expect(isGitBranchName('a/')).toBe(false)
    expect(isGitBranchName('a.lock')).toBe(false)
    expect(isGitBranchName('x'.repeat(201))).toBe(false)
  })

  it('reads an Error message or falls back', () => {
    expect(gitActionMessage(new Error('boom'))).toBe('boom')
    expect(gitActionMessage(new Error(''))).toBe('git failed')
    expect(gitActionMessage('nope')).toBe('git failed')
  })

  it('fetches, pulls when behind, then pushes when ahead', async () => {
    const gitSync = vi.fn(async (_path: string, _mode: 'fetch' | 'pull' | 'push') => {})
    const gitStatus = vi.fn()
      .mockResolvedValueOnce({ ahead: 1, behind: 1 })
      .mockResolvedValueOnce({ ahead: 1, behind: 0 })
    await runGitSyncSequence('/ws', { gitSync, gitStatus })
    expect(gitSync.mock.calls.map(call => call[1])).toEqual(['fetch', 'pull', 'push'])
  })

  it('pushes when only ahead', async () => {
    const gitSync = vi.fn(async (_path: string, _mode: 'fetch' | 'pull' | 'push') => {})
    await runGitSyncSequence('/ws', {
      gitSync,
      gitStatus: async () => ({ ahead: 2, behind: 0 }),
    })
    expect(gitSync.mock.calls.map(call => call[1])).toEqual(['fetch', 'push'])
  })

  it('skips pull and push when the tree is even', async () => {
    const gitSync = vi.fn(async (_path: string, _mode: 'fetch' | 'pull' | 'push') => {})
    await runGitSyncSequence('/ws', {
      gitSync,
      gitStatus: async () => ({ ahead: 0, behind: 0 }),
    })
    expect(gitSync).toHaveBeenCalledTimes(1)
    expect(gitSync).toHaveBeenCalledWith('/ws', 'fetch')
  })
})
