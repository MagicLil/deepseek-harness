import { describe, expect, it } from 'vitest'
import {
  fileUrlToPath,
  normalizeEditorPath,
  requestReveal,
  subscribeReveal,
  takeReveal,
} from '../src/client/editor-nav.ts'

describe('fileUrlToPath', () => {
  it('accepts file URIs and rejects jars / junk', () => {
    expect(fileUrlToPath('file:///ws/a.ts')).toBe('/ws/a.ts')
    expect(fileUrlToPath('file:///D:/work/Foo.java')?.toLowerCase()).toBe('d:\\work\\foo.java')
    expect(fileUrlToPath('file://localhost/C:/a.ts')?.toLowerCase()).toBe('c:\\a.ts')
    expect(fileUrlToPath('jdt://contents/Foo.class')).toBeUndefined()
    expect(fileUrlToPath('not a uri')).toBeUndefined()
    expect(fileUrlToPath('http://example/a.ts')).toBeUndefined()
    expect(fileUrlToPath('file://server/share/a.ts')).toBe('//server/share/a.ts')
  })
})

describe('reveal queue', () => {
  it('normalizes paths, notifies, and consumes once', () => {
    expect(normalizeEditorPath('d:\\ws\\A.java')).toBe('D:/ws/A.java')
    const seen: string[] = []
    const stop = subscribeReveal(() => { seen.push('x') })
    requestReveal('D:\\ws\\A.java', { line: 10, character: 2, end: 5 })
    expect(seen).toEqual(['x'])
    expect(takeReveal('d:/ws/A.java')).toEqual({ line: 10, character: 2, end: 5 })
    expect(takeReveal('d:/ws/A.java')).toBeUndefined()
    stop()
    requestReveal('D:\\ws\\A.java', { line: 1, character: 0 })
    expect(seen).toEqual(['x'])
    expect(takeReveal('D:/ws/A.java')).toEqual({ line: 1, character: 0 })
  })
})
