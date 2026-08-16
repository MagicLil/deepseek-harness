import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyGitRefs, attachOriginUrl, collectGitBranches, collectGitCheckout, collectGitCommit,
  collectGitDiff, collectGitDiscard, collectGitLog, collectGitStage, collectGitSync,
  collectGitUnstage, diffArgs, gitRefFromName, isGitCommitId, isGitRemoteSymbolicRef,
  isNoUpstreamPushFailure, isUntrackedRestoreFailure, parseGitBranches, parseGitLog,
  parseGitLogRecord, parseGitRefMap,
} from '../src/git-ops.ts'

const { resolveGitRoot, runGit } = vi.hoisted(() => ({
  resolveGitRoot: vi.fn(),
  runGit: vi.fn(),
}))

vi.mock('../src/git-status.ts', () => ({
  resolveGitRoot,
  runGit,
}))

beforeEach(() => {
  resolveGitRoot.mockReset()
  runGit.mockReset()
  resolveGitRoot.mockResolvedValue({ ok: true, root: '/repo' })
})

describe('diffArgs / parseGitLog / isUntrackedRestoreFailure', () => {
  it('builds worktree, staged, and commit argv', () => {
    expect(diffArgs('/repo', 'worktree', undefined)).toEqual(['-C', '/repo', 'diff', '--'])
    expect(diffArgs('/repo', 'staged', 'a.ts')).toEqual(['-C', '/repo', 'diff', '--cached', '--', 'a.ts'])
    expect(diffArgs('/repo', 'worktree', undefined, 'abcdef1')).toEqual([
      '-C', '/repo', 'show', '--format=', '--first-parent', '--patch', 'abcdef1', '--',
    ])
    expect(diffArgs('/repo', 'staged', 'a.ts', 'abcdef1')).toEqual([
      '-C', '/repo', 'show', '--format=', '--first-parent', '--patch', 'abcdef1', '--', 'a.ts',
    ])
    expect(isGitCommitId('abcdef1')).toBe(true)
    expect(isGitCommitId('HEAD;rm')).toBe(false)
  })

  it('parses log rows and skips empties', () => {
    expect(parseGitLog('')).toEqual([])
    expect(parseGitLog('\n')).toEqual([])
    expect(parseGitLogRecord('')).toBeUndefined()
    expect(parseGitLog([
      'abc\x1fsubject\x1fAnn\x1f10',
      '\x1fnohash\x1fX\x1f1',
      'def\x1fonly',
      'ghi',
      'mrg\x1fmerge\x1fAnn\x1f11\x1fabc def',
    ].join('\n'))).toEqual([
      { hash: 'abc', subject: 'subject', author: 'Ann', timestamp: 10 },
      { hash: 'def', subject: 'only', author: '', timestamp: 0 },
      { hash: 'ghi', subject: '', author: '', timestamp: 0 },
      { hash: 'mrg', subject: 'merge', author: 'Ann', timestamp: 11, parents: ['abc', 'def'] },
    ])
    expect(parseGitLog([
      '\x1eabc\x1fsubject\x1fAnn\x1f10\x1f\x1fCo-authored-by: Cursor <c@x>',
      '',
      ' 1 file changed, 2 insertions(+), 1 deletion(-)',
      '\x1edef\x1fonly\x1fBob\x1f9\x1fabc\x1f',
      '',
      ' 2 files changed, 3 insertions(+)',
      '\x1eghi\x1fplain\x1fAnn\x1f8\x1f\x1f',
      '\x1edel\x1fdrop\x1fAnn\x1f7\x1f\x1f',
      '',
      ' 1 file changed, 1 deletion(-)',
    ].join('\n'))).toEqual([
      {
        hash: 'abc', subject: 'subject', author: 'Ann', timestamp: 10,
        body: 'Co-authored-by: Cursor <c@x>', files: 1, insertions: 2, deletions: 1,
      },
      { hash: 'def', subject: 'only', author: 'Bob', timestamp: 9, parents: ['abc'], files: 2, insertions: 3 },
      { hash: 'ghi', subject: 'plain', author: 'Ann', timestamp: 8 },
      { hash: 'del', subject: 'drop', author: 'Ann', timestamp: 7, files: 1, deletions: 1 },
    ])
    expect(parseGitLogRecord([
      'real\x1fsubject\x1fAnn\x1f10\x1fabc\x1f点分区标题即可折叠。',
      '',
      'Co-authored-by: Cursor <c@x>',
      '',
      '',
      ' 9 files changed, 1701 insertions(+), 170 deletions(-)',
    ].join('\n'))).toEqual({
      hash: 'real', subject: 'subject', author: 'Ann', timestamp: 10, parents: ['abc'],
      body: '点分区标题即可折叠。\n\nCo-authored-by: Cursor <c@x>',
      files: 9, insertions: 1701, deletions: 170,
    })
    expect(attachOriginUrl(
      [{ hash: 'abc', subject: 's', author: 'A', timestamp: 1 }],
      undefined,
    )[0]?.originUrl).toBeUndefined()
    expect(attachOriginUrl(
      [{ hash: 'abc', subject: 's', author: 'A', timestamp: 1 }],
      { ok: false },
    )[0]?.originUrl).toBeUndefined()
    expect(attachOriginUrl(
      [{ hash: 'abc', subject: 's', author: 'A', timestamp: 1 }],
      { ok: true, stdout: '  \n' },
    )[0]?.originUrl).toBeUndefined()
    expect(attachOriginUrl(
      [{ hash: 'abc', subject: 's', author: 'A', timestamp: 1 }],
      { ok: true, stdout: 'git@github.com:acme/app.git\n' },
    )[0]?.originUrl).toBe('git@github.com:acme/app.git')
  })

  it('detects untracked restore failures', () => {
    expect(isUntrackedRestoreFailure('error: pathspec \'a\' did not match any file(s) known to git')).toBe(true)
    expect(isUntrackedRestoreFailure('fatal: not a git repository')).toBe(false)
  })
})

