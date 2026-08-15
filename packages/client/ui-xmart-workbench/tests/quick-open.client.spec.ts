import { describe, expect, it, vi } from 'vitest'
import type { FileListing } from '@deepseek-ai/dsh-client-runtime/client'
import {
  collectQuickOpenFiles, filterQuickOpenFiles, QUICK_OPEN_FILE_CAP, relativeQuickOpenPath,
} from '../src/client/quick-open.ts'

function listing(path: string, entries: FileListing['entries']): FileListing {
  return { path, entries, truncated: false }
}

describe('relativeQuickOpenPath', () => {
  it('strips the root and normalizes slashes', () => {
    expect(relativeQuickOpenPath('D:\\ws', 'D:\\ws\\src\\A.java')).toBe('src/A.java')
    expect(relativeQuickOpenPath('/ws/', '/ws/a.ts')).toBe('a.ts')
    expect(relativeQuickOpenPath('/other', '/ws/a.ts')).toBe('/ws/a.ts')
  })
})

describe('filterQuickOpenFiles', () => {
  const files = [
    { path: '/ws/UserService.java', name: 'UserService.java', rel: 'UserService.java' },
    { path: '/ws/src/App.vue', name: 'App.vue', rel: 'src/App.vue' },
    { path: '/ws/src/util.ts', name: 'util.ts', rel: 'src/util.ts' },
  ]

  it('ranks exact / prefix / name / path matches and drops misses', () => {
    expect(filterQuickOpenFiles(files, '')).toEqual(files)
    expect(filterQuickOpenFiles(files, 'UserService.java').map(row => row.name)).toEqual(['UserService.java'])
    expect(filterQuickOpenFiles(files, 'user').map(row => row.name)).toEqual(['UserService.java'])
    expect(filterQuickOpenFiles(files, 'vue').map(row => row.name)).toEqual(['App.vue'])
    expect(filterQuickOpenFiles(files, 'src/').map(row => row.name)).toEqual(['App.vue', 'util.ts'])
    expect(filterQuickOpenFiles(files, 'nope')).toEqual([])
    const many = Array.from({ length: 90 }, (_, i) => ({
      path: `/ws/${i}.ts`, name: `${i}.ts`, rel: `${i}.ts`,
    }))
    expect(filterQuickOpenFiles(many, '')).toHaveLength(80)
  })
})

describe('collectQuickOpenFiles', () => {
  it('walks files, skips build trees, and swallows a failed listing', async () => {
    const listEntries = vi.fn(async (path: string): Promise<FileListing> => {
      if (path === '/ws') {
        return listing('/ws', [
          { name: 'src', path: '/ws/src', kind: 'directory', hidden: false },
          { name: 'target', path: '/ws/target', kind: 'directory', hidden: false },
          { name: '.git', path: '/ws/.git', kind: 'directory', hidden: true },
          { name: 'README.md', path: '/ws/README.md', kind: 'file', hidden: false },
        ])
      }
      if (path === '/ws/src') {
        return listing('/ws/src', [
          { name: 'A.java', path: '/ws/src/A.java', kind: 'file', hidden: false },
        ])
      }
      throw new Error('gone')
    })
    expect(await collectQuickOpenFiles(
      [{ path: '/ws', title: 'ws' }, { path: '', title: 'x' }, { path: '/missing', title: 'm' }],
      listEntries,
    )).toEqual([
      { path: '/ws/README.md', name: 'README.md', rel: 'README.md' },
      { path: '/ws/src/A.java', name: 'A.java', rel: 'src/A.java' },
    ])
    expect(listEntries).not.toHaveBeenCalledWith('/ws/target', expect.anything())
  })

  it('stops at the file cap and honors abort', async () => {
    const listEntries = vi.fn(async (path: string): Promise<FileListing> => {
      if (path === '/big') {
        return listing('/big', Array.from({ length: QUICK_OPEN_FILE_CAP + 2 }, (_, i) => ({
          name: `f${i}.ts`, path: `/big/f${i}.ts`, kind: 'file' as const, hidden: false,
        })))
      }
      return listing(path, [])
    })
    const files = await collectQuickOpenFiles([{ path: '/big', title: 'b' }], listEntries)
    expect(files).toHaveLength(QUICK_OPEN_FILE_CAP)
    const controller = new AbortController()
    controller.abort()
    expect(await collectQuickOpenFiles([{ path: '/big', title: 'b' }], listEntries, controller.signal)).toEqual([])
  })

  it('stops walking further roots and sibling dirs once the cap is full', async () => {
    const listEntries = vi.fn(async (path: string): Promise<FileListing> => {
      if (path === '/a') {
        return listing('/a', [
          { name: 'keep', path: '/a/keep', kind: 'directory', hidden: false },
          { name: 'skip', path: '/a/skip', kind: 'directory', hidden: false },
        ])
      }
      if (path === '/a/keep') {
        return listing('/a/keep', Array.from({ length: QUICK_OPEN_FILE_CAP }, (_, i) => ({
          name: `f${i}.ts`, path: `/a/keep/f${i}.ts`, kind: 'file' as const, hidden: false,
        })))
      }
      return listing(path, [
        { name: 'extra.ts', path: `${path}/extra.ts`, kind: 'file', hidden: false },
      ])
    })
    const files = await collectQuickOpenFiles(
      [{ path: '/a', title: 'a' }, { path: '/b', title: 'b' }],
      listEntries,
    )
    expect(files).toHaveLength(QUICK_OPEN_FILE_CAP)
    expect(listEntries).not.toHaveBeenCalledWith('/a/skip', expect.anything())
    expect(listEntries).not.toHaveBeenCalledWith('/b', expect.anything())
  })
})
