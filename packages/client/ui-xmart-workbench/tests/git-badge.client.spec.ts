import { describe, expect, it, vi } from 'vitest'
import type { FileListing, GitStatus } from '@deepseek-ai/dsh-client-runtime/client'
import {
  createGitBadgeStore, EMPTY_GIT_BADGE, gitBadgeLabel, gitBadgeTotal, gitChangeCounts,
  readGitBadgeSnapshot, startGitBadgeWatch,
} from '../src/client/git-badge.ts'

const listing = (paths: string[]): FileListing => ({
  path: '/ws',
  entries: paths.map(path => ({ name: path.slice(path.lastIndexOf('/') + 1), path, kind: 'directory' as const, hidden: false })),
  truncated: false,
})

const status = (root: string, staged: number, unstaged: number): GitStatus => ({
  root,
  branch: 'main',
  ahead: 0,
  behind: 0,
  detached: false,
  changes: [
    ...Array.from({ length: staged }, (_, i) => ({
      path: `s${i}.ts`, status: 'modified' as const, area: 'index' as const,
    })),
    ...Array.from({ length: unstaged }, (_, i) => ({
      path: `u${i}.ts`, status: 'modified' as const, area: 'worktree' as const,
    })),
  ],
})

describe('gitChangeCounts / gitBadgeLabel', () => {
  it('counts index and worktree rows separately and sums them', () => {
    const counts = gitChangeCounts([
      { path: 'a.ts', status: 'modified', area: 'index' },
      { path: 'a.ts', status: 'modified', area: 'worktree' },
      { path: 'b.ts', status: 'untracked', area: 'worktree' },
    ])
    expect(counts).toEqual({ staged: 1, unstaged: 2 })
    expect(gitBadgeTotal(counts)).toBe(3)
  })

  it('hides a zero bubble and caps at 99+', () => {
    expect(gitBadgeLabel(0)).toBeUndefined()
    expect(gitBadgeLabel(-1)).toBeUndefined()
    expect(gitBadgeLabel(1)).toBe('1')
    expect(gitBadgeLabel(99)).toBe('99')
    expect(gitBadgeLabel(100)).toBe('99+')
  })
})

describe('createGitBadgeStore', () => {
  it('stores per session and skips a no-op write', () => {
    const store = createGitBadgeStore()
    const fn = vi.fn()
    const off = store.subscribe(fn)
    expect(store.getSnapshot('s1')).toEqual(EMPTY_GIT_BADGE)
    store.set('s1', { staged: 1, unstaged: 74, root: '/ws' })
    expect(store.getSnapshot('s1')).toEqual({ staged: 1, unstaged: 74, root: '/ws' })
    expect(store.getSnapshot('s2')).toEqual(EMPTY_GIT_BADGE)
    expect(fn).toHaveBeenCalledOnce()
    store.set('s1', { staged: 1, unstaged: 74, root: '/ws' })
    expect(fn).toHaveBeenCalledOnce()
    off()
    store.set('s1', { staged: 0, unstaged: 0, root: undefined })
    expect(fn).toHaveBeenCalledOnce()
  })
})

