import { describe, expect, it, vi } from 'vitest'
import {
  bindEditorLsp,
  isJavaPath,
  isTsPath,
  isVuePath,
  languageClientFor,
  peekRemote,
  type EditorLspRemote,
} from '../src/client/editor-lsp.ts'

function remote(): EditorLspRemote {
  return {
    open: vi.fn(async () => ({ ok: true as const, value: undefined })),
    change: vi.fn(async () => ({ ok: true as const, value: undefined })),
    close: vi.fn(async () => ({ ok: true as const, value: undefined })),
    complete: vi.fn(async () => ({ ok: true as const, value: { items: [{ label: 'a' }] } })),
    diagnostics: vi.fn(async () => ({ ok: true as const, value: { items: [] } })),
    definition: vi.fn(async () => ({
      ok: true as const,
      value: { items: [{ uri: 'file:///a.ts', startLine: 1, startCharacter: 0, endLine: 1, endCharacter: 2 }] },
    })),
    hover: vi.fn(async () => ({ ok: true as const, value: { contents: 'doc' } })),
    references: vi.fn(async () => ({ ok: true as const, value: { items: [] } })),
  }
}

describe('path helpers', () => {
  it('classifies Vue / TypeScript / Java paths', () => {
    expect(isVuePath('/a/App.vue')).toBe(true)
    expect(isTsPath('/a/app.ts')).toBe(true)
    expect(isTsPath('/a/app.tsx')).toBe(true)
    expect(isTsPath('/a/app.js')).toBe(true)
    expect(isTsPath('/a/App.vue')).toBe(false)
    expect(isJavaPath('/a/Foo.java')).toBe(true)
    expect(isJavaPath('C:\\a\\Foo.JAVA')).toBe(true)
    expect(isJavaPath('/a/Foo.kt')).toBe(false)
    expect(isTsPath('plain')).toBe(false)
    expect(isTsPath('/a/.env')).toBe(false)
  })
})

describe('bindEditorLsp', () => {
  it('unwraps successful remotes and throws on a wire error', async () => {
    const host = remote()
    const client = bindEditorLsp(host, '/ws', 'tsLsp')
    await client.open('/ws/a.ts', 'x')
    await client.change('/ws/a.ts', 'y')
    await client.close('/ws/a.ts')
    expect(await client.complete('/ws/a.ts', 0, 1)).toEqual([{ label: 'a' }])
    expect(await client.diagnostics('/ws/a.ts')).toEqual([])
    expect(await client.definition('/ws/a.ts', 0, 1)).toEqual([
      { uri: 'file:///a.ts', startLine: 1, startCharacter: 0, endLine: 1, endCharacter: 2 },
    ])
    expect(await client.hover('/ws/a.ts', 0, 1)).toEqual({ contents: 'doc' })
    expect(await client.references('/ws/a.ts', 0, 1)).toEqual([])
    host.hover = vi.fn(async () => ({ ok: true as const, value: {} }))
    expect(await client.hover('/ws/a.ts', 0, 1)).toBeUndefined()
    host.open = vi.fn(async () => ({ ok: false as const, error: { code: 'x', message: 'no' } }))
    await expect(client.open('/ws/a.ts', 'x')).rejects.toThrow(/tsLsp.open failed/)
  })
})

describe('peekRemote', () => {
  it('returns a live Remote and swallows a throwing getter', () => {
    const host = remote()
    expect(peekRemote(undefined, 'javaLsp')).toBeUndefined()
    expect(peekRemote(null, 'tsLsp')).toBeUndefined()
    expect(peekRemote('x', 'vueLsp')).toBeUndefined()
    expect(peekRemote({}, 'javaLsp')).toBeUndefined()
    expect(peekRemote({ javaLsp: 1 }, 'javaLsp')).toBeUndefined()
    expect(peekRemote({ javaLsp: null }, 'javaLsp')).toBeUndefined()
    expect(peekRemote({ javaLsp: {} }, 'javaLsp')).toBeUndefined()
    expect(peekRemote({ javaLsp: host }, 'javaLsp')).toBe(host)
    expect(peekRemote({ tsLsp: host }, 'tsLsp')).toBe(host)
    expect(peekRemote({
      get javaLsp() { throw new Error('down') },
    }, 'javaLsp')).toBeUndefined()
  })
})

describe('languageClientFor', () => {
  it('picks the Remote that owns the extension', () => {
    const vueLsp = remote()
    const tsLsp = remote()
    const javaLsp = remote()
    expect(languageClientFor({ vueLsp, tsLsp, javaLsp }, undefined, '/a.ts')).toBeUndefined()
    expect(languageClientFor({ vueLsp, tsLsp, javaLsp }, '', '/a.ts')).toBeUndefined()
    expect(languageClientFor({ vueLsp, tsLsp, javaLsp }, '/ws', '/A.vue')).toBeDefined()
    expect(languageClientFor({ vueLsp, tsLsp, javaLsp }, '/ws', '/a.ts')).toBeDefined()
    expect(languageClientFor({ vueLsp, tsLsp, javaLsp }, '/ws', '/Foo.java')).toBeDefined()
    expect(languageClientFor({ vueLsp }, '/ws', '/a.ts')).toBeUndefined()
    expect(languageClientFor({ tsLsp }, '/ws', '/A.vue')).toBeUndefined()
    expect(languageClientFor({ vueLsp, tsLsp, javaLsp }, '/ws', '/a.md')).toBeUndefined()
  })
})
