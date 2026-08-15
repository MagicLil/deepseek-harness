import { describe, expect, it } from 'vitest'
import {
  editorWorkspaceRoot, homeOf, inferWorkspaceFromFile, resolveExplorerRoots, resolveSessionCwd,
  resolveTerminalCwd,
} from '../src/client/explorer-roots.ts'

const hmdp = { workspaceId: 'w1', path: 'D:\\work\\hmdp', title: 'hmdp', sessionIds: ['s1'] }
const tool = { workspaceId: 'w2', path: 'D:\\work\\tool', title: 'tool', sessionIds: [] }

describe('resolveExplorerRoots', () => {
  it('returns only the current session folder, not every registered workspace', () => {
    expect(resolveExplorerRoots('s1', undefined, [hmdp, tool], 'w2')).toEqual([
      { path: 'D:\\work\\hmdp', title: 'hmdp' },
    ])
    expect(resolveExplorerRoots('s9', undefined, [hmdp, tool], 'w2')).toEqual([
      { path: 'D:\\work\\tool', title: 'tool' },
    ])
  })

  it('uses the conversation workspace title, else the basename of a lone cwd', () => {
    expect(resolveExplorerRoots('s1', '/live', [hmdp, tool], 'w2')).toEqual([
      { path: 'D:\\work\\hmdp', title: 'hmdp' },
    ])
    expect(resolveExplorerRoots('s9', '/live', [hmdp, tool], 'w2')).toEqual([
      { path: '/live', title: 'live' },
    ])
    expect(resolveExplorerRoots('s1', 'D:\\work\\hmdp', [{ ...hmdp, title: '' }, tool], 'w2')).toEqual([
      { path: 'D:\\work\\hmdp', title: 'hmdp' },
    ])
  })

  it('is empty when nothing is registered and the session has no cwd', () => {
    expect(resolveExplorerRoots('s1', undefined, [], undefined)).toEqual([])
    expect(resolveExplorerRoots('s1', '', [], undefined)).toEqual([])
  })
})

describe('resolveSessionCwd', () => {
  it('prefers the conversation workspace over a leftover or parent cwd', () => {
    expect(resolveSessionCwd('s1', '/live', [hmdp, tool], 'w2')).toBe('D:\\work\\hmdp')
    expect(resolveSessionCwd('s1', 'D:\\work', [hmdp, tool], 'w2')).toBe('D:\\work\\hmdp')
    expect(resolveSessionCwd('s1', 'D:\\work\\hmdp\\src', [hmdp, tool], 'w2')).toBe('D:\\work\\hmdp')
    expect(resolveSessionCwd('s9', 'D:\\work\\hmdp\\src', [hmdp, tool], 'w2')).toBe('D:\\work\\hmdp')
    expect(resolveSessionCwd(
      's9',
      'D:\\work\\hmdp\\web\\a.ts',
      [hmdp, { workspaceId: 'w3', path: 'D:\\work\\hmdp\\web', title: 'web', sessionIds: [] }],
      'w2',
    )).toBe('D:\\work\\hmdp\\web')
    expect(resolveSessionCwd(
      's9',
      'D:\\work\\hmdp\\web\\a.ts',
      [{ workspaceId: 'w3', path: 'D:\\work\\hmdp\\web', title: 'web', sessionIds: [] }, hmdp],
      undefined,
    )).toBe('D:\\work\\hmdp\\web')
    expect(resolveSessionCwd('s9', 'D:\\work', [hmdp, tool], 'w2')).toBe('D:\\work\\tool')
    expect(resolveSessionCwd('s9', 'D:\\work\\tool', [hmdp, tool], 'w2')).toBe('D:\\work\\tool')
    expect(resolveSessionCwd('s9', '/live', [hmdp, tool], 'w2')).toBe('/live')
    expect(resolveSessionCwd('s9', 'D:\\work', [hmdp], undefined)).toBe('D:\\work\\hmdp')
    expect(resolveSessionCwd('s1', undefined, [hmdp, tool], 'w2')).toBe('D:\\work\\hmdp')
    expect(resolveSessionCwd('s9', '', [hmdp, tool], 'w2')).toBe('D:\\work\\tool')
    expect(resolveSessionCwd('s9', undefined, [hmdp, tool], 'gone')).toBe('D:\\work\\hmdp')
    expect(resolveSessionCwd('s9', undefined, [{ ...hmdp, path: '' }, tool], undefined)).toBe('D:\\work\\tool')
    expect(resolveSessionCwd('s9', undefined, [], undefined)).toBeUndefined()
    expect(resolveSessionCwd('s9', '/ws', [], undefined)).toBe('/ws')
  })
})

