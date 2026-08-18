import { describe, expect, it } from 'vitest'
import {
  LCS_CELL_CAP, alignLines, applyNewLineNumbers, firstChangeReveal, flattenFileChangeLines,
  formatPatch, inferStartLine, isCreateHunks, locateLine,
} from '../src/client/file-change-diff.ts'

describe('alignLines', () => {
  it('keeps shared lines as context and interleaves a replacement', () => {
    expect(alignLines(['a', 'b', 'c'], ['a', 'B', 'c'])).toEqual([
      { kind: 'eq', text: 'a' },
      { kind: 'del', text: 'b' },
      { kind: 'add', text: 'B' },
      { kind: 'eq', text: 'c' },
    ])
  })

  it('inserts before a kept line instead of deleting the shared line', () => {
    expect(alignLines(['x'], ['a', 'x'])).toEqual([
      { kind: 'add', text: 'a' },
      { kind: 'eq', text: 'x' },
    ])
  })

  it('treats an empty old side as a create and an empty new side as a delete', () => {
    expect(alignLines([], ['only'])).toEqual([{ kind: 'add', text: 'only' }])
    expect(alignLines(['gone'], [])).toEqual([{ kind: 'del', text: 'gone' }])
    expect(alignLines([], [])).toEqual([])
  })

  it('falls back to delete-then-add when the LCS table would be huge', () => {
    const n = Math.ceil(Math.sqrt(LCS_CELL_CAP)) + 1
    const oldLines = Array.from({ length: n }, (_, i) => `old-${String(i)}`)
    const newLines = Array.from({ length: n }, (_, i) => `new-${String(i)}`)
    const aligned = alignLines(oldLines, newLines)
    expect(aligned[0]).toEqual({ kind: 'del', text: 'old-0' })
    expect(aligned[n]).toEqual({ kind: 'add', text: 'new-0' })
    expect(aligned).toHaveLength(n * 2)
  })
})

describe('flattenFileChangeLines', () => {
  it('aligns a mid-file edit instead of dumping every deletion first', () => {
    const lines = flattenFileChangeLines([
      { path: 'a.ts', oldText: 'a\nb\nc', newText: 'a\nB\nc' },
    ])
    expect(lines.map(line => line.kind)).toEqual(['ctx', 'del', 'add', 'ctx'])
    expect(lines[0]).toEqual({ kind: 'ctx', text: 'a' })
    expect(lines[3]).toEqual({ kind: 'ctx', text: 'c' })
    expect(lines[1]?.marks?.some(mark => mark.kind === 'del' && mark.text === 'b')).toBe(true)
    expect(lines[2]?.marks?.some(mark => mark.kind === 'ins' && mark.text === 'B')).toBe(true)
  })

  it('pairs leftover replacements in a delete-then-add run and leaves extra adds unmarked', () => {
    const lines = flattenFileChangeLines([
      { path: 'a.ts', oldText: 'keep\ngone', newText: 'keep\nHERE\nAND' },
    ])
    expect(lines.map(line => line.kind)).toEqual(['ctx', 'del', 'add', 'add'])
    expect(lines[1]?.marks).toBeDefined()
    expect(lines[2]?.marks).toBeDefined()
    expect(lines[3]?.marks).toBeUndefined()
  })

  it('leaves extra deleted lines after pairing a shorter new side', () => {
    const lines = flattenFileChangeLines([
      { path: 'a.ts', oldText: 'keep\none\ntwo', newText: 'keep\nONE' },
    ])
    expect(lines.map(line => line.kind)).toEqual(['ctx', 'del', 'add', 'del'])
  })

  it('pairs two replacements in one hunk', () => {
    expect(flattenFileChangeLines([
      { path: 'a.ts', oldText: 'a\nb\nc', newText: 'a\nB\nC' },
    ]).map(line => line.kind)).toEqual(['ctx', 'del', 'add', 'del', 'add'])
  })

  it('inserts a gap between same-file hunks and skips empty sides', () => {
    const lines = flattenFileChangeLines([
      { path: 'a.ts', oldText: 'old', newText: 'new' },
      { path: 'a.ts', oldText: '', newText: '' },
      { path: 'a.ts', oldText: 'x', newText: 'y' },
    ])
    expect(lines.map(line => line.kind)).toEqual(['del', 'add', 'gap', 'del', 'add'])
    expect(lines[2]).toEqual({ kind: 'gap', text: '⋯' })
  })

  it('treats a trailing newline as a terminator and a null old side as adds only', () => {
    expect(flattenFileChangeLines([
      { path: 'a.ts', oldText: null, newText: 'only\n' },
    ])).toEqual([{ kind: 'add', text: 'only' }])
  })

  it('renders a delete-only hunk', () => {
    expect(flattenFileChangeLines([
      { path: 'a.ts', oldText: 'gone', newText: '' },
    ])).toEqual([{ kind: 'del', text: 'gone' }])
  })

  it('pairs identical oversized lines without word marks', () => {
    const n = Math.ceil(Math.sqrt(LCS_CELL_CAP)) + 1
    const body = Array.from({ length: n }, (_, i) => `same-${String(i)}`).join('\n')
    const lines = flattenFileChangeLines([
      { path: 'a.ts', oldText: body, newText: body },
    ])
    expect(lines[0]?.kind).toBe('del')
    expect(lines[0]?.marks).toBeUndefined()
    expect(lines[n]?.kind).toBe('add')
    expect(lines[n]?.marks).toBeUndefined()
  })

  it('skips word marks when a replacement line is too long to align', () => {
    const token = 'w '
    const n = Math.ceil(Math.sqrt(LCS_CELL_CAP)) + 1
    const oldLine = token.repeat(n).trimEnd()
    const newLine = 'z '.repeat(n).trimEnd()
    const lines = flattenFileChangeLines([
      { path: 'a.ts', oldText: oldLine, newText: newLine },
    ])
    expect(lines).toEqual([
      { kind: 'del', text: oldLine },
      { kind: 'add', text: newLine },
    ])
  })
})