describe('readGitBadgeSnapshot', () => {
  it('uses the preferred root when that status succeeds', async () => {
    const gitStatus = vi.fn(async (path: string) => status(path, 1, 0))
    const snap = await readGitBadgeSnapshot('/ws', '/ws/child', gitStatus, async () => listing([]))
    expect(snap).toEqual({ staged: 1, unstaged: 0, root: '/ws/child' })
    expect(gitStatus).toHaveBeenCalledWith('/ws/child', undefined)
  })

  it('falls back to cwd when the preferred root fails', async () => {
    const gitStatus = vi.fn(async (path: string) => {
      if (path === '/gone') throw new Error('missing')
      return status(path, 0, 2)
    })
    const snap = await readGitBadgeSnapshot('/ws', '/gone', gitStatus, async () => listing([]))
    expect(snap).toEqual({ staged: 0, unstaged: 2, root: '/ws' })
  })

  it('probes a child repo when cwd is not a work tree', async () => {
    const gitStatus = vi.fn(async (path: string) => {
      if (path === '/ws') throw new Error('not a repo')
      return status(path, 2, 1)
    })
    const snap = await readGitBadgeSnapshot(
      '/ws',
      undefined,
      gitStatus,
      async () => listing(['/ws/app']),
    )
    expect(snap).toEqual({ staged: 2, unstaged: 1, root: '/ws/app' })
  })

  it('returns empty when there is no folder or no repo', async () => {
    expect(await readGitBadgeSnapshot(undefined, undefined, async () => status('/x', 1, 0), async () => listing([])))
      .toEqual(EMPTY_GIT_BADGE)
    expect(await readGitBadgeSnapshot('', '', async () => status('/x', 1, 0), async () => listing([])))
      .toEqual(EMPTY_GIT_BADGE)
    const gitStatus = vi.fn(async () => {
      throw new Error('no')
    })
    expect(await readGitBadgeSnapshot('/ws', undefined, gitStatus, async () => listing(['/ws/app'])))
      .toEqual(EMPTY_GIT_BADGE)
    expect(await readGitBadgeSnapshot('/ws', undefined, gitStatus, async () => {
      throw new Error('list failed')
    })).toEqual(EMPTY_GIT_BADGE)
  })

  it('skips a duplicate preferred root and survives a vanished child probe', async () => {
    const gitStatus = vi.fn(async (path: string) => status(path, 0, 1))
    expect(await readGitBadgeSnapshot('/ws', '/ws', gitStatus, async () => listing([])))
      .toEqual({ staged: 0, unstaged: 1, root: '/ws' })
    expect(gitStatus).toHaveBeenCalledTimes(1)
    let hits = 0
    const vanishing = vi.fn(async (path: string) => {
      if (path === '/ws') throw new Error('not a repo')
      hits += 1
      if (hits === 1) return status(path, 1, 0)
      throw new Error('gone')
    })
    expect(await readGitBadgeSnapshot('/ws', undefined, vanishing, async () => listing(['/ws/app'])))
      .toEqual(EMPTY_GIT_BADGE)
  })
})

describe('startGitBadgeWatch', () => {
  it('loads the current session and reloads when watch fires', async () => {
    const store = createGitBadgeStore()
    let notify = () => {}
    const gitStatus = vi.fn(async () => status('/ws', 1, 74))
    const stop = startGitBadgeWatch({
      getSessionId: () => 's1',
      getCwd: () => '/ws',
      gitStatus,
      listEntries: async () => listing([]),
      store,
      watch: (fn) => {
        notify = fn
        return () => { notify = () => {} }
      },
    })
    await vi.waitFor(() => {
      expect(store.getSnapshot('s1')).toEqual({ staged: 1, unstaged: 74, root: '/ws' })
    })
    gitStatus.mockResolvedValueOnce(status('/ws', 0, 1))
    notify()
    await vi.waitFor(() => {
      expect(store.getSnapshot('s1')).toEqual({ staged: 0, unstaged: 1, root: '/ws' })
    })
    stop()
  })

  it('skips a missing session and drops a late read after dispose', async () => {
    const store = createGitBadgeStore()
    let settle: (value: GitStatus) => void = () => {}
    const stop = startGitBadgeWatch({
      getSessionId: () => undefined,
      getCwd: () => '/ws',
      gitStatus: async () => status('/ws', 1, 0),
      listEntries: async () => listing([]),
      store,
      watch: () => () => {},
    })
    await Promise.resolve()
    expect(store.getSnapshot('s1')).toEqual(EMPTY_GIT_BADGE)
    stop()
    const late = startGitBadgeWatch({
      getSessionId: () => 's1',
      getCwd: () => '/ws',
      gitStatus: () => new Promise((resolve) => { settle = resolve }),
      listEntries: async () => listing([]),
      store,
      watch: () => () => {},
    })
    late()
    settle(status('/ws', 3, 0))
    await Promise.resolve()
    expect(store.getSnapshot('s1')).toEqual(EMPTY_GIT_BADGE)
  })
})
