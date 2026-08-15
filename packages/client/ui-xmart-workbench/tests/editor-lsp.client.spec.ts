import { describe, expect, it, vi } from 'vitest'
import {
  bindEditorLsp,
  isJavaPath,
  isTsPath,
  isVuePath,
  languageClientFor,
  type EditorLspRemote,
} from '../src/client/editor-lsp.ts'

function remote(): EditorLspRemote {
  return {
    open: vi.fn(async () => ({ ok: true, value: undefined })),
    change: vi.fn(async () => ({ ok: true, value: undefined })),
    close: vi.fn(async () => ({ ok: true, value: undefined })),
    complete: vi.fn(async () => ({ ok: true, value: { items: [{ label: 'a' }] } })),
    diagnostics: vi.fn(async () => ({ ok: true, value: { items: [] } })),
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
    host.open = vi.fn(async () => ({ ok: false, error: { code: 'x', message: 'no' } }))
    await expect(client.open('/ws/a.ts', 'x')).rejects.toThrow(/tsLsp.open failed/)
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
