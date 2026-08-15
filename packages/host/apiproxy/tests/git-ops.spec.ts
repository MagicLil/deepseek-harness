import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  collectGitCommit, collectGitDiff, collectGitDiscard, collectGitLog,
  collectGitStage, collectGitUnstage, diffArgs, isUntrackedRestoreFailure, parseGitLog,
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
  it('builds worktree and staged argv', () => {
    expect(diffArgs('/repo', 'worktree', undefined)).toEqual(['-C', '/repo', 'diff', '--'])
    expect(diffArgs('/repo', 'staged', 'a.ts')).toEqual(['-C', '/repo', 'diff', '--cached', '--', 'a.ts'])
  })

  it('parses log rows and skips empties', () => {
    expect(parseGitLog('')).toEqual([])
    expect(parseGitLog('\n')).toEqual([])
    expect(parseGitLog([
      'abc\x1fsubject\x1fAnn\x1f10',
      '\x1fnohash\x1fX\x1f1',
      'def\x1fonly',
    ].join('\n'))).toEqual([
      { hash: 'abc', subject: 'subject', author: 'Ann', timestamp: 10 },
      { hash: 'def', subject: 'only', author: '', timestamp: 0 },
    ])
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
  })

  it('collects a worktree diff and a staged file diff', async () => {
    runGit.mockResolvedValue({ ok: true, stdout: 'diff --git a/a.ts' })
    await expect(collectGitDiff('/ws', 'worktree', undefined)).resolves.toEqual({
      ok: true, value: { root: '/repo', side: 'worktree', text: 'diff --git a/a.ts' },
    })
    runGit.mockResolvedValue({ ok: false, code: 'git-failed', message: 'boom' })
    await expect(collectGitDiff('/ws', 'staged', 'a.ts')).resolves.toMatchObject({ ok: false })
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