describe('collect git ops', () => {
  it('returns root failures from every verb', async () => {
    resolveGitRoot.mockResolvedValue({ ok: false, code: 'git-unavailable', message: 'no' })
    await expect(collectGitDiff('/x', 'worktree', undefined)).resolves.toMatchObject({ ok: false })
    await expect(collectGitStage('/x', ['a.ts'])).resolves.toMatchObject({ ok: false })
    await expect(collectGitUnstage('/x', ['a.ts'])).resolves.toMatchObject({ ok: false })
    await expect(collectGitCommit('/x', 'm')).resolves.toMatchObject({ ok: false })
    await expect(collectGitDiscard('/x', ['a.ts'])).resolves.toMatchObject({ ok: false })
    await expect(collectGitLog('/x', 5)).resolves.toMatchObject({ ok: false })
    await expect(collectGitSync('/x', 'fetch')).resolves.toMatchObject({ ok: false })
    await expect(collectGitBranches('/x')).resolves.toMatchObject({ ok: false })
    await expect(collectGitCheckout('/x', 'feat', false)).resolves.toMatchObject({ ok: false })
  })

  it('collects a worktree diff and a staged file diff', async () => {
    runGit.mockResolvedValue({ ok: true, stdout: 'diff --git a/a.ts' })
    await expect(collectGitDiff('/ws', 'worktree', undefined)).resolves.toEqual({
      ok: true, value: { root: '/repo', side: 'worktree', text: 'diff --git a/a.ts' },
    })
    runGit.mockResolvedValue({ ok: true, stdout: 'diff --git a/a.ts' })
    await expect(collectGitDiff('/ws', 'staged', 'a.ts')).resolves.toEqual({
      ok: true, value: { root: '/repo', side: 'staged', path: 'a.ts', text: 'diff --git a/a.ts' },
    })
    runGit.mockResolvedValue({ ok: false, code: 'git-failed', message: 'boom' })
    await expect(collectGitDiff('/ws', 'staged', 'a.ts')).resolves.toMatchObject({ ok: false })
    await expect(collectGitDiff('/ws', 'worktree', undefined, undefined, 'HEAD;rm'))
      .resolves.toEqual({ ok: false, code: 'git-failed', message: 'invalid commit' })
    runGit.mockResolvedValue({ ok: true, stdout: 'diff --git a/a.ts' })
    await expect(collectGitDiff('/ws', 'worktree', undefined, undefined, 'abcdef1')).resolves.toEqual({
      ok: true, value: { root: '/repo', side: 'worktree', text: 'diff --git a/a.ts' },
    })
    expect(runGit).toHaveBeenCalledWith([
      '-C', '/repo', 'show', '--format=', '--first-parent', '--patch', 'abcdef1', '--',
    ], undefined)
  })

  it('stages, unstages, and clamps log limit', async () => {
    runGit.mockResolvedValue({ ok: true, stdout: '' })
    await expect(collectGitStage('/ws', ['a.ts'])).resolves.toEqual({ ok: true, value: { root: '/repo' } })
    await expect(collectGitUnstage('/ws', ['a.ts'])).resolves.toEqual({ ok: true, value: { root: '/repo' } })
    runGit.mockResolvedValue({ ok: false, code: 'git-failed', message: 'no' })
    await expect(collectGitStage('/ws', ['a.ts'])).resolves.toMatchObject({ ok: false })
    runGit.mockResolvedValue({ ok: true, stdout: 'abc\x1fs\x1fa\x1f1\n' })
    await expect(collectGitLog('/ws', 0)).resolves.toMatchObject({ ok: true })
    await expect(collectGitLog('/ws', 999)).resolves.toMatchObject({ ok: true })
    runGit.mockResolvedValue({ ok: false, code: 'git-failed', message: 'no' })
    await expect(collectGitLog('/ws', 3)).resolves.toMatchObject({ ok: false })
  })

  it('pages older log rows with --skip', async () => {
    runGit.mockResolvedValue({ ok: true, stdout: 'abc\x1fs\x1fa\x1f1\n' })
    await collectGitLog('/ws', 80, undefined, 80)
    expect(runGit.mock.calls[0]?.[0]).toEqual(expect.arrayContaining(['log', '-n80', '--skip=80']))
    expect(runGit.mock.calls[0]?.[0]).not.toEqual(expect.arrayContaining(['--all']))
    runGit.mockClear()
    runGit.mockResolvedValue({ ok: true, stdout: 'abc\x1fs\x1fa\x1f1\n' })
    await collectGitLog('/ws', 80, undefined, 0)
    expect(runGit.mock.calls[0]?.[0]).not.toEqual(expect.arrayContaining([expect.stringMatching(/^--skip=/)]))
    runGit.mockClear()
    runGit.mockResolvedValue({ ok: true, stdout: 'abc\x1fs\x1fa\x1f1\n' })
    await collectGitLog('/ws', 80, undefined, Number.NaN)
    expect(runGit.mock.calls[0]?.[0]).not.toEqual(expect.arrayContaining([expect.stringMatching(/^--skip=/)]))
    runGit.mockClear()
    runGit.mockResolvedValue({ ok: true, stdout: 'abc\x1fs\x1fa\x1f1\n' })
    await collectGitLog('/ws', 80, undefined, -4)
    expect(runGit.mock.calls[0]?.[0]).not.toEqual(expect.arrayContaining([expect.stringMatching(/^--skip=/)]))
    runGit.mockClear()
    runGit.mockResolvedValue({ ok: true, stdout: 'abc\x1fs\x1fa\x1f1\n' })
    await collectGitLog('/ws', 80, undefined, 999_999)
    expect(runGit.mock.calls[0]?.[0]).toEqual(expect.arrayContaining(['--skip=100000']))
  })

  it('commits then reads HEAD, and discards through restore+clean', async () => {
    runGit
      .mockResolvedValueOnce({ ok: true, stdout: '[main abc] m' })
      .mockResolvedValueOnce({ ok: true, stdout: 'abc\n' })
    await expect(collectGitCommit('/ws', 'm')).resolves.toEqual({
      ok: true, value: { root: '/repo', hash: 'abc' },
    })
    runGit.mockResolvedValueOnce({ ok: false, code: 'git-failed', message: 'nothing' })
    await expect(collectGitCommit('/ws', 'm')).resolves.toMatchObject({ ok: false })
    runGit
      .mockResolvedValueOnce({ ok: true, stdout: '[main abc] m' })
      .mockResolvedValueOnce({ ok: false, code: 'git-failed', message: 'head' })
    await expect(collectGitCommit('/ws', 'm')).resolves.toMatchObject({ ok: false })
    runGit
      .mockResolvedValueOnce({ ok: true, stdout: '' })
      .mockResolvedValueOnce({ ok: true, stdout: '' })
    await expect(collectGitDiscard('/ws', ['a.ts'])).resolves.toEqual({ ok: true, value: { root: '/repo' } })
    runGit.mockResolvedValueOnce({ ok: false, code: 'git-failed', message: 'error: pathspec \'a.ts\' did not match' })
      .mockResolvedValueOnce({ ok: true, stdout: '' })
    await expect(collectGitDiscard('/ws', ['a.ts'])).resolves.toEqual({ ok: true, value: { root: '/repo' } })
    runGit.mockResolvedValueOnce({ ok: false, code: 'git-failed', message: 'locked' })
    await expect(collectGitDiscard('/ws', ['a.ts'])).resolves.toMatchObject({ ok: false })
    runGit
      .mockResolvedValueOnce({ ok: true, stdout: '' })
      .mockResolvedValueOnce({ ok: false, code: 'git-failed', message: 'clean' })
    await expect(collectGitDiscard('/ws', ['a.ts'])).resolves.toMatchObject({ ok: false })
  })
})

