import { describe, expect, it, vi } from 'vitest'
import { GitAccessError, type FileListing, type GitStatus } from '@deepseek-ai/dsh-client-runtime/client'
import {
  createGitBadgeStore, EMPTY_GIT_BADGE, gitBadgeLabel, gitBadgeTotal, gitChangeCounts,
  readGitBadgeSnapshot, startGitBadgeWatch,
} from '../src/client/git-badge.ts'

const unavailable = new GitAccessError({
  code: 'git-unavailable', message: 'not a git repository',
} as never)

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

  it('hides a zero bubble and caps at 1k+', () => {
    expect(gitBadgeLabel(0)).toBeUndefined()
    expect(gitBadgeLabel(-1)).toBeUndefined()
    expect(gitBadgeLabel(1)).toBe('1')
    expect(gitBadgeLabel(220)).toBe('220')
    expect(gitBadgeLabel(999)).toBe('999')
    expect(gitBadgeLabel(1000)).toBe('1000')
    expect(gitBadgeLabel(1001)).toBe('1k+')
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
  it('keeps the preferred root when that repo is still in the project set', async () => {
    const gitStatus = vi.fn(async (path: string) => {
      if (path === '/ws') throw unavailable
      return status(path, path.endsWith('child') ? 1 : 0, 0)
    })
    const snap = await readGitBadgeSnapshot(
      '/ws',
      '/ws/child',
      [],
      gitStatus,
      async () => listing(['/ws/app', '/ws/child']),
    )
    expect(snap).toEqual({ staged: 1, unstaged: 0, root: '/ws/child' })
  })

  it('falls back to the first discovered root when the preferred root is gone', async () => {
    const gitStatus = vi.fn(async (path: string) => {
      if (path === '/gone') throw new Error('missing')
      return status(path, 0, 2)
    })
    const snap = await readGitBadgeSnapshot('/ws', '/gone', [], gitStatus, async () => listing([]))
    expect(snap).toEqual({ staged: 0, unstaged: 2, root: '/ws' })
    expect(await readGitBadgeSnapshot('/ws', '', [], gitStatus, async () => listing([])))
      .toEqual({ staged: 0, unstaged: 2, root: '/ws' })
  })

  it('sums every child repo when cwd is not a work tree', async () => {
    const gitStatus = vi.fn(async (path: string) => {
      if (path === '/ws') throw unavailable
      if (path.endsWith('app')) return status(path, 2, 1)
      return status(path, 0, 3)
    })
    const snap = await readGitBadgeSnapshot(
      '/ws',
      undefined,
      [],
      gitStatus,
      async () => listing(['/ws/app', '/ws/lib']),
    )
    expect(snap).toEqual({ staged: 2, unstaged: 4, root: '/ws/app' })
  })

  it('includes a nested workspace seed under the current project', async () => {
    const gitStatus = vi.fn(async (path: string) => status(path, path.endsWith('child') ? 4 : 1, 0))
    const snap = await readGitBadgeSnapshot(
      '/ws',
      undefined,
      ['/ws', '/ws/child'],
      gitStatus,
      async () => listing([]),
    )
    expect(snap).toEqual({ staged: 5, unstaged: 0, root: '/ws' })
  })

  it('returns empty when there is no folder or no repo', async () => {
    expect(await readGitBadgeSnapshot(undefined, undefined, [], async () => status('/x', 1, 0), async () => listing([])))
      .toEqual(EMPTY_GIT_BADGE)
    expect(await readGitBadgeSnapshot('', '', [], async () => status('/x', 1, 0), async () => listing([])))
      .toEqual(EMPTY_GIT_BADGE)
    const gitStatus = vi.fn(async () => {
      throw new Error('no')
    })
    expect(await readGitBadgeSnapshot('/ws', undefined, [], gitStatus, async () => listing(['/ws/app'])))
      .toEqual(EMPTY_GIT_BADGE)
    expect(await readGitBadgeSnapshot('/ws', undefined, [], gitStatus, async () => {
      throw new Error('list failed')
    })).toEqual(EMPTY_GIT_BADGE)
  })

  it('skips a duplicate preferred root and survives a vanished child probe', async () => {
    const gitStatus = vi.fn(async (path: string) => status(path, 0, 1))
    expect(await readGitBadgeSnapshot('/ws', '/ws', [], gitStatus, async () => listing([])))
      .toEqual({ staged: 0, unstaged: 1, root: '/ws' })
    let hits = 0
    const vanishing = vi.fn(async (path: string) => {
      if (path === '/ws') throw unavailable
      hits += 1
      if (hits === 1) return status(path, 1, 0)
      throw new Error('gone')
    })
    expect(await readGitBadgeSnapshot('/ws', undefined, [], vanishing, async () => listing(['/ws/app'])))
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
      getWorkspacePaths: () => [],
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
    gitStatus.mockResolvedValue(status('/ws', 0, 1))
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
      getWorkspacePaths: () => [],
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
      getWorkspacePaths: () => [],
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
