import { describe, expect, it } from 'vitest'
import { editorLspPaths, lspDocsToClose, lspOpenText } from '../src/client/editor-lsp-sync.ts'

describe('editorLspPaths', () => {
  it('keeps unique supported editor paths and skips the rest', () => {
    expect(editorLspPaths([
      { type: 'editor', path: '/A.java' },
      { type: 'editor', path: '/A.java' },
      { type: 'editor', path: '/a.ts' },
      { type: 'editor', path: '/App.vue' },
      { type: 'editor', path: '/readme.md' },
      { type: 'editor' },
      { type: 'editor', path: '' },
      { type: 'demo', path: '/B.java' },
    ])).toEqual(['/A.java', '/a.ts', '/App.vue'])
  })
})

describe('lspDocsToClose', () => {
  it('drops paths that are no longer wanted', () => {
    expect(lspDocsToClose(['/A.java', '/B.java'], ['/A.java'])).toEqual(['/B.java'])
    expect(lspDocsToClose(['/A.java'], ['/A.java', '/C.java'])).toEqual([])
  })
})

describe('lspOpenText', () => {
  it('prefers a draft, then disk, then empty', async () => {
    expect(await lspOpenText('/a.ts', 'draft', async () => 'disk')).toBe('draft')
    expect(await lspOpenText('/a.ts', undefined, async () => 'disk')).toBe('disk')
    expect(await lspOpenText('/a.ts', undefined, undefined)).toBe('')
    expect(await lspOpenText('/a.ts', undefined, async () => {
      throw new Error('gone')
    })).toBe('')
  })
})
