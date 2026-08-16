import { describe, expect, it, vi } from 'vitest'
import {
  bindEditorLsp,
  bindVueLsp,
  editorLspOffKey,
  isJavaPath,
  isTsPath,
  isVuePath,
  isLanguageWarmed,
  isLanguageWarming,
  languageClientFor,
  languageWarmKey,
  markLanguageWarmed,
  markLanguageWarmedKey,
  markLanguageWarmingKey,
  clearLanguageWarmingKey,
  shouldSuppressLspStarting,
  hoverWhenReady,
  HOVER_WAIT_MS,
  missingLanguageRemote,
  resetLanguageWarmth,
  peekEditorRemote,
  peekEditorRemotes,
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
    implementation: vi.fn(async () => ({ ok: true as const, value: { items: [] } })),
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
    expect(languageWarmKey('/a/Foo.java')).toBe('java')
    expect(languageWarmKey('/a/app.ts')).toBe('ts')
    expect(languageWarmKey('/a/App.vue')).toBe('vue')
    expect(languageWarmKey('/a/readme.md')).toBe('other')
    resetLanguageWarmth()
    expect(isLanguageWarmed('/a/Foo.java')).toBe(false)
    markLanguageWarmed('/a/Foo.java')
    expect(isLanguageWarmed('/b/Bar.java')).toBe(true)
    expect(isLanguageWarmed('/a/app.ts')).toBe(false)
    resetLanguageWarmth()
    expect(isLanguageWarmed('/a/Foo.java')).toBe(false)
    markLanguageWarmingKey('other')
    markLanguageWarmingKey('')
    markLanguageWarmedKey('other')
    markLanguageWarmedKey('')
    expect(isLanguageWarming('/a/Foo.java')).toBe(false)
    expect(shouldSuppressLspStarting('/a/readme.md')).toBe(false)
    markLanguageWarmingKey('java')
    expect(isLanguageWarming('/a/Foo.java')).toBe(true)
    expect(shouldSuppressLspStarting('/a/Foo.java')).toBe(true)
    markLanguageWarmingKey('java')
    markLanguageWarmedKey('java')
    expect(isLanguageWarmed('/a/Foo.java')).toBe(true)
    expect(isLanguageWarming('/a/Foo.java')).toBe(false)
    markLanguageWarmingKey('java')
    expect(isLanguageWarming('/a/Foo.java')).toBe(false)
    clearLanguageWarmingKey('ts')
    resetLanguageWarmth()
    markLanguageWarmingKey('ts')
    clearLanguageWarmingKey('ts')
    expect(isLanguageWarming('/a/app.ts')).toBe(false)
  })
})

describe('hoverWhenReady', () => {
  it('skips while warming, caches a card, and times out', async () => {
    const client = {
      open: vi.fn(async () => {}),
      change: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      complete: vi.fn(async () => []),
      diagnostics: vi.fn(async () => []),
      definition: vi.fn(async () => []),
      hover: vi.fn(async (): Promise<{ contents: string } | undefined> => ({ contents: 'doc' })),
      references: vi.fn(async () => []),
      implementation: vi.fn(async () => []),
    }
    resetLanguageWarmth()
    markLanguageWarmingKey('vue')
    expect(await hoverWhenReady(client, '/a/App.vue', 0, 1)).toBeUndefined()
    expect(client.hover).not.toHaveBeenCalled()
    markLanguageWarmedKey('vue')
    expect(await hoverWhenReady(client, '/a/App.vue', 0, 1)).toEqual({ contents: 'doc' })
    expect(await hoverWhenReady(client, '/a/App.vue', 0, 1)).toEqual({ contents: 'doc' })
    expect(client.hover).toHaveBeenCalledTimes(1)
    client.hover.mockResolvedValueOnce(undefined)
    expect(await hoverWhenReady(client, '/a/App.vue', 1, 0)).toBeUndefined()
    client.hover.mockImplementationOnce(() => new Promise(() => {}))
    vi.useFakeTimers()
    const pending = hoverWhenReady(client, '/a/App.vue', 2, 0)
    await vi.advanceTimersByTimeAsync(HOVER_WAIT_MS)
    expect(await pending).toBeUndefined()
    vi.useRealTimers()
    resetLanguageWarmth()
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
    expect(await client.implementation('/ws/a.ts', 0, 1)).toEqual([])
    host.hover = vi.fn(async () => ({ ok: true as const, value: {} }))
    expect(await client.hover('/ws/a.ts', 0, 1)).toBeUndefined()
    host.open = vi.fn(async () => ({ ok: false as const, error: { code: 'x', message: 'no' } }))
    await expect(client.open('/ws/a.ts', 'x')).rejects.toThrow(/tsLsp.open failed/)
    expect(bindVueLsp(host, '/ws')).toBeDefined()
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

describe('peekEditorRemote', () => {
  it('reads the Cordis remote.<key> service when the bag is empty', () => {
    const host = remote()
    expect(peekEditorRemote({}, 'javaLsp')).toBeUndefined()
    expect(peekEditorRemote({}, 'javaLsp', () => { throw new Error('down') })).toBeUndefined()
    expect(peekEditorRemote({}, 'javaLsp', key => key === 'remote.javaLsp' ? host : undefined)).toBe(host)
    expect(peekEditorRemote({ javaLsp: host }, 'javaLsp', () => { throw new Error('unused') })).toBe(host)
    expect(peekEditorRemotes({}, key => key === 'remote.tsLsp' ? host : undefined).tsLsp).toBe(host)
    expect(peekEditorRemotes({ vueLsp: host }).vueLsp).toBe(host)
  })
})

describe('editorLspOffKey', () => {
  it('names the missing piece instead of blaming the workspace', () => {
    const javaLsp = remote()
    expect(editorLspOffKey({ javaLsp }, '/ws', '/Foo.java')).toBeUndefined()
    expect(editorLspOffKey({ javaLsp }, '/ws', '/a.md')).toBe('editor.lspUnsupported')
    expect(editorLspOffKey({}, undefined, '/Foo.java')).toBe('editor.lspNoWorkspace')
    expect(editorLspOffKey({}, '/ws', '/Foo.java')).toBe('editor.lspNoRemote')
    expect(missingLanguageRemote({}, '/Foo.java')).toBe(true)
    expect(missingLanguageRemote({ javaLsp }, '/Foo.java')).toBe(false)
    expect(missingLanguageRemote({ vueLsp: javaLsp }, '/A.vue')).toBe(false)
    expect(missingLanguageRemote({ tsLsp: javaLsp }, '/a.ts')).toBe(false)
    expect(missingLanguageRemote({}, '/a.md')).toBe(false)
    expect(missingLanguageRemote({}, '/A.vue')).toBe(true)
    expect(missingLanguageRemote({}, '/a.ts')).toBe(true)
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
