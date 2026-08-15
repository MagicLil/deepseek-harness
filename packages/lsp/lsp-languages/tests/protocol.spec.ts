import { describe, expect, it } from 'vitest'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import {
  extensionOf,
  fileUrlFor,
  isJavaPath,
  isTsPath,
  languageIdFor,
  normalizeCompletions,
  normalizeDiagnostics,
  TS_EXTENSION_TO_LANGUAGE,
} from '../src/protocol.ts'

describe('extensionOf / language maps', () => {
  it('reads a final extension on either separator and ignores dotfiles', () => {
    expect(extensionOf('/a/App.ts')).toBe('.ts')
    expect(extensionOf('C:\\a\\App.TSX')).toBe('.tsx')
    expect(extensionOf('/a/.env')).toBe('')
    expect(extensionOf('plain')).toBe('')
    expect(languageIdFor('a.ts', TS_EXTENSION_TO_LANGUAGE)).toBe('typescript')
    expect(languageIdFor('a.unknown', TS_EXTENSION_TO_LANGUAGE)).toBe('plaintext')
  })
})

describe('isTsPath / isJavaPath', () => {
  it('claims TS/JS siblings and Java, not Vue', () => {
    expect(isTsPath('/a/app.ts')).toBe(true)
    expect(isTsPath('/a/app.tsx')).toBe(true)
    expect(isTsPath('/a/app.mts')).toBe(true)
    expect(isTsPath('/a/app.cts')).toBe(true)
    expect(isTsPath('/a/app.js')).toBe(true)
    expect(isTsPath('/a/app.jsx')).toBe(true)
    expect(isTsPath('/a/app.mjs')).toBe(true)
    expect(isTsPath('/a/app.cjs')).toBe(true)
    expect(isTsPath('/a/App.vue')).toBe(false)
    expect(isTsPath('/a/Foo.java')).toBe(false)
    expect(isJavaPath('/a/Foo.java')).toBe(true)
    expect(isJavaPath('C:\\a\\Foo.JAVA')).toBe(true)
    expect(isJavaPath('/a/Foo.kt')).toBe(false)
  })
})

describe('fileUrlFor', () => {
  it('joins a relative path and encodes an absolute path', () => {
    const root = process.platform === 'win32' ? 'C:\\ws' : '/ws'
    const relative = fileUrlFor(root, 'app.ts')
    expect(relative).toBe(pathToFileURL(join(root, 'app.ts')).href)
    const abs = join(root, 'src', 'hi.ts')
    expect(fileUrlFor(root, abs)).toBe(pathToFileURL(abs).href)
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
      source: 'ts',
      range: { start: { line: 1, character: 2 }, end: { line: 1, character: 4 } },
    }])).toEqual([{
      message: 'bad',
      severity: 1,
      source: 'ts',
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