describe('locateLine / inferStartLine / applyNewLineNumbers', () => {
  it('locates a unique line and refuses empty or ambiguous needles', () => {
    expect(locateLine('a\nb\na', 'b')).toBe(2)
    expect(locateLine('a\nb\na', 'a')).toBeUndefined()
    expect(locateLine('a\n', '')).toBeUndefined()
  })

  it('numbers a create from line 1 without reading the file', () => {
    const rows = flattenFileChangeLines([
      { path: 'n.ts', oldText: null, newText: 'one\ntwo' },
    ])
    expect(inferStartLine(undefined, rows, true)).toBe(1)
    expect(applyNewLineNumbers(rows, 1).map(row => row.line)).toEqual([1, 2])
  })

  it('backs up from a unique new line so the first row gets the real file line', () => {
    const rows = flattenFileChangeLines([
      { path: 'a.ts', oldText: 'a\nb\nc', newText: 'a\nB\nc' },
    ])
    expect(inferStartLine('a\nB\nc\n', rows, false)).toBe(1)
    expect(applyNewLineNumbers(rows, 10).map(row => ({ kind: row.kind, line: row.line }))).toEqual([
      { kind: 'ctx', line: 10 },
      { kind: 'del', line: 11 },
      { kind: 'add', line: 11 },
      { kind: 'ctx', line: 12 },
    ])
  })

  it('falls back to a unique deleted line while the disk still has the old text', () => {
    const rows = flattenFileChangeLines([
      { path: 'a.ts', oldText: 'gone', newText: 'here' },
    ])
    expect(inferStartLine('gone\n', rows, false)).toBe(1)
    expect(inferStartLine(undefined, rows, false)).toBeUndefined()
    expect(inferStartLine('unrelated\n', rows, false)).toBeUndefined()
  })

  it('does not invent a start line for an empty create', () => {
    expect(inferStartLine(undefined, [], true)).toBeUndefined()
    expect(applyNewLineNumbers([{ kind: 'gap', text: '⋯' }], 1)).toEqual([{ kind: 'gap', text: '⋯' }])
  })

  it('refuses a start line that would go past the top of the file', () => {
    const rows = flattenFileChangeLines([
      { path: 'a.ts', oldText: 'a\nb', newText: 'a\nB' },
    ])
    expect(inferStartLine('B\n', rows, false)).toBeUndefined()
    const deleted = flattenFileChangeLines([
      { path: 'a.ts', oldText: 'a\nb', newText: 'a\n' },
    ])
    expect(inferStartLine('b\n', deleted, false)).toBeUndefined()
  })

  it('reveals the first numbered change, or any numbered row', () => {
    expect(firstChangeReveal([])).toBeUndefined()
    expect(firstChangeReveal([{ kind: 'gap', text: '⋯' }])).toBeUndefined()
    expect(firstChangeReveal([{ kind: 'ctx', text: 'a', line: 4 }])).toEqual({ line: 3, character: 0 })
    expect(firstChangeReveal([
      { kind: 'ctx', text: 'a', line: 4 },
      { kind: 'add', text: 'B', line: 5 },
    ])).toEqual({ line: 4, character: 0 })
  })
})

describe('formatPatch / isCreateHunks', () => {
  it('writes a git-style create patch from line 1', () => {
    const rows = flattenFileChangeLines([
      { path: 'n.ts', oldText: null, newText: 'one\ntwo' },
    ])
    expect(isCreateHunks([{ path: 'n.ts', oldText: null, newText: 'one' }])).toBe(true)
    expect(isCreateHunks([{ path: 'n.ts', oldText: '', newText: 'one' }])).toBe(false)
    expect(isCreateHunks([])).toBe(false)
    expect(formatPatch('n.ts', rows, 1, true)).toBe([
      '--- /dev/null',
      '+++ b/n.ts',
      '@@ -0,0 +1,2 @@',
      '+one',
      '+two',
    ].join('\n'))
  })

  it('writes a unified hunk when the start line is known, and omits @@ when it is not', () => {
    const rows = flattenFileChangeLines([
      { path: 'a.ts', oldText: 'a\nb\nc', newText: 'a\nB\nc' },
    ])
    expect(formatPatch('a.ts', rows, 4, false)).toBe([
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -4,3 +4,3 @@',
      ' a',
      '-b',
      '+B',
      ' c',
    ].join('\n'))
    expect(formatPatch('a.ts', rows, undefined, false)).toBe([
      '--- a/a.ts',
      '+++ b/a.ts',
      ' a',
      '-b',
      '+B',
      ' c',
    ].join('\n'))
  })

  it('copies a gap as a bare ellipsis', () => {
    expect(formatPatch('a.ts', [{ kind: 'gap', text: '⋯' }], undefined, false)).toBe([
      '--- a/a.ts',
      '+++ b/a.ts',
      '⋯',
    ].join('\n'))
  })
})
