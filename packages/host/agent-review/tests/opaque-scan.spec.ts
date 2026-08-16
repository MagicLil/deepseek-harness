import { describe, expect, it } from 'vitest'
import { parseOpaquePorcelain, planOpaqueMutations } from '../src/opaque-scan.ts'
import type { OpaqueFileSnap } from '../src/opaque-scan.ts'
import { isOpaqueMutationTool } from '../src/opaque-tools.ts'

function snap(
  absPath: string,
  relPath: string,
  code: OpaqueFileSnap['code'],
  hash: string | null,
  text: string | null,
): OpaqueFileSnap {
  return { absPath, relPath, code, hash, text }
}

describe('isOpaqueMutationTool', () => {
  it('matches shipped names and config extras', () => {
    expect(isOpaqueMutationTool('cursor_agent')).toBe(true)
    expect(isOpaqueMutationTool('subagent')).toBe(true)
    expect(isOpaqueMutationTool('subagent_fork')).toBe(true)
    expect(isOpaqueMutationTool('subagent_acp')).toBe(true)
    expect(isOpaqueMutationTool('write')).toBe(false)
    expect(isOpaqueMutationTool('custom_bot', ['custom_bot'])).toBe(true)
  })
})

describe('parseOpaquePorcelain', () => {
  it('classifies untracked, deleted, changed, quoted, and rename lines', () => {
    const rows = parseOpaquePorcelain([
      '## main',
      '?? new.txt',
      ' D gone.txt',
      'D  staged-gone.txt',
      ' M dirty.txt',
      'M  staged.txt',
      'R  old.txt -> "new name.txt"',
      '?? "quote\\"d.txt"',
      '??  ',
      'R  old.txt ->  ',
      'xx',
      '',
    ].join('\n'))
    expect(rows.get('new.txt')?.code).toBe('untracked')
    expect(rows.get('gone.txt')?.code).toBe('deleted')
    expect(rows.get('staged-gone.txt')?.code).toBe('deleted')
    expect(rows.get('dirty.txt')?.code).toBe('changed')
    expect(rows.get('staged.txt')?.code).toBe('changed')
    expect(rows.get('new name.txt')?.code).toBe('changed')
    expect(rows.get('quote"d.txt')?.code).toBe('untracked')
    expect(rows.size).toBe(7)
  })
})

describe('planOpaqueMutations', () => {
  it('plans create, update, delete, and skips unchanged hashes', () => {
    const before = new Map([
      ['/a/keep.txt', snap('/a/keep.txt', 'keep.txt', 'untracked', 'h1', 'same')],
      ['/a/edit.txt', snap('/a/edit.txt', 'edit.txt', 'changed', 'old', 'v0')],
      ['/a/drop.txt', snap('/a/drop.txt', 'drop.txt', 'untracked', 'gone', 'bye')],
      ['/a/ghost.txt', snap('/a/ghost.txt', 'ghost.txt', 'deleted', null, null)],
    ])
    const after = new Map([
      ['/a/keep.txt', snap('/a/keep.txt', 'keep.txt', 'untracked', 'h1', 'same')],
      ['/a/edit.txt', snap('/a/edit.txt', 'edit.txt', 'changed', 'new', 'v1')],
      ['/a/fresh.txt', snap('/a/fresh.txt', 'fresh.txt', 'untracked', 'n', 'hi')],
      ['/a/mod.txt', snap('/a/mod.txt', 'mod.txt', 'changed', 'm', 'body')],
      ['/a/rm.txt', snap('/a/rm.txt', 'rm.txt', 'deleted', null, null)],
      ['/a/was-null.txt', snap('/a/was-null.txt', 'was-null.txt', 'untracked', 'now', 'x')],
    ])
    before.set('/a/was-null.txt', snap('/a/was-null.txt', 'was-null.txt', 'untracked', null, null))
    const plans = planOpaqueMutations(before, after)
    expect(plans).toEqual(expect.arrayContaining([
      { absPath: '/a/edit.txt', relPath: 'edit.txt', kind: 'update', beforeText: 'v0' },
      { absPath: '/a/fresh.txt', relPath: 'fresh.txt', kind: 'create', beforeText: null },
      { absPath: '/a/mod.txt', relPath: 'mod.txt', kind: 'update', beforeText: null },
      { absPath: '/a/rm.txt', relPath: 'rm.txt', kind: 'delete', beforeText: null },
      { absPath: '/a/drop.txt', relPath: 'drop.txt', kind: 'delete', beforeText: 'bye' },
      { absPath: '/a/was-null.txt', relPath: 'was-null.txt', kind: 'create', beforeText: null },
    ]))
    expect(plans.some(plan => plan.absPath === '/a/keep.txt')).toBe(false)
    expect(plans.some(plan => plan.absPath === '/a/ghost.txt')).toBe(false)
  })

  it('treats a previously snapshotted path that is now deleted as delete', () => {
    const before = new Map([
      ['/a/x.txt', snap('/a/x.txt', 'x.txt', 'changed', 'h', 'old')],
    ])
    const after = new Map([
      ['/a/x.txt', snap('/a/x.txt', 'x.txt', 'deleted', null, null)],
    ])
    expect(planOpaqueMutations(before, after)).toEqual([
      { absPath: '/a/x.txt', relPath: 'x.txt', kind: 'delete', beforeText: 'old' },
    ])
  })
})
