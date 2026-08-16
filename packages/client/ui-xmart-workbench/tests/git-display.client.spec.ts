import { describe, expect, it } from 'vitest'
import { gitPathParts } from '../src/client/git-display.ts'

describe('gitPathParts', () => {
  it('splits a nested path and keeps a bare name', () => {
    expect(gitPathParts('src/foo/a.ts')).toEqual({ name: 'a.ts', dir: 'src/foo' })
    expect(gitPathParts('a.ts')).toEqual({ name: 'a.ts', dir: '' })
    expect(gitPathParts('src\\b.tsx')).toEqual({ name: 'b.tsx', dir: 'src' })
  })
})