describe('collect git sync / branches / checkout', () => {
  it('fetches, pulls ff-only, and publishes a first push', async () => {
    runGit.mockResolvedValue({ ok: true, stdout: '' })
    await expect(collectGitSync('/ws', 'fetch')).resolves.toEqual({ ok: true, value: { root: '/repo' } })
    await expect(collectGitSync('/ws', 'pull')).resolves.toEqual({ ok: true, value: { root: '/repo' } })
    await expect(collectGitSync('/ws', 'push')).resolves.toEqual({ ok: true, value: { root: '/repo' } })
    runGit
      .mockResolvedValueOnce({ ok: false, code: 'git-failed', message: 'has no upstream branch' })
      .mockResolvedValueOnce({ ok: true, stdout: '' })
    await expect(collectGitSync('/ws', 'push')).resolves.toEqual({ ok: true, value: { root: '/repo' } })
    expect(runGit).toHaveBeenCalledWith(['-C', '/repo', 'push', '-u', 'origin', 'HEAD'], undefined, 120_000)
    runGit.mockResolvedValue({ ok: false, code: 'git-failed', message: 'auth' })
    await expect(collectGitSync('/ws', 'push')).resolves.toMatchObject({ ok: false })
    runGit.mockResolvedValue({ ok: false, code: 'git-failed', message: 'net' })
    await expect(collectGitSync('/ws', 'fetch')).resolves.toMatchObject({ ok: false })
  })

  it('lists branches and switches or creates one', async () => {
    expect(parseGitBranches('')).toEqual([])
    expect(parseGitBranches('main\0*\0origin/main\nfeat\0\0\n\n\0*\0\n')).toEqual([
      { name: 'main', current: true, upstream: 'origin/main' },
      { name: 'feat', current: false },
    ])
    expect(parseGitBranches('origin/main\0\0\norigin/HEAD\0\0\n', true)).toEqual([
      { name: 'origin/main', current: false, remote: true },
      { name: 'origin/HEAD', current: false, remote: true },
    ])
    expect(isGitRemoteSymbolicRef('HEAD')).toBe(true)
    expect(isGitRemoteSymbolicRef('origin/HEAD')).toBe(true)
    expect(isGitRemoteSymbolicRef('origin')).toBe(true)
    expect(isGitRemoteSymbolicRef('origin/dagen')).toBe(false)
    expect(isNoUpstreamPushFailure('fatal: The current branch has no upstream branch')).toBe(true)
    expect(isNoUpstreamPushFailure('auth failed')).toBe(false)
    runGit
      .mockResolvedValueOnce({ ok: true, stdout: 'main\0*\0\n' })
      .mockResolvedValueOnce({ ok: true, stdout: 'origin\0\0\norigin/HEAD\0\0\norigin/dagen\0\0\n' })
    await expect(collectGitBranches('/ws')).resolves.toEqual({
      ok: true,
      value: {
        root: '/repo',
        branches: [
          { name: 'main', current: true },
          { name: 'origin/dagen', current: false, remote: true },
        ],
      },
    })
    runGit
      .mockResolvedValueOnce({ ok: true, stdout: 'main\0*\0\n' })
      .mockResolvedValueOnce({ ok: false, code: 'git-failed', message: 'no remotes' })
    await expect(collectGitBranches('/ws')).resolves.toEqual({
      ok: true, value: { root: '/repo', branches: [{ name: 'main', current: true }] },
    })
    runGit.mockResolvedValue({ ok: false, code: 'git-failed', message: 'no' })
    await expect(collectGitBranches('/ws')).resolves.toMatchObject({ ok: false })
    runGit.mockResolvedValue({ ok: true, stdout: '' })
    await expect(collectGitCheckout('/ws', 'feat', false)).resolves.toEqual({
      ok: true, value: { root: '/repo', name: 'feat' },
    })
    expect(runGit).toHaveBeenCalledWith(['-C', '/repo', 'switch', '--', 'feat'], undefined)
    await expect(collectGitCheckout('/ws', 'new', true)).resolves.toEqual({
      ok: true, value: { root: '/repo', name: 'new' },
    })
    expect(runGit).toHaveBeenCalledWith(['-C', '/repo', 'switch', '-c', 'new'], undefined)
    runGit.mockResolvedValue({ ok: true, stdout: '' })
    await expect(collectGitCheckout('/ws', 'abcdef1', false, true)).resolves.toEqual({
      ok: true, value: { root: '/repo', name: 'abcdef1' },
    })
    expect(runGit).toHaveBeenCalledWith(['-C', '/repo', 'switch', '--detach', 'abcdef1'], undefined)
    await expect(collectGitCheckout('/ws', 'x', true, true)).resolves.toMatchObject({ ok: false })
    runGit.mockResolvedValue({ ok: false, code: 'git-failed', message: 'dirty' })
    await expect(collectGitCheckout('/ws', 'feat', false)).resolves.toMatchObject({ ok: false })
  })

  it('maps refnames and attaches HEAD', () => {
    expect(gitRefFromName('refs/heads/main')).toEqual({ kind: 'branch', name: 'main' })
    expect(gitRefFromName('refs/remotes/origin/main')).toEqual({ kind: 'remote', name: 'origin/main' })
    expect(gitRefFromName('refs/tags/v1')).toEqual({ kind: 'tag', name: 'v1' })
    expect(gitRefFromName('refs/stash')).toBeUndefined()
    const map = parseGitRefMap([
      'aaa\0refs/heads/main',
      'aaa\0refs/remotes/origin/main',
      'bbb\0refs/tags/v1',
      '',
      'ccc\0',
    ].join('\n'))
    expect(map.get('aaa')).toEqual([
      { kind: 'branch', name: 'main' },
      { kind: 'remote', name: 'origin/main' },
    ])
    const attached = applyGitRefs(
      [{ hash: 'aaa', subject: 's', author: 'A', timestamp: 1 }],
      map,
      'aaa',
      'main',
    )
    expect(attached[0]?.refs?.[0]).toEqual({ kind: 'head', name: 'HEAD' })
    const detached = applyGitRefs(
      [{ hash: 'ddd', subject: 's', author: 'A', timestamp: 1 }],
      new Map(),
      'ddd',
      'HEAD',
    )
    expect(detached[0]?.refs).toEqual([{ kind: 'head', name: 'HEAD' }])
    expect(applyGitRefs(
      [{ hash: 'zzz', subject: 's', author: 'A', timestamp: 1 }],
      new Map(),
      'aaa',
      'main',
    )[0]?.refs).toBeUndefined()
    expect(applyGitRefs(
      [{ hash: 'bbb', subject: 's', author: 'A', timestamp: 1 }],
      map,
      'aaa',
      'main',
    )[0]?.refs).toEqual([{ kind: 'tag', name: 'v1' }])
  })

  it('decorates log rows and keeps them when decorate fails', async () => {
    runGit
      .mockResolvedValueOnce({ ok: true, stdout: 'aaa\x1fs\x1fA\x1f1\n' })
      .mockResolvedValueOnce({ ok: true, stdout: 'aaa\0refs/heads/main\n' })
      .mockResolvedValueOnce({ ok: true, stdout: 'aaa\n' })
      .mockResolvedValueOnce({ ok: true, stdout: 'main\n' })
      .mockResolvedValueOnce({ ok: true, stdout: 'git@github.com:acme/app.git\n' })
    const decorated = await collectGitLog('/ws', 5)
    expect(decorated).toMatchObject({
      ok: true,
      value: [{
        hash: 'aaa',
        refs: [{ kind: 'head', name: 'HEAD' }, { kind: 'branch', name: 'main' }],
        originUrl: 'git@github.com:acme/app.git',
      }],
    })
    runGit
      .mockResolvedValueOnce({ ok: true, stdout: 'aaa\x1fs\x1fA\x1f1\n' })
      .mockResolvedValueOnce({ ok: false, code: 'git-failed', message: 'no refs' })
    const plain = await collectGitLog('/ws', 5)
    expect(plain.ok && plain.value[0]?.refs).toBeUndefined()
    runGit
      .mockResolvedValueOnce({ ok: true, stdout: 'aaa\x1fs\x1fA\x1f1\n' })
      .mockResolvedValueOnce({ ok: true, stdout: 'aaa\0refs/heads/main\n' })
      .mockResolvedValueOnce({ ok: false, code: 'git-failed', message: 'no head' })
      .mockResolvedValueOnce({ ok: true, stdout: '' })
    const noHead = await collectGitLog('/ws', 5)
    expect(noHead.ok && noHead.value[0]?.refs).toBeUndefined()
    expect(noHead.ok && noHead.value[0]?.originUrl).toBeUndefined()
    runGit
      .mockResolvedValueOnce({ ok: true, stdout: 'aaa\x1fs\x1fA\x1f1\n' })
      .mockResolvedValueOnce({ ok: true, stdout: 'aaa\0refs/heads/main\n' })
      .mockResolvedValueOnce({ ok: true, stdout: 'aaa\n' })
      .mockResolvedValueOnce({ ok: false, code: 'git-failed', message: 'no abbrev' })
      .mockResolvedValueOnce({ ok: false, code: 'git-failed', message: 'no origin' })
    const noAbbrev = await collectGitLog('/ws', 5)
    expect(noAbbrev.ok && noAbbrev.value[0]?.refs).toBeUndefined()
  })
})