describe('editorWorkspaceRoot', () => {
  it('prefers cwd, then the first explorer root', () => {
    expect(editorWorkspaceRoot('/ws', [{ path: '/other', title: 'o' }])).toBe('/ws')
    expect(editorWorkspaceRoot('', [{ path: '/ws', title: 'ws' }])).toBe('/ws')
    expect(editorWorkspaceRoot(undefined, [{ path: '/ws', title: 'ws' }])).toBe('/ws')
    expect(editorWorkspaceRoot(undefined, [{ path: '', title: 'x' }])).toBeUndefined()
    expect(editorWorkspaceRoot('', [])).toBeUndefined()
    expect(editorWorkspaceRoot('', [], 'D:\\work\\jianghuawei\\mod\\src\\main\\java\\Foo.java'))
      .toBe('D:\\work\\jianghuawei\\mod')
    expect(editorWorkspaceRoot(
      'D:\\work\\xmart-web',
      [{ path: 'D:\\work\\xmart-web', title: 'x' }],
      'D:\\work\\xmart-web\\apps\\web\\src\\App.vue',
    )).toBe('D:\\work\\xmart-web\\apps\\web')
    expect(editorWorkspaceRoot('/mono', [], '/mono/apps/web/src/main.ts')).toBe('/mono/apps/web')
    expect(editorWorkspaceRoot('/ws', [], '/ws/src/main/java/Foo.java')).toBe('/ws')
    expect(editorWorkspaceRoot('/other', [], '/mono/apps/web/src/App.vue')).toBe('/mono/apps/web')
    expect(editorWorkspaceRoot('/mono/apps/web/src', [], '/mono/apps/web/src/App.vue'))
      .toBe('/mono/apps/web/src')
    expect(editorWorkspaceRoot('/ws', [], 'App.vue')).toBe('/ws')
  })
})

describe('inferWorkspaceFromFile', () => {
  it('cuts at Maven src or the parent directory', () => {
    expect(inferWorkspaceFromFile('')).toBeUndefined()
    expect(inferWorkspaceFromFile('Foo.java')).toBeUndefined()
    expect(inferWorkspaceFromFile('/mod/src/main/java/com/x/Foo.java')).toBe('/mod')
    expect(inferWorkspaceFromFile('D:\\mod\\src\\main\\kotlin\\Foo.kt')).toBe('D:\\mod')
    expect(inferWorkspaceFromFile('/mod/src/test/java/Foo.java')).toBe('/mod')
    expect(inferWorkspaceFromFile('/app/src/views/A.vue')).toBe('/app')
    expect(inferWorkspaceFromFile('/app/readme.md')).toBe('/app')
  })
})

describe('resolveTerminalCwd', () => {
  it('prefers the explorer root, then the session cwd', () => {
    expect(resolveTerminalCwd([{ path: 'D:\\hmdp', title: 'hmdp' }], '/other')).toBe('D:\\hmdp')
    expect(resolveTerminalCwd([], '/live')).toBe('/live')
    expect(resolveTerminalCwd([{ path: '', title: 'x' }], undefined)).toBeUndefined()
    expect(resolveTerminalCwd([], undefined)).toBeUndefined()
  })
})

describe('homeOf', () => {
  it('matches a root, then the first root, then empty', () => {
    const roots = [
      { path: 'D:\\hmdp', title: 'hmdp' },
      { path: 'D:\\tool', title: 'tool' },
    ]
    expect(homeOf('D:\\tool\\a.ts', roots)).toBe('D:\\tool')
    expect(homeOf('C:\\other', roots)).toBe('D:\\hmdp')
    expect(homeOf('/x', [])).toBe('')
  })
})
