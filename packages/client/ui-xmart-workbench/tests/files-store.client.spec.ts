// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createWorkbenchFilesStore, FILES_PERSIST, sanitizeFilesState } from '../src/client/files-store.ts'

beforeEach(() => { localStorage.clear() })

describe('sanitizeFilesState', () => {
  it('drops garbage and keeps well-formed maps', () => {
    expect(sanitizeFilesState(null).drafts).toEqual({})
    expect(sanitizeFilesState('x').expanded).toEqual({})
    expect(sanitizeFilesState({ drafts: null, expanded: 1 }).drafts).toEqual({})
    expect(sanitizeFilesState({
      expanded: { s1: { '/a': true, '/b': false, '/c': 1 }, bad: 'no' },
      drafts: { '/a': 'hi', '/b': 2 },
      refreshNonce: 9,
      reloadAt: { '/a': 3 },
    })).toEqual({
      expanded: { s1: { '/a': true } },
      drafts: { '/a': 'hi' },
      refreshNonce: 0,
      reloadAt: {},
    })
  })
})

describe('createWorkbenchFilesStore', () => {
  it('mutates expanded, drafts, refresh, and reload tokens', () => {
    const files = createWorkbenchFilesStore()
    expect(files.expandedOf('s1')).toEqual({})
    files.setExpanded('s1', '/ws/src', true)
    files.setExpanded('s1', '/ws/lib', true)
    expect(files.expandedOf('s1')).toEqual({ '/ws/src': true, '/ws/lib': true })
    files.setExpanded('s1', '/ws/src', false)
    expect(files.expandedOf('s1')).toEqual({ '/ws/lib': true })
    files.setExpanded('s1', '/ws/lib', false)
    expect(files.expandedOf('s1')).toEqual({})
    files.setDraft('/a.ts', 'x')
    files.setDraft('/b.ts', 'y')
    expect(files.draftOf('/a.ts')).toBe('x')
    files.setDraft('/a.ts', undefined)
    expect(files.draftOf('/a.ts')).toBeUndefined()
    expect(files.draftOf('/b.ts')).toBe('y')
    files.setDraft('/b.ts', undefined)
    expect(files.draftOf('/b.ts')).toBeUndefined()
    const n = files.getSnapshot().refreshNonce
    files.bumpRefresh()
    expect(files.getSnapshot().refreshNonce).toBe(n + 1)
    files.markReload([])
    expect(files.reloadToken('/a.ts')).toBe(0)
    files.markReload(['/a.ts', '/a.ts'])
    expect(files.reloadToken('/a.ts')).toBe(1)
    const seen = { n: 0 }
    const off = files.subscribe(() => { seen.n += 1 })
    files.bumpRefresh()
    expect(seen.n).toBeGreaterThan(0)
    off()
  })

  it('restores sanitized persist', () => {
    localStorage.setItem(FILES_PERSIST, JSON.stringify({
      expanded: { s1: { '/a': true } }, drafts: { '/a': 'z' }, refreshNonce: 4, reloadAt: { '/a': 2 },
    }))
    const files = createWorkbenchFilesStore()
    expect(files.expandedOf('s1')).toEqual({ '/a': true })
    expect(files.draftOf('/a')).toBe('z')
    expect(files.getSnapshot().refreshNonce).toBe(0)
    expect(files.reloadToken('/a')).toBe(0)
  })
})
