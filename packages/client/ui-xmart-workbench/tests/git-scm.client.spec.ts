import { describe, expect, it, vi } from 'vitest'
import type { GitChange } from '@deepseek-ai/dsh-client-runtime/client'
import {
  gitActionMessage, gitBranchPickerItems, gitChangeKey, gitCheckoutNameForPicker,
  gitDiffSideOf, gitMenuItemIds, gitSectionPaths, isGitBranchName, isRemoteTrackingRow,
  localBranchNameForRemote, partitionGitChanges, runGitSyncSequence,
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

describe('localBranchNameForRemote', () => {
  it('maps origin/foo to a local foo and rejects a remote-only name', () => {
    const locals = [{ name: 'anruisen' }, { name: 'feat/x' }]
    expect(localBranchNameForRemote('origin/anruisen', locals)).toBe('anruisen')
    expect(localBranchNameForRemote('origin/feat/x', locals)).toBe('feat/x')
    expect(localBranchNameForRemote('origin/missing', locals)).toBeUndefined()
    expect(localBranchNameForRemote('anruisen', locals)).toBeUndefined()
    expect(localBranchNameForRemote('origin/', locals)).toBeUndefined()
    expect(localBranchNameForRemote('/anruisen', locals)).toBeUndefined()
  })
})

describe('gitBranchPickerItems / gitCheckoutNameForPicker', () => {
  it('groups locals then remotes and maps a remote id to switch name', () => {
    expect(gitBranchPickerItems([], { local: 'L', remote: 'R' })).toEqual([])
    expect(gitBranchPickerItems([{ name: 'main' }], { local: 'L', remote: 'R' })).toEqual([
      { id: 'heading-local', label: 'L', heading: true },
      { id: 'main', label: 'main' },
    ])
    expect(gitBranchPickerItems(
      [{ name: 'origin/dagen', remote: true }],
      { local: 'L', remote: 'R' },
    )).toEqual([
      { id: 'heading-remote', label: 'R', heading: true },
      { id: 'remote:origin/dagen', label: 'origin/dagen' },
    ])
    expect(gitBranchPickerItems(
      [{ name: 'anruisen' }, { name: 'origin/anruisen', remote: true }, { name: 'origin/dagen', remote: true }],
      { local: '本地分支', remote: '远程分支' },
    ).map(row => row.id)).toEqual([
      'heading-local', 'anruisen', 'heading-remote', 'remote:origin/dagen',
    ])
    expect(gitBranchPickerItems(
      [{ name: 'anruisen' }, { name: 'origin' }, { name: 'origin/dagen' }, { name: 'feat/x' }],
      { local: 'L', remote: 'R' },
    ).map(row => row.id)).toEqual([
      'heading-local', 'anruisen', 'feat/x', 'heading-remote', 'remote:origin/dagen',
    ])
    expect(isRemoteTrackingRow({ name: 'origin/dagen' }, ['origin'])).toBe(true)
    expect(isRemoteTrackingRow({ name: 'feat/x' }, ['origin'])).toBe(false)
    expect(gitCheckoutNameForPicker('anruisen', [{ name: 'anruisen' }])).toBe('anruisen')
    expect(gitCheckoutNameForPicker('origin/anruisen', [{ name: 'anruisen' }])).toBe('anruisen')
    expect(gitCheckoutNameForPicker('remote:origin/anruisen', [{ name: 'anruisen' }])).toBe('anruisen')
    expect(gitCheckoutNameForPicker('remote:origin/dagen', [{ name: 'anruisen' }])).toBe('dagen')
    expect(gitCheckoutNameForPicker('remote:origin', [{ name: 'anruisen' }])).toBeUndefined()
    expect(gitCheckoutNameForPicker('remote:weird', [])).toBeUndefined()
    expect(gitCheckoutNameForPicker('HEAD', [{ name: 'HEAD', remote: true }])).toBeUndefined()
    expect(gitBranchPickerItems(
      [
        { name: 'main' },
        { name: 'origin', remote: true },
        { name: 'origin/HEAD', remote: true },
        { name: 'origin/dagen', remote: true },
      ],
      { local: 'L', remote: 'R' },
    ).map(row => row.id)).toEqual([
      'heading-local', 'main', 'heading-remote', 'remote:origin/dagen',
    ])
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
