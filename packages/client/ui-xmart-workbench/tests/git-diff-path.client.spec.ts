import { describe, expect, it } from 'vitest'
import {
  commitDiffTitle, encodeCommitDiffPath, encodeDiffPath, parseDiffPath,
} from '../src/client/git-diff-path.ts'
import { diffLineKind } from '../src/client/diff-line.ts'
import {
  attachTokens, newGutter, oldGutter, paintDiffLines, sourceSides, splitUnifiedPatch,
} from '../src/client/diff-patch.ts'

describe('git-diff-path', () => {
  it('encodes and parses a side:file seed', () => {
    expect(encodeDiffPath('worktree', 'src/a.ts')).toBe('worktree:src/a.ts')
    expect(parseDiffPath('worktree:src/a.ts')).toEqual({ kind: 'side', side: 'worktree', file: 'src/a.ts' })
    expect(parseDiffPath('staged:b.ts')).toEqual({ kind: 'side', side: 'staged', file: 'b.ts' })
  })

  it('encodes and parses a commit seed', () => {
    expect(encodeCommitDiffPath('abcdef1')).toBe('commit:abcdef1')
    expect(parseDiffPath('commit:abcdef1')).toEqual({ kind: 'commit', commit: 'abcdef1' })
    expect(parseDiffPath('commit:ABCDEF12')).toEqual({ kind: 'commit', commit: 'ABCDEF12' })
    expect(parseDiffPath('commit:abc')).toBeUndefined()
    expect(parseDiffPath('commit:HEAD')).toBeUndefined()
  })

  it('rejects missing, empty, and unknown sides', () => {
    expect(parseDiffPath(undefined)).toBeUndefined()
    expect(parseDiffPath('')).toBeUndefined()
    expect(parseDiffPath('worktree')).toBeUndefined()
    expect(parseDiffPath(':a.ts')).toBeUndefined()
    expect(parseDiffPath('other:a.ts')).toBeUndefined()
    expect(parseDiffPath('worktree:')).toBeUndefined()
  })

  it('clips a commit tab title', () => {
    expect(commitDiffTitle('abcdef1234', '')).toBe('abcdef1')
    expect(commitDiffTitle('abcdef1234', '  init  ')).toBe('abcdef1 init')
    expect(commitDiffTitle('abcdef1', 'x'.repeat(49))).toBe(`abcdef1 ${'x'.repeat(47)}…`)
  })

  it('pins an optional repository root onto the seed', () => {
    expect(encodeDiffPath('worktree', 'a.ts', 'D:\\work\\child')).toBe('worktree:a.ts\x1eD:\\work\\child')
    expect(parseDiffPath('worktree:a.ts\x1eD:\\work\\child')).toEqual({
      kind: 'side', side: 'worktree', file: 'a.ts', root: 'D:\\work\\child',
    })
    expect(encodeCommitDiffPath('abcdef1', '/child')).toBe('commit:abcdef1\x1e/child')
    expect(parseDiffPath('commit:abcdef1\x1e/child')).toEqual({
      kind: 'commit', commit: 'abcdef1', root: '/child',
    })
    expect(encodeDiffPath('staged', 'a.ts')).toBe('staged:a.ts')
    expect(encodeCommitDiffPath('abcdef1')).toBe('commit:abcdef1')
    expect(parseDiffPath('worktree:a.ts\x1e')).toEqual({ kind: 'side', side: 'worktree', file: 'a.ts' })
    expect(parseDiffPath('other:a.ts\x1e/child')).toBeUndefined()
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

describe('splitUnifiedPatch / paintDiffLines', () => {
  it('returns empty for empty text and a fallback section without headers', () => {
    expect(splitUnifiedPatch('')).toEqual([])
    expect(splitUnifiedPatch('+solo', 'a.ts')).toEqual([
      { path: 'a.ts', status: 'modified', lines: ['+solo'] },
    ])
    expect(splitUnifiedPatch('+solo')).toEqual([
      { path: '', status: 'modified', lines: ['+solo'] },
    ])
  })

  it('splits added, deleted, renamed, and modified files', () => {
    const text = [
      'diff --git a/src/a.ts b/src/a.ts',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/src/a.ts',
      '@@ -0,0 +1,1 @@',
      '+hi',
      'diff --git a/gone.ts b/gone.ts',
      'deleted file mode 100644',
      '--- a/gone.ts',
      '+++ /dev/null',
      '@@ -1 +0,0 @@',
      '-bye',
      'diff --git a/old.ts b/new.ts',
      'rename from old.ts',
      'rename to new.ts',
      '--- a/old.ts',
      '+++ b/new.ts',
      '@@ -1 +1 @@',
      '-a',
      '+b',
      'diff --git a/m.ts b/m.ts',
      '--- a/m.ts',
      '+++ b/m.ts',
      '@@ -1,2 +1,2 @@',
      ' keep',
      '-old',
      '+new',
    ].join('\n')
    const sections = splitUnifiedPatch(text)
    expect(sections.map(row => [row.path, row.status])).toEqual([
      ['src/a.ts', 'added'],
      ['gone.ts', 'deleted'],
      ['new.ts', 'renamed'],
      ['m.ts', 'modified'],
    ])
    const painted = paintDiffLines(sections[3]?.lines ?? [])
    expect(painted.some(line => line.kind === 'add' && line.newNo === 2)).toBe(true)
    expect(painted.some(line => line.kind === 'del' && line.oldNo === 2)).toBe(true)
    expect(painted.some(line => line.kind === 'ctx' && line.newNo === 1)).toBe(true)
    expect(paintDiffLines(['@@ junk @@', ' keep'])[1]?.kind).toBe('ctx')
    expect(splitUnifiedPatch('diff --git weird')[0]?.path).toBe('weird')
  })

  it('rebuilds old/new sides and keeps Shiki tokens off the +/- prefix', () => {
    const painted = paintDiffLines([
      'diff --git a/a.ts b/a.ts',
      '@@ -1,2 +1,2 @@',
      ' keep',
      '-old',
      '+new',
    ])
    expect(sourceSides(painted)).toEqual({ oldLines: ['keep', 'old'], newLines: ['keep', 'new'] })
    const rows = attachTokens(painted, [[{ text: 'keep' }], [{ text: 'old', color: '#f00' }]], [
      [{ text: 'keep' }], [{ text: 'new', color: '#0f0' }],
    ])
    expect(rows.find(row => row.kind === 'add')?.tokens).toEqual([{ text: 'new', color: '#0f0' }])
    expect(rows.find(row => row.kind === 'del')?.tokens).toEqual([{ text: 'old', color: '#f00' }])
    expect(rows.find(row => row.kind === 'hunk')?.tokens[0]?.text).toContain('@@')
    const add = painted.find(line => line.kind === 'add')
    const del = painted.find(line => line.kind === 'del')
    const ctx = painted.find(line => line.kind === 'ctx')
    const hunk = painted.find(line => line.kind === 'hunk')
    expect(oldGutter(add!)).toBe('')
    expect(newGutter(add!)).toBe('2+')
    expect(oldGutter(del!)).toBe('2')
    expect(newGutter(del!)).toBe('')
    expect(oldGutter(ctx!)).toBe('1')
    expect(newGutter(ctx!)).toBe('1')
    expect(oldGutter(hunk!)).toBe('')
    expect(newGutter(hunk!)).toBe('')
    expect(attachTokens([{ kind: 'add', text: '+x' }], [], [])[0]?.tokens).toEqual([{ text: 'x' }])
    expect(attachTokens([{ kind: 'ctx', text: ' x' }], [[{ text: 'from-old' }]], [])[0]?.tokens)
      .toEqual([{ text: 'from-old' }])
    expect(oldGutter({ kind: 'del', text: '-x' })).toBe('')
    expect(newGutter({ kind: 'add', text: '+x' })).toBe('')
  })
})
