import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  deleteEntryOnDisk, isPlainSegment, pathsAreSameEntry, renameEntryOnDisk, type EntryFs,
} from '../src/entry-ops.ts'

const fileA = join('/ws', 'a.ts')
const fileB = join('/ws', 'b.ts')
const note = join('/ws', 'Note.txt')
const noteLower = join('/ws', 'note.txt')

function failingStat(code: string): EntryFs {
  return {
    stat: async () => {
      const error = new Error('stat failed') as NodeJS.ErrnoException
      error.code = code
      throw error
    },
    rename: async () => {},
    rm: async () => {},
  }
}

describe('pathsAreSameEntry', () => {
  it('is exact on posix and case-insensitive on win32', () => {
    expect(pathsAreSameEntry('/ws/a', '/ws/a')).toBe(true)
    expect(pathsAreSameEntry('/ws/a', '/ws/a', 'linux')).toBe(true)
    expect(pathsAreSameEntry('/ws/A', '/ws/a', 'linux')).toBe(false)
    expect(pathsAreSameEntry('/ws/Note.txt', '/ws/note.txt', 'win32')).toBe(true)
    expect(pathsAreSameEntry('/ws/a', '/ws/b', 'win32')).toBe(false)
  })
})

describe('isPlainSegment', () => {
  it('accepts one basename and rejects traversal', () => {
    expect(isPlainSegment('a.ts')).toBe(true)
    expect(isPlainSegment('  note  ')).toBe(true)
    expect(isPlainSegment('')).toBe(false)
    expect(isPlainSegment('.')).toBe(false)
    expect(isPlainSegment('..')).toBe(false)
    expect(isPlainSegment('a/b')).toBe(false)
    expect(isPlainSegment('a\\b')).toBe(false)
  })
})

function destMissing(from: string): EntryFs {
  return {
    stat: async (path) => {
      if (path === from) return {}
      const error = new Error('missing') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      throw error
    },
    rename: async () => {},
    rm: async () => {},
  }
}

describe('renameEntryOnDisk', () => {
  it('rejects a non-segment name without touching disk', async () => {
    const result = await renameEntryOnDisk(fileA, '../x', failingStat('ENOENT'))
    expect(result).toMatchObject({ ok: false, code: 'file-rename-failed', path: fileA })
  })

  it('maps a missing source to unreadable', async () => {
    const result = await renameEntryOnDisk(fileA, 'b.ts', failingStat('ENOENT'))
    expect(result).toMatchObject({ ok: false, code: 'file-unreadable', path: fileA })
  })

  it('returns the same path when the name is unchanged', async () => {
    const calls: string[] = []
    const io: EntryFs = {
      stat: async () => ({}),
      rename: async (from, to) => { calls.push(`${from}->${to}`) },
      rm: async () => {},
    }
    const result = await renameEntryOnDisk(fileA, 'a.ts', io)
    expect(result).toEqual({ ok: true, path: fileA })
    expect(calls).toEqual([])
  })

  it('renames when the destination is free', async () => {
    const result = await renameEntryOnDisk(fileA, 'b.ts', destMissing(fileA))
    expect(result).toEqual({ ok: true, path: fileB })
  })

  it('refuses a different existing destination', async () => {
    const io: EntryFs = {
      stat: async () => ({}),
      rename: async () => {},
      rm: async () => {},
    }
    const result = await renameEntryOnDisk(fileA, 'b.ts', io)
    expect(result).toMatchObject({ ok: false, code: 'file-exists', path: fileB })
  })

  it('maps a dest stat that is not ENOENT to rename-failed', async () => {
    const io: EntryFs = {
      stat: async (path) => {
        if (path === fileA) return {}
        const error = new Error('eacces') as NodeJS.ErrnoException
        error.code = 'EACCES'
        throw error
      },
      rename: async () => {},
      rm: async () => {},
    }
    const result = await renameEntryOnDisk(fileA, 'b.ts', io)
    expect(result).toMatchObject({ ok: false, code: 'file-rename-failed' })
  })

  it('allows a case-only rename when the dest is the same entry', async () => {
    const calls: string[] = []
    const io: EntryFs = {
      stat: async () => ({}),
      rename: async (from, to) => { calls.push(`${from}->${to}`) },
      rm: async () => {},
      sameEntry: (left, right) => left.toLowerCase() === right.toLowerCase(),
    }
    const result = await renameEntryOnDisk(note, 'note.txt', io)
    expect(result).toEqual({ ok: true, path: noteLower })
    expect(calls).toEqual([`${note}->${noteLower}`])
  })

  it('maps rename() failure', async () => {
    const io: EntryFs = {
      stat: async (path) => {
        if (path === fileA) return {}
        const error = new Error('missing') as NodeJS.ErrnoException
        error.code = 'ENOENT'
        throw error
      },
      rename: async () => { throw new Error('busy') },
      rm: async () => {},
    }
    const result = await renameEntryOnDisk(fileA, 'b.ts', io)
    expect(result).toMatchObject({ ok: false, code: 'file-rename-failed', path: fileA })
  })
})

describe('deleteEntryOnDisk', () => {
  it('maps a missing path to unreadable', async () => {
    const result = await deleteEntryOnDisk(fileA, failingStat('ENOENT'))
    expect(result).toMatchObject({ ok: false, code: 'file-unreadable', path: fileA })
  })

  it('removes a path after a successful stat', async () => {
    const calls: string[] = []
    const io: EntryFs = {
      stat: async () => ({}),
      rename: async () => {},
      rm: async (path) => { calls.push(path) },
    }
    const result = await deleteEntryOnDisk(fileA, io)
    expect(result).toEqual({ ok: true, path: fileA })
    expect(calls).toEqual([fileA])
  })

  it('maps rm() failure after a successful stat', async () => {
    const io: EntryFs = {
      stat: async () => ({}),
      rename: async () => {},
      rm: async () => { throw 'blocked' },
    }
    const result = await deleteEntryOnDisk(fileA, io)
    expect(result).toMatchObject({ ok: false, code: 'file-delete-failed', path: fileA })
  })
})
