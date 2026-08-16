import { describe, expect, it, vi } from 'vitest'
import { GitAccessError, type FileListing, type GitStatus } from '@deepseek-ai/dsh-client-runtime/client'
import {
  discoverGitRoots, gitErrorCode, gitErrorMessage, gitRootKey, isGitUnavailable,
  probeGitRoots, readGitSnapshot, uniqueGitPaths, visibleChildDirectories,
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
    const gitLog = vi.fn(async () => [{ hash: 'abc', subject: 's', author: 'a', timestamp: 1 }])
    await expect(readGitSnapshot(
      '/ws',
      async () => status('/ws'),
      gitLog,
    )).resolves.toMatchObject({ ok: true, log: [{ hash: 'abc' }] })
    expect(gitLog).toHaveBeenCalledWith('/ws', 80)
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

  it('collapses Windows and POSIX spellings of the same folder', () => {
    expect(gitRootKey('D:\\code\\deepseek-harness\\')).toBe('d:/code/deepseek-harness')
    expect(uniqueGitPaths([
      'D:\\code\\deepseek-harness',
      'D:/code/deepseek-harness/',
      'D:\\code\\dsh-cursor-acp',
      '',
      undefined,
    ])).toEqual(['D:\\code\\deepseek-harness', 'D:\\code\\dsh-cursor-acp'])
  })

  it('discovers a sibling repo under a registered parent that is not a work tree', async () => {
    const listing: FileListing = {
      path: '/code',
      truncated: false,
      entries: [
        { name: 'deepseek-harness', path: '/code/deepseek-harness', kind: 'directory', hidden: false },
        { name: 'dsh-cursor-acp', path: '/code/dsh-cursor-acp', kind: 'directory', hidden: false },
      ],
    }
    await expect(discoverGitRoots(
      '/code/deepseek-harness',
      ['/code/deepseek-harness', '/code'],
      async (path) => {
        if (path === '/code') throw unavailable
        return status(path)
      },
      async () => listing,
    )).resolves.toEqual(['/code/deepseek-harness', '/code/dsh-cursor-acp'])
  })

  it('does not treat a git-failed seed as a parent folder', async () => {
    const listEntries = vi.fn(async () => ({
      path: '/ws', truncated: false, entries: [],
    }))
    await expect(discoverGitRoots(
      '/ws',
      ['/other'],
      async (path) => {
        if (path === '/other') throw failed
        return status(path)
      },
      listEntries,
    )).resolves.toEqual(['/ws'])
    expect(listEntries).not.toHaveBeenCalled()
  })

  it('skips a parent listing that throws or is aborted', async () => {
    const listEntries = vi.fn(async () => { throw new Error('no list') })
    await expect(discoverGitRoots(
      undefined,
      ['/parent'],
      async () => { throw unavailable },
      listEntries,
    )).resolves.toEqual([])
    expect(listEntries).toHaveBeenCalledOnce()
    const controller = new AbortController()
    const abortedList = vi.fn(async () => ({ path: '/parent', truncated: false, entries: [] }))
    await expect(discoverGitRoots(
      '/parent',
      [],
      async () => {
        controller.abort()
        throw unavailable
      },
      abortedList,
      controller.signal,
    )).resolves.toEqual([])
    expect(abortedList).not.toHaveBeenCalled()
  })
})
