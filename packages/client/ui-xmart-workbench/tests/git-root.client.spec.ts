import { describe, expect, it } from 'vitest'
import { GitAccessError, type FileListing, type GitStatus } from '@deepseek-ai/dsh-client-runtime/client'
import {
  gitErrorCode, gitErrorMessage, isGitUnavailable, probeGitRoots,
  readGitSnapshot, visibleChildDirectories,
} from '../src/client/git-root.ts'

const status = (root: string): GitStatus => ({
  root, branch: 'main', ahead: 0, behind: 0, detached: false, changes: [],
})

const unavailable = new GitAccessError({
  code: 'git-unavailable', message: 'not a git repository',
} as never)
const failed = new GitAccessError({ code: 'git-failed', message: 'lock' } as never)

describe('git-root helpers', () => {
  it('classifies GitAccessError and ignores plain throws', () => {
    expect(gitErrorCode(unavailable)).toBe('git-unavailable')
    expect(isGitUnavailable(unavailable)).toBe(true)
    expect(isGitUnavailable(failed)).toBe(false)
    expect(isGitUnavailable(new Error('no'))).toBe(false)
    expect(gitErrorMessage(failed)).toBe('lock')
    expect(gitErrorMessage(new Error('no'))).toBeUndefined()
    expect(gitErrorCode(new Error('no'))).toBeUndefined()
  })

  it('keeps visible child directories and drops files and hidden folders', () => {
    const listing: FileListing = {
      path: '/ws',
      truncated: false,
      entries: [
        { name: 'backend', path: '/ws/backend', kind: 'directory', hidden: false },
        { name: 'web', path: '/ws/web', kind: 'directory', hidden: false },
        { name: '.cursor', path: '/ws/.cursor', kind: 'directory', hidden: true },
        { name: 'readme.md', path: '/ws/readme.md', kind: 'file', hidden: false },
      ],
    }
    expect(visibleChildDirectories(listing)).toEqual(['/ws/backend', '/ws/web'])
  })

  it('reads status even when log throws or is not an array', async () => {
    await expect(readGitSnapshot(
      '/ws',
      async () => status('/ws'),
      async () => { throw new Error('no log') },
    )).resolves.toEqual({ ok: true, status: status('/ws'), log: [] })
    await expect(readGitSnapshot(
      '/ws',
      async () => status('/ws'),
      async () => undefined as never,
    )).resolves.toEqual({ ok: true, status: status('/ws'), log: [] })
    await expect(readGitSnapshot(
      '/ws',
      async () => status('/ws'),
      async () => [{ hash: 'abc', subject: 's', author: 'a', timestamp: 1 }],
    )).resolves.toMatchObject({ ok: true, log: [{ hash: 'abc' }] })
  })

  it('classifies status failures', async () => {
    await expect(readGitSnapshot(
      '/ws',
      async () => { throw unavailable },
      async () => [],
    )).resolves.toEqual({ ok: false, unavailable: true, message: 'not a git repository' })
    await expect(readGitSnapshot(
      '/ws',
      async () => { throw failed },
      async () => [],
    )).resolves.toEqual({ ok: false, unavailable: false, message: 'lock' })
    await expect(readGitSnapshot(
      '/ws',
      async () => { throw new Error('plain') },
      async () => [],
    )).resolves.toEqual({ ok: false, unavailable: false, message: undefined })
  })

  it('probes children and skips failures', async () => {
    await expect(probeGitRoots(
      ['/ws/backend', '/ws/skip', '/ws/web'],
      async (path) => {
        if (path === '/ws/skip') throw unavailable
        return status(path)
      },
    )).resolves.toEqual(['/ws/backend', '/ws/web'])
    await expect(probeGitRoots(['/ws/dup', '/ws/dup'], async () => status('/ws/dup')))
      .resolves.toEqual(['/ws/dup'])
  })
})
