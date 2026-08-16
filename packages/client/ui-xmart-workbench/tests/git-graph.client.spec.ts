import { describe, expect, it } from 'vitest'
import {
  GIT_GRAPH_LANE, GIT_GRAPH_MAX_LANES, GIT_GRAPH_PAD, GIT_GRAPH_TEXT_GAP, gitGraphMergePath,
  gitGraphPageWidth, gitGraphRowWidth, gitGraphTextInset, gitGraphX, gitLaneClass, gitRefClass,
  layoutGitGraph,
} from '../src/client/git-graph.ts'

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
    expect(rows[0]?.merge).toBe(true)
    expect(rows[1]?.merge).toBeUndefined()
  })

  it('marks a Merge subject as a double-circle even without parents', () => {
    const rows = layoutGitGraph([
      { hash: 'm', subject: 'Merge pull request #1', author: 'A', timestamp: 2 },
      { hash: 'a', subject: 'feat: add', author: 'A', timestamp: 1 },
    ])
    expect(rows[0]?.merge).toBe(true)
    expect(rows[1]?.merge).toBeUndefined()
  })

  it('draws a quarter-circle elbow toward the other parent', () => {
    const path = gitGraphMergePath(0, 1)
    expect(path).toContain('A ')
    expect(path).toContain('H ')
    expect(gitGraphMergePath(0, 0)).toContain('V ')
    expect(gitGraphMergePath(1, 0, false, true)).toContain('A ')
    expect(gitGraphMergePath(1, 0, false, true).startsWith('M ')).toBe(true)
  })

  it('closes a side rail onto the first-parent spine', () => {
    const rows = layoutGitGraph([
      { hash: 'm', subject: 'merge', author: 'A', timestamp: 4, parents: ['a', 's'] },
      { hash: 's', subject: 'side', author: 'A', timestamp: 3, parents: ['a'] },
      { hash: 'a', subject: 'base', author: 'A', timestamp: 2, parents: [] },
    ])
    expect(rows.map(row => row.lane)).toEqual([0, 1, 0])
    expect(rows[2]?.merges.some(edge => edge.join === true && edge.from === 1 && edge.to === 0)).toBe(true)
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

  it('does not keep a rail for merge parents missing from this page', () => {
    const rows = layoutGitGraph([
      { hash: 'm1', subject: 'm1', author: 'A', timestamp: 6, parents: ['a1', 'ghost1'] },
      { hash: 'a1', subject: 'a1', author: 'A', timestamp: 5, parents: ['m2'] },
      { hash: 'm2', subject: 'm2', author: 'A', timestamp: 4, parents: ['a2', 'ghost2'] },
      { hash: 'a2', subject: 'a2', author: 'A', timestamp: 3, parents: ['m3'] },
      { hash: 'm3', subject: 'm3', author: 'A', timestamp: 2, parents: ['a3', 'ghost3'] },
      { hash: 'a3', subject: 'a3', author: 'A', timestamp: 1, parents: [] },
    ])
    expect(Math.max(...rows.map(row => row.railCount))).toBeLessThanOrEqual(2)
    expect(rows.filter(row => row.merges.some(edge => edge.stub === true))).toHaveLength(3)
  })

  it('keeps the first-parent spine on lane 0 across many merges', () => {
    const rows = layoutGitGraph([
      { hash: 'm2', subject: 'm2', author: 'A', timestamp: 5, parents: ['m1', 's2'] },
      { hash: 's2', subject: 's2', author: 'A', timestamp: 4, parents: ['m1'] },
      { hash: 'm1', subject: 'm1', author: 'A', timestamp: 3, parents: ['root', 's1'] },
      { hash: 's1', subject: 's1', author: 'A', timestamp: 2, parents: ['root'] },
      { hash: 'root', subject: 'root', author: 'A', timestamp: 1, parents: [] },
    ])
    expect(rows.filter(row => row.merge === true).every(row => row.lane === 0)).toBe(true)
    expect(rows.find(row => row.hash === 'root')?.lane).toBe(0)
  })

  it('reserves a rail when the other parent is later on this page', () => {
    const far: { hash: string; subject: string; author: string; timestamp: number; parents: string[] }[] = [
      { hash: 'm', subject: 'm', author: 'A', timestamp: 20, parents: ['c19', 'tail'] },
    ]
    for (let n = 19; n >= 1; n--) {
      far.push({
        hash: `c${String(n)}`,
        subject: `c${String(n)}`,
        author: 'A',
        timestamp: n,
        parents: n === 1 ? ['tail'] : [`c${String(n - 1)}`],
      })
    }
    far.push({ hash: 'tail', subject: 'tail', author: 'A', timestamp: 0, parents: [] })
    const rows = layoutGitGraph(far)
    expect(rows[0]?.merges.some(edge => edge.stub === true)).toBe(false)
    expect(rows[0]?.lane).toBe(0)
    expect(rows.find(row => row.hash === 'tail')?.lane).toBe(0)
  })

  it('does not open more rails than the Cursor cap', () => {
    const tips = Array.from({ length: 20 }, (_, i) => ({
      hash: `t${String(i)}`,
      subject: `t${String(i)}`,
      author: 'A',
      timestamp: 40 - i,
      parents: [`b${String(i)}`],
    }))
    const bases = Array.from({ length: 20 }, (_, i) => ({
      hash: `b${String(i)}`,
      subject: `b${String(i)}`,
      author: 'A',
      timestamp: 20 - i,
      parents: [] as string[],
    }))
    const rows = layoutGitGraph([...tips, ...bases])
    expect(Math.max(...rows.map(row => row.lane))).toBeLessThan(GIT_GRAPH_MAX_LANES)
    expect(Math.max(...rows.map(row => row.railCount))).toBeLessThanOrEqual(GIT_GRAPH_MAX_LANES)
  })

  it('sizes the graph column from the page-max rail count', () => {
    expect(gitGraphRowWidth({ railCount: 1 })).toBe(GIT_GRAPH_LANE + GIT_GRAPH_PAD)
    expect(gitGraphPageWidth([{ railCount: 1 }, { railCount: 3 }]))
      .toBe(3 * GIT_GRAPH_LANE + GIT_GRAPH_PAD)
    expect(gitGraphX(0)).toBe(6)
    expect(gitGraphTextInset(90)).toBe(90 + GIT_GRAPH_TEXT_GAP)
  })

  it('drops a first-parent rail when that parent is not on this page', () => {
    const rows = layoutGitGraph([
      { hash: 'c', subject: 'c', author: 'A', timestamp: 2, parents: ['ghost'] },
      { hash: 'b', subject: 'b', author: 'A', timestamp: 1, parents: [] },
    ])
    expect(Math.max(...rows.map(row => row.railCount))).toBe(1)
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
