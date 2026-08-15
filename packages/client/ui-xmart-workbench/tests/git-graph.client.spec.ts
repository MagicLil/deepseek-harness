import { describe, expect, it } from 'vitest'
import { gitLaneClass, gitRefClass, layoutGitGraph } from '../src/client/git-graph.ts'

describe('layoutGitGraph', () => {
  it('returns an empty list', () => {
    expect(layoutGitGraph([])).toEqual([])
  })

  it('draws a single spine when parents are omitted', () => {
    const rows = layoutGitGraph([
      { hash: 'c', subject: 'three', author: 'A', timestamp: 3 },
      { hash: 'b', subject: 'two', author: 'A', timestamp: 2 },
      { hash: 'a', subject: 'one', author: 'A', timestamp: 1 },
    ])
    expect(rows.map(row => row.lane)).toEqual([0, 0, 0])
    expect(rows[0]?.rails).toEqual([0])
    expect(rows[2]?.subject).toBe('one')
  })

  it('opens a second lane for a merge parent', () => {
    const rows = layoutGitGraph([
      { hash: 'm', subject: 'merge', author: 'A', timestamp: 3, parents: ['b', 's'] },
      { hash: 's', subject: 'side', author: 'A', timestamp: 2, parents: ['a'] },
      { hash: 'b', subject: 'base', author: 'A', timestamp: 1, parents: ['a'] },
      { hash: 'a', subject: 'root', author: 'A', timestamp: 0, parents: [] },
    ])
    expect(rows[0]?.lane).toBe(0)
    expect(rows[0]?.railCount).toBeGreaterThanOrEqual(2)
    expect(rows[0]?.merges.length).toBeGreaterThan(0)
    expect(rows.some(row => row.lane === 1)).toBe(true)
    expect(rows[3]?.lane).toBe(0)
    expect(rows[0]?.refs).toEqual([])
  })

  it('copies refs onto the painted row', () => {
    const rows = layoutGitGraph([
      {
        hash: 'c', subject: 'tip', author: 'A', timestamp: 1,
        body: 'why', files: 2, insertions: 3, deletions: 1,
        originUrl: 'git@github.com:acme/app.git',
        refs: [{ kind: 'head', name: 'HEAD' }, { kind: 'branch', name: 'main' }],
      },
    ])
    expect(rows[0]?.refs).toEqual([
      { kind: 'head', name: 'HEAD' },
      { kind: 'branch', name: 'main' },
    ])
    expect(rows[0]).toMatchObject({
      body: 'why', files: 2, insertions: 3, deletions: 1,
      originUrl: 'git@github.com:acme/app.git',
    })
  })

  it('skips a hole in the input list', () => {
    const sparse: Array<{ hash: string; subject: string; author: string; timestamp: number }> = []
    sparse[0] = { hash: 'c', subject: 'c', author: 'A', timestamp: 2 }
    sparse[2] = { hash: 'a', subject: 'a', author: 'A', timestamp: 1 }
    expect(layoutGitGraph(sparse).map(row => row.hash)).toEqual(['c', 'a'])
  })

  it('reuses a freed lane for a second parent and skips one already on a rail', () => {
    const rows = layoutGitGraph([
      { hash: 't1', subject: 't1', author: 'A', timestamp: 6, parents: ['a'] },
      { hash: 't2', subject: 't2', author: 'A', timestamp: 5, parents: ['b'] },
      { hash: 'a', subject: 'a', author: 'A', timestamp: 4, parents: [] },
      { hash: 'b', subject: 'b', author: 'A', timestamp: 3, parents: [] },
      { hash: 'z', subject: 'z', author: 'A', timestamp: 2, parents: ['p', 'q'] },
      { hash: 'm', subject: 'm', author: 'A', timestamp: 1, parents: ['p', 'q'] },
    ])
    expect(rows).toHaveLength(6)
    expect(rows.some(row => row.railCount >= 2)).toBe(true)
  })

  it('cycles lane color keys', () => {
    expect(gitLaneClass(0)).toBe('lane0')
    expect(gitLaneClass(1)).toBe('lane1')
    expect(gitLaneClass(2)).toBe('lane2')
    expect(gitLaneClass(3)).toBe('lane3')
    expect(gitLaneClass(4)).toBe('lane4')
    expect(gitLaneClass(5)).toBe('lane5')
    expect(gitLaneClass(-1)).toBe('lane5')
    expect(gitRefClass('head')).toBe('refHead')
    expect(gitRefClass('branch')).toBe('refBranch')
    expect(gitRefClass('tag')).toBe('refTag')
    expect(gitRefClass('remote')).toBe('refRemote')
  })
})
