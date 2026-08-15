import { describe, expect, it } from 'vitest'
import { encodeDiffPath, parseDiffPath } from '../src/client/git-diff-path.ts'
import { diffLineKind } from '../src/client/diff-line.ts'

describe('git-diff-path', () => {
  it('encodes and parses a side:file seed', () => {
    expect(encodeDiffPath('worktree', 'src/a.ts')).toBe('worktree:src/a.ts')
    expect(parseDiffPath('worktree:src/a.ts')).toEqual({ side: 'worktree', file: 'src/a.ts' })
    expect(parseDiffPath('staged:b.ts')).toEqual({ side: 'staged', file: 'b.ts' })
  })

  it('rejects missing, empty, and unknown sides', () => {
    expect(parseDiffPath(undefined)).toBeUndefined()
    expect(parseDiffPath('')).toBeUndefined()
    expect(parseDiffPath('worktree')).toBeUndefined()
    expect(parseDiffPath(':a.ts')).toBeUndefined()
    expect(parseDiffPath('other:a.ts')).toBeUndefined()
    expect(parseDiffPath('worktree:')).toBeUndefined()
  })
})

describe('diffLineKind', () => {
  it('classifies unified-diff lines', () => {
    expect(diffLineKind('diff --git a/a b/a')).toBe('meta')
    expect(diffLineKind('--- a/a')).toBe('meta')
    expect(diffLineKind('+++ b/a')).toBe('meta')
    expect(diffLineKind('@@ -1,2 +1,2 @@')).toBe('hunk')
    expect(diffLineKind('+added')).toBe('add')
    expect(diffLineKind('-removed')).toBe('del')
    expect(diffLineKind(' context')).toBe('ctx')
  })
})
