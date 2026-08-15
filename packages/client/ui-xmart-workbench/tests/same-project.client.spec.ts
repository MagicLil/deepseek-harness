import { describe, expect, it } from 'vitest'
import { projectKeyOf, shouldInheritSameProject } from '../src/client/same-project.ts'

const sessions = {
  byId: {
    a: { cwd: '/ws', blank: false },
    b: { cwd: '/ws', blank: true },
    c: { cwd: '/other', blank: true },
    d: { blank: true },
  },
}

const workspaces = {
  items: [
    { workspaceId: 'w1', path: '/ws', sessionIds: ['a', 'b'] },
    { workspaceId: 'w2', path: '/other', sessionIds: ['c'] },
  ],
}

describe('projectKeyOf', () => {
  it('prefers the workspace folder path, then cwd', () => {
    expect(projectKeyOf('a', sessions, workspaces)).toBe('/ws')
    expect(projectKeyOf('c', sessions, workspaces)).toBe('/other')
    expect(projectKeyOf('missing', { byId: {} }, { items: [] })).toBeUndefined()
    expect(projectKeyOf('d', sessions, {
      items: [{ workspaceId: 'w3', path: '', sessionIds: ['d'] }],
    })).toBe('w3')
  })
})

describe('shouldInheritSameProject', () => {
  it('inherits any session in the same folder, including an existing chat', () => {
    expect(shouldInheritSameProject('a', 'b', sessions, workspaces)).toBe(true)
    expect(shouldInheritSameProject('b', 'a', sessions, workspaces)).toBe(true)
    expect(shouldInheritSameProject('a', 'c', sessions, workspaces)).toBe(false)
    expect(shouldInheritSameProject('a', 'a', sessions, workspaces)).toBe(false)
    expect(shouldInheritSameProject('a', 'd', sessions, workspaces)).toBe(false)
    expect(shouldInheritSameProject('a', 'missing', sessions, workspaces)).toBe(false)
  })
})
