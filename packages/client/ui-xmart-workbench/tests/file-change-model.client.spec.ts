import { describe, expect, it } from 'vitest'
import type { RunningToolCall, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import {
  FILE_CHANGE_MAX_LINES, fileChangeModel, flattenFileChangeLines, relativizeToCwd,
  resolveWorkspacePath,
} from '../src/client/file-change-model.ts'

const ARGS = '{"file_path":"/ws/notes/demo.ts","old_string":"hello","new_string":"hello fixture"}'

const callDiff = {
  card: 'diff' as const,
  title: 'Edit demo.ts',
  diffs: [{ path: '/ws/notes/demo.ts', oldText: 'hello', newText: 'hello fixture' }],
}

const running = (over?: Partial<RunningToolCall>): RunningToolCall => ({
  callId: 'c1', name: 'edit', argsRaw: ARGS,
  turn: 1, step: 1, time: 1_000, callView: callDiff, subCalls: [], ...over,
})
const settled = (over?: Partial<ToolResultNode>): ToolResultNode => ({
  kind: 'tool-result', seq: 10, time: 2_000, callId: 'c1',
  call: { name: 'edit', argsRaw: ARGS },
  callTime: 1_000,
  content: [{ type: 'text', text: 'The file /ws/notes/demo.ts has been updated successfully.' }],
  isError: false,
  callView: callDiff,
  resultView: callDiff,
  subCalls: [],
  ...over,
})

describe('fileChangeModel', () => {
  it('builds a running card from the call-time diff', () => {
    expect(fileChangeModel('edit', running(), '/ws')).toEqual({
      kind: 'card',
      path: '/ws/notes/demo.ts',
      displayPath: 'notes/demo.ts',
      added: 1,
      removed: 1,
      hunks: callDiff.diffs,
      state: 'running',
    })
  })

  it('lets the settled result view replace the call-time diff', () => {
    const resultView = {
      card: 'diff' as const,
      diffs: [{ path: '/ws/notes/demo.ts', oldText: 'a', newText: 'b' }],
    }
    const model = fileChangeModel('edit', settled({ resultView }), '/ws')
    expect(model.kind).toBe('card')
    if (model.kind !== 'card') return
    expect(model.hunks).toEqual(resultView.diffs)
    expect(model.state).toBe('ok')
    expect(model.added).toBe(1)
    expect(model.removed).toBe(1)
  })

  it('still builds a card when the window dropped the call head', () => {
    const model = fileChangeModel('write', settled({ call: null, callView: null }), '/ws')
    expect(model.kind).toBe('card')
  })

  it('falls back when there is no usable diff', () => {
    expect(fileChangeModel('edit', running({ callView: null }), '/ws')).toEqual({
      kind: 'fallback',
      path: '/ws/notes/demo.ts',
      displayPath: 'notes/demo.ts',
      summary: 'notes/demo.ts',
      state: 'running',
    })
  })

  it('falls back to the error first line when the mutation failed', () => {
    const model = fileChangeModel('edit', settled({
      isError: true,
      resultView: { card: 'generic' },
      content: [{ type: 'text', text: 'Permission denied\nmore' }],
    }), '/ws')
    expect(model).toEqual({
      kind: 'fallback',
      path: '/ws/notes/demo.ts',
      displayPath: 'notes/demo.ts',
      summary: 'Permission denied',
      state: 'error',
    })
  })

  it('marks an interrupted call as stopped', () => {
    const model = fileChangeModel('edit', settled({
      isError: true,
      error: { name: 'Abort', code: 'interrupted' },
      resultView: { card: 'generic' },
      content: [{ type: 'text', text: 'stopped' }],
    }), '/ws')
    expect(model.kind).toBe('fallback')
    if (model.kind !== 'fallback') return
    expect(model.state).toBe('stopped')
  })

  it('rejects a malformed wire diff instead of throwing', () => {
    const bad = (diffs: unknown) => ({ card: 'diff', diffs }) as never
    expect(fileChangeModel('edit', running({ callView: bad(undefined) })).kind).toBe('fallback')
    expect(fileChangeModel('edit', running({ callView: bad([]) })).kind).toBe('fallback')
    expect(fileChangeModel('edit', running({ callView: bad('nope') })).kind).toBe('fallback')
    expect(fileChangeModel('edit', running({ callView: bad([null]) })).kind).toBe('fallback')
    expect(fileChangeModel('edit', running({ callView: bad([{ path: 1, oldText: null, newText: 'x' }]) })).kind).toBe('fallback')
    expect(fileChangeModel('edit', running({ callView: bad([{ path: 'a', oldText: 5, newText: 'x' }]) })).kind).toBe('fallback')
    expect(fileChangeModel('edit', running({ callView: bad([{ path: 'a', oldText: null, newText: 9 }]) })).kind).toBe('fallback')
  })

  it('ignores args that are not an object or have no path key', () => {
    expect(fileChangeModel('edit', running({ argsRaw: '1', callView: null })).path).toBeUndefined()
    expect(fileChangeModel('edit', running({ argsRaw: 'null', callView: null })).path).toBeUndefined()
    expect(fileChangeModel('edit', running({ argsRaw: '{"foo":"bar"}', callView: null })).path).toBeUndefined()
  })

  it('uses the tool name when args and views have no path', () => {
    const model = fileChangeModel('write', running({
      argsRaw: '{',
      callView: null,
    }))
    expect(model).toMatchObject({
      kind: 'fallback',
      path: undefined,
      displayPath: 'write',
      summary: 'write',
    })
  })

  it('reads path from args.path and keeps a non-rooted display path', () => {
    const model = fileChangeModel('write', running({
      argsRaw: '{"path":"src\\\\a.ts"}',
      callView: null,
    }), '/other')
    expect(model.kind).toBe('fallback')
    if (model.kind !== 'fallback') return
    expect(model.path).toBe('src\\a.ts')
    expect(model.displayPath).toBe('src\\a.ts')
  })

  it('surfaces a structured error when the result has no text', () => {
    const model = fileChangeModel('edit', settled({
      isError: true,
      resultView: { card: 'generic' },
      content: [{ type: 'image', data: 'x' } as never],
      error: { name: 'IO', code: 'eio' },
    }))
    expect(model.kind).toBe('fallback')
    if (model.kind !== 'fallback') return
    expect(model.summary).toBe('{')
  })

  it('falls back to name:code when error content is empty', () => {
    const model = fileChangeModel('edit', settled({
      isError: true,
      resultView: { card: 'generic' },
      content: [],
      error: { name: 'IO', code: 'eio' },
    }))
    expect(model.kind).toBe('fallback')
    if (model.kind !== 'fallback') return
    expect(model.summary).toBe('IO: eio')
  })

  it('counts a create as additions only', () => {
    const model = fileChangeModel('write', running({
      name: 'write',
      argsRaw: '{"path":"new.ts","content":"one\\ntwo\\n"}',
      callView: {
        card: 'diff',
        diffs: [{ path: 'new.ts', oldText: null, newText: 'one\ntwo\n' }],
      },
    }))
    expect(model.kind).toBe('card')
    if (model.kind !== 'card') return
    expect(model.added).toBe(2)
    expect(model.removed).toBe(0)
    expect(model.displayPath).toBe('new.ts')
  })
})

describe('flattenFileChangeLines', () => {
  it('caps the chat body and inserts a gap between same-file hunks', () => {
    expect(FILE_CHANGE_MAX_LINES).toBe(8)
    const lines = flattenFileChangeLines([
      { path: 'a.ts', oldText: 'old', newText: 'new' },
      { path: 'a.ts', oldText: 'x', newText: 'y' },
    ])
    expect(lines.map(line => line.kind)).toEqual(['del', 'add', 'gap', 'del', 'add'])
    expect(lines[2]).toEqual({ kind: 'gap', text: '⋯' })
  })

  it('treats a trailing newline as a terminator, not an extra blank line', () => {
    const lines = flattenFileChangeLines([
      { path: 'a.ts', oldText: '', newText: 'only\n' },
    ])
    expect(lines).toEqual([{ kind: 'add', text: 'only' }])
  })

  it('skips empty sides', () => {
    expect(flattenFileChangeLines([
      { path: 'a.ts', oldText: '', newText: '' },
    ])).toEqual([])
  })

  it('keeps shared lines as context', () => {
    expect(flattenFileChangeLines([
      { path: 'a.ts', oldText: 'a\nb\nc', newText: 'a\nB\nc' },
    ]).map(line => line.kind)).toEqual(['ctx', 'del', 'add', 'ctx'])
  })
})

describe('relativizeToCwd', () => {
  it('leaves the path alone without a root, and strips posix or windows roots', () => {
    expect(relativizeToCwd('/ws/a.ts', undefined)).toBe('/ws/a.ts')
    expect(relativizeToCwd('/ws/a.ts', '')).toBe('/ws/a.ts')
    expect(relativizeToCwd('/ws/a.ts', '/ws/')).toBe('a.ts')
    expect(relativizeToCwd('C:\\ws\\a.ts', 'C:\\ws')).toBe('a.ts')
    expect(relativizeToCwd('/other/a.ts', '/ws')).toBe('/other/a.ts')
  })
})

describe('resolveWorkspacePath', () => {
  it('keeps absolute paths and joins relatives with the session cwd', () => {
    expect(resolveWorkspacePath('/ws', '/abs/a.ts')).toBe('/abs/a.ts')
    expect(resolveWorkspacePath('C:\\ws', 'C:\\abs\\a.ts')).toBe('C:\\abs\\a.ts')
    expect(resolveWorkspacePath('/ws/', 'notes/a.ts')).toBe('/ws/notes/a.ts')
    expect(resolveWorkspacePath('C:\\ws', 'notes\\a.ts')).toBe('C:\\ws\\notes\\a.ts')
    expect(resolveWorkspacePath(undefined, 'rel.ts')).toBe('rel.ts')
    expect(resolveWorkspacePath('', 'rel.ts')).toBe('rel.ts')
  })
})
