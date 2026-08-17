import { describe, expect, it } from 'vitest'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  classifyGitError,
  collectOpaqueSnap,
  defaultRunGit,
  readHeadText,
  readHeadTextForAbs,
  type GitRunner,
} from '../src/opaque-git.ts'
import { createNodeDisk } from '../src/index.ts'

describe('classifyGitError', () => {
  it('classifies abort, missing binary, missing repo, and other failures', () => {
    expect(classifyGitError(new Error('x'), true)).toEqual({
      ok: false, code: 'git-failed', message: 'git was aborted',
    })
    expect(classifyGitError({ code: 'ENOENT' }, false)).toEqual({
      ok: false, code: 'git-unavailable', message: 'git is not installed on this host',
    })
    expect(classifyGitError({ code: 128, stderr: 'fatal: not a git repository' }, false)).toMatchObject({
      ok: false, code: 'git-unavailable',
    })
    expect(classifyGitError({ message: 'not a git repository (or any of the parent directories)' }, false))
      .toMatchObject({ ok: false, code: 'git-unavailable' })
    expect(classifyGitError({ code: 128 }, false)).toEqual({
      ok: false, code: 'git-unavailable', message: 'not a git repository',
    })
    expect(classifyGitError({ stderr: 'boom' }, false)).toEqual({
      ok: false, code: 'git-failed', message: 'boom',
    })
    expect(classifyGitError({}, false)).toEqual({
      ok: false, code: 'git-failed', message: 'git status failed',
    })
    expect(classifyGitError('nope', false)).toEqual({
      ok: false, code: 'git-failed', message: 'git status failed',
    })
  })
})

describe('collectOpaqueSnap', () => {
  it('returns null when rev-parse or status fails or the root is empty', async () => {
    const disk = createNodeDisk()
    const fail: GitRunner = async () => ({ ok: false, code: 'git-unavailable', message: 'no' })
    expect(await collectOpaqueSnap('/tmp', disk, 100, fail)).toBeNull()

    let step = 0
    const emptyRoot: GitRunner = async () => {
      step += 1
      return step === 1 ? { ok: true, stdout: '  \n' } : { ok: true, stdout: '' }
    }
    expect(await collectOpaqueSnap('/tmp', disk, 100, emptyRoot)).toBeNull()

    step = 0
    const statusFail: GitRunner = async () => {
      step += 1
      return step === 1
        ? { ok: true, stdout: '/repo\n' }
        : { ok: false, code: 'git-failed', message: 'status' }
    }
    expect(await collectOpaqueSnap('/tmp', disk, 100, statusFail)).toBeNull()
  })

  it('reads bodies, marks oversize, and leaves missing files hash-null', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'dsh-opaque-snap-'))
    const small = join(workspace, 'small.txt')
    const big = join(workspace, 'big.txt')
    await writeFile(small, 'hi\n', 'utf8')
    await writeFile(big, '1234567890', 'utf8')
    const run: GitRunner = async (args) => {
      if (args.includes('rev-parse')) return { ok: true, stdout: `${workspace}\n` }
      return {
        ok: true,
        stdout: ['?? small.txt', '?? big.txt', ' D missing.txt'].join('\n'),
      }
    }
    const snap = await collectOpaqueSnap(workspace, createNodeDisk(), 5, run)
    expect(snap?.root).toBe(workspace)
    expect(snap?.files.get(small)).toMatchObject({ code: 'untracked', text: 'hi\n' })
    expect(snap?.files.get(big)).toMatchObject({ code: 'untracked', hash: 'oversize', text: null })
    expect(snap?.files.get(join(workspace, 'missing.txt'))).toMatchObject({
      code: 'deleted', hash: null, text: null,
    })
  })

  it('treats a readable-size path whose read fails as hash-null', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'dsh-opaque-unreadable-'))
    const run: GitRunner = async (args) => {
      if (args.includes('rev-parse')) return { ok: true, stdout: `${workspace}\n` }
      return { ok: true, stdout: '?? ghost.txt' }
    }
    const disk = {
      ...createNodeDisk(),
      async sizeOf() { return 4 },
      async readText() { return null },
    }
    const snap = await collectOpaqueSnap(workspace, disk, 100, run)
    expect(snap?.files.get(join(workspace, 'ghost.txt'))).toMatchObject({
      hash: null, text: null,
    })
  })

  it('readHeadText returns stdout or null', async () => {
    const ok: GitRunner = async () => ({ ok: true, stdout: 'head\n' })
    const fail: GitRunner = async () => ({ ok: false, code: 'git-failed', message: 'no' })
    expect(await readHeadText('/repo', 'a\\b.txt', ok)).toBe('head\n')
    expect(await readHeadText('/repo', 'a.txt', fail)).toBeNull()
  })

  it('readHeadTextForAbs follows the containing repo and rejects misses', async () => {
    const ok: GitRunner = async (args) => {
      if (args.includes('rev-parse')) return { ok: true, stdout: '/repo\n' }
      return { ok: true, stdout: 'old\n' }
    }
    expect(await readHeadTextForAbs('/repo/a.txt', ok)).toBe('old\n')
    const fail: GitRunner = async () => ({ ok: false, code: 'git-unavailable', message: 'no' })
    expect(await readHeadTextForAbs('/repo/a.txt', fail)).toBeNull()
    const empty: GitRunner = async () => ({ ok: true, stdout: '  \n' })
    expect(await readHeadTextForAbs('/repo/a.txt', empty)).toBeNull()
    const outside: GitRunner = async (args) => {
      if (args.includes('rev-parse')) return { ok: true, stdout: '/repo\n' }
      return { ok: true, stdout: 'x' }
    }
    expect(await readHeadTextForAbs('/other/a.txt', outside)).toBeNull()
    expect(await readHeadTextForAbs(join(tmpdir(), 'dsh-no-abs-head', 'a.txt'))).toBeNull()
  })
})

describe('defaultRunGit', () => {
  it('returns stdout from a real git invocation and classifies a missing repo', async () => {
    const version = await defaultRunGit(['--version'])
    expect(version.ok).toBe(true)
    const missing = await defaultRunGit(['-C', join(tmpdir(), 'dsh-no-git-dir-missing'), 'status'])
    expect(missing.ok).toBe(false)
  })
})
