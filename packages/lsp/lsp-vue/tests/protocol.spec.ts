import { describe, expect, it } from 'vitest'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { fileUrlFor, isVuePath, normalizeCompletions, normalizeDiagnostics } from '../src/protocol.ts'

describe('fileUrlFor', () => {
  it('joins a relative path and encodes an absolute path', () => {
    const root = process.platform === 'win32' ? 'C:\\ws' : '/ws'
    const relative = fileUrlFor(root, 'App.vue')
    expect(relative).toBe(pathToFileURL(join(root, 'App.vue')).href)
    const abs = join(root, 'src', 'Hi.vue')
    expect(fileUrlFor(root, abs)).toBe(pathToFileURL(abs).href)
  })
})

describe('isVuePath', () => {
  it('matches a final .vue extension on either separator', () => {
    expect(isVuePath('/a/App.vue')).toBe(true)
    expect(isVuePath('C:\\a\\App.VUE')).toBe(true)
    expect(isVuePath('/a/App.ts')).toBe(false)
    expect(isVuePath('/a/.vue')).toBe(false)
    expect(isVuePath('vue')).toBe(false)
  })
})

describe('normalizeCompletions', () => {
  it('reads a list, a CompletionList, and skips junk', () => {
    expect(normalizeCompletions(null)).toEqual([])
    expect(normalizeCompletions(undefined)).toEqual([])
    expect(normalizeCompletions({ items: [
      { label: 'a', insertText: 'A', detail: 'd', kind: 3 },
      { label: '' },
      { insertText: 'x' },
      null,
      'nope',
    ] })).toEqual([{ label: 'a', insertText: 'A', detail: 'd', kind: 3 }])
    expect(normalizeCompletions([{ label: 'b', kind: 1.5 }])).toEqual([{ label: 'b' }])
    expect(normalizeCompletions({ nope: true })).toEqual([])
  })
})

describe('normalizeDiagnostics', () => {
  it('keeps well-formed ranges and defaults severity', () => {
    expect(normalizeDiagnostics(null)).toEqual([])
    expect(normalizeDiagnostics([{ message: 'x' }])).toEqual([])
    expect(normalizeDiagnostics([{
      message: 'bad',
      source: 'vue',
      range: { start: { line: 1, character: 2 }, end: { line: 1, character: 4 } },
    }])).toEqual([{
      message: 'bad',
      severity: 1,
      source: 'vue',
      startLine: 1,
      startCharacter: 2,
      endLine: 1,
      endCharacter: 4,
    }])
    expect(normalizeDiagnostics([
      { message: '', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } },
      null,
      { message: 'ok', severity: 2, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } },
      { message: 'no-end', range: { start: { line: 0, character: 0 } } },
    ])).toEqual([{
      message: 'ok',
      severity: 2,
      startLine: 0,
      startCharacter: 0,
      endLine: 0,
      endCharacter: 1,
    }])
  })
})
