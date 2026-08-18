import { describe, expect, it } from 'vitest'
import type { FileSearchHit } from '@deepseek-ai/dsh-client-runtime/client'
import {
  classifySearchFailure, createWorkbenchSearchStore, EMPTY_SEARCH_STATE, formatSearchCount,
  groupSearchHits, revealTarget, searchHitKey, splitSearchLine, stepSearchHit, visibleSearchHits,
} from '../src/client/search-store.ts'

const hit = (
  path: string,
  line: number,
  text = 'const js = 1',
  spans: { start: number; end: number }[] = [{ start: 6, end: 8 }],
): FileSearchHit => ({ path, line, text, spans })

describe('createWorkbenchSearchStore', () => {
  it('returns the empty sentinel until a session is written, then notifies subscribers', () => {
    const store = createWorkbenchSearchStore()
    expect(store.stateOf('s1')).toBe(EMPTY_SEARCH_STATE)
    const seen: string[] = []
    const off = store.subscribe(() => { seen.push(store.stateOf('s1').query) })
    store.update('s1', { query: 'js' })
    expect(store.stateOf('s1')).toMatchObject({ query: 'js', status: 'idle' })
    expect(store.stateOf('s2')).toBe(EMPTY_SEARCH_STATE)
    store.update('s1', { status: 'done' })
    expect(seen).toEqual(['js', 'js'])
    off()
    store.update('s1', { query: 'later' })
    expect(seen).toEqual(['js', 'js'])
  })
})

describe('groupSearchHits', () => {
  it('groups in first-seen order and relativizes the parent against explorer roots', () => {
    const groups = groupSearchHits([
      hit('/ws/src/a.ts', 1),
      hit('/ws/src/a.ts', 4),
      hit('/other/b.ts', 2),
    ], [{ path: '/ws', title: 'ws' }])
    expect(groups).toEqual([
      {
        path: '/ws/src/a.ts', name: 'a.ts', dir: 'src',
        hits: [hit('/ws/src/a.ts', 1), hit('/ws/src/a.ts', 4)],
      },
      {
        path: '/other/b.ts', name: 'b.ts', dir: '/other',
        hits: [hit('/other/b.ts', 2)],
      },
    ])
    expect(groupSearchHits([hit('/ws/a.ts', 1)], [{ path: '/ws', title: 'ws' }])[0]?.dir).toBe('')
  })
})

describe('splitSearchLine', () => {
  it('merges overlapping spans, clamps bounds, and keeps the unmatched tails', () => {
    expect(splitSearchLine('abc', [])).toEqual([{ text: 'abc', hit: false }])
    expect(splitSearchLine('abcdef', [
      { start: 4, end: 6 },
      { start: 1, end: 3 },
      { start: 2, end: 5 },
      { start: 8, end: 9 },
      { start: 3, end: 3 },
    ])).toEqual([
      { text: 'a', hit: false },
      { text: 'bcdef', hit: true },
    ])
  })
})

describe('revealTarget', () => {
  it('uses the first span and a zero-based line, defaulting the column to 0', () => {
    expect(revealTarget(hit('/ws/a.ts', 3))).toEqual({ line: 2, character: 6, end: 8 })
    expect(revealTarget(hit('/ws/a.ts', 0, 'x', []))).toEqual({ line: 0, character: 0 })
  })
})

describe('classifySearchFailure', () => {
  it('splits unavailable, glob, and regex failures', () => {
    expect(classifySearchFailure({ rpcError: { code: 'search-invalid' } })).toBe('invalid')
    expect(classifySearchFailure({
      rpcError: { code: 'search-invalid', message: 'error parsing glob' },
    })).toBe('badGlob')
    expect(classifySearchFailure({ rpcError: { code: 'search-unavailable' } })).toBe('unavailable')
    expect(classifySearchFailure({ rpcError: { code: 'search-failed' } })).toBe('failed')
    expect(classifySearchFailure(new Error('boom'))).toBe('failed')
    expect(classifySearchFailure(null)).toBe('failed')
  })
})

describe('search hit keys', () => {
  it('walks visible hits and wraps at the ends', () => {
    const a = hit('/ws/a.ts', 1)
    const b = hit('/ws/a.ts', 4)
    const c = hit('/ws/b.ts', 2)
    const groups = groupSearchHits([a, b, c], [{ path: '/ws', title: 'ws' }])
    expect(searchHitKey(a)).toBe('/ws/a.ts\n1')
    expect(visibleSearchHits(groups, { '/ws/a.ts': true })).toEqual([c])
    expect(stepSearchHit([a, b, c], null, 1)).toBe(searchHitKey(a))
    expect(stepSearchHit([a, b, c], null, -1)).toBe(searchHitKey(c))
    expect(stepSearchHit([a, b, c], searchHitKey(a), 1)).toBe(searchHitKey(b))
    expect(stepSearchHit([a, b, c], searchHitKey(c), 1)).toBe(searchHitKey(c))
    expect(stepSearchHit([a, b, c], searchHitKey(a), -1)).toBe(searchHitKey(a))
    expect(stepSearchHit([], null, 1)).toBeNull()
  })
})

describe('formatSearchCount', () => {
  it('substitutes {n} and the optional {m}', () => {
    expect(formatSearchCount('{n} hits', 3)).toBe('3 hits')
    expect(formatSearchCount('{n} in {m}', 3, 2)).toBe('3 in 2')
  })
})
