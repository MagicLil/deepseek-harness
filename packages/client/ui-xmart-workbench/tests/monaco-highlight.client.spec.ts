import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EDITOR_DARK_THEME, EDITOR_LIGHT_THEME, highlightSource, prepareMonacoHighlight,
  resetMonacoHighlight, shikiRegexConstructor,
} from '../src/client/monaco-highlight.ts'

const { createHighlighterCore, shikiToMonaco } = vi.hoisted(() => ({
  createHighlighterCore: vi.fn(async (_options?: unknown) => ({
    id: 'core',
    codeToTokens: (code: string) => ({
      tokens: code.split('\n').map(line => [{ content: line, color: '#ff00aa' }]),
    }),
  })),
  shikiToMonaco: vi.fn(),
}))

vi.mock('shiki/core', () => ({
  createHighlighterCore: (options: unknown) => createHighlighterCore(options),
}))

vi.mock('@shikijs/monaco', () => ({
  shikiToMonaco: (core: unknown, monaco: unknown) => shikiToMonaco(core, monaco),
}))

function monacoStub() {
  return {
    languages: {
      register: vi.fn(),
      setMonarchTokensProvider: vi.fn(),
    },
  }
}

afterEach(() => {
  resetMonacoHighlight()
  createHighlighterCore.mockClear()
  shikiToMonaco.mockClear()
})

describe('prepareMonacoHighlight', () => {
  it('compiles Shiki patterns eagerly', () => {
    expect(shikiRegexConstructor('abc').test('abc')).toBe(true)
  })

  it('registers Shiki langs once and reuses the highlighter', async () => {
    expect(EDITOR_DARK_THEME).toBe('one-dark-pro')
    expect(EDITOR_LIGHT_THEME).toBe('min-light')
    const monaco = monacoStub()
    await expect(prepareMonacoHighlight(monaco as never, '/a.ts')).resolves.toBe('typescript')
    await expect(prepareMonacoHighlight(monaco as never, '/b.ts')).resolves.toBe('typescript')
    expect(createHighlighterCore).toHaveBeenCalledOnce()
    expect(monaco.languages.register).toHaveBeenCalledWith({ id: 'typescript' })
    expect(monaco.languages.register).toHaveBeenCalledOnce()
    expect(shikiToMonaco).toHaveBeenCalledTimes(2)
  })

  it('installs a Monarch ignore grammar and leaves plaintext / Monaco builtins alone', async () => {
    const monaco = monacoStub()
    await expect(prepareMonacoHighlight(monaco as never, '/.prettierignore')).resolves.toBe('gitignore')
    await expect(prepareMonacoHighlight(monaco as never, '/.gitignore')).resolves.toBe('gitignore')
    expect(monaco.languages.register).toHaveBeenCalledWith({ id: 'gitignore' })
    expect(monaco.languages.setMonarchTokensProvider).toHaveBeenCalledOnce()
    await expect(prepareMonacoHighlight(monaco as never, '/README')).resolves.toBe('plaintext')
    await expect(prepareMonacoHighlight(monaco as never, '/Main.rs')).resolves.toBe('rust')
    expect(monaco.languages.register).not.toHaveBeenCalledWith({ id: 'plaintext' })
    expect(monaco.languages.register).not.toHaveBeenCalledWith({ id: 'rust' })
  })

  it('tokenizes source for the diff viewer and falls back to plaintext', async () => {
    await expect(highlightSource('', 'typescript', true)).resolves.toEqual([])
    await expect(highlightSource('plain', 'plaintext', false)).resolves.toEqual([[{ text: 'plain' }]])
    await expect(highlightSource('const x', 'typescript', true)).resolves.toEqual([
      [{ text: 'const x', color: '#ff00aa' }],
    ])
    resetMonacoHighlight()
    createHighlighterCore.mockResolvedValueOnce({
      codeToTokens: (code: string) => ({
        tokens: code.split('\n').map(line => [{ content: line }]),
      }),
    })
    await expect(highlightSource('x', 'java', true)).resolves.toEqual([[{ text: 'x' }]])
    resetMonacoHighlight()
    createHighlighterCore.mockResolvedValueOnce({
      codeToTokens: () => { throw new Error('bad grammar') },
    })
    await expect(highlightSource('x', 'typescript', false)).resolves.toEqual([[{ text: 'x' }]])
  })
})
