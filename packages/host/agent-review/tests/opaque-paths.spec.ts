import { describe, expect, it } from 'vitest'
import { tmpdir } from 'node:os'
import { join, resolve as resolvePath } from 'node:path'
import { extractOpaquePaths, pathLooksWritten, resultMentionsPath } from '../src/opaque-paths.ts'

describe('extractOpaquePaths', () => {
  it('joins a Windows directory with a mentioned filename', () => {
    const paths = extractOpaquePaths({
      prompt: 'create temp-who-are-you.txt at D:\\work\\company\\sanmu',
    }, undefined, undefined)
    expect(paths).toContain(resolvePath('D:\\work\\company\\sanmu', 'temp-who-are-you.txt'))
  })

  it('keeps an absolute path from the result text', () => {
    const abs = resolvePath('D:\\work\\company\\sanmu\\temp-who-are-you.txt')
    const paths = extractOpaquePaths(
      { prompt: 'write a file' },
      { content: [{ type: 'text', text: `created ${abs}` }] },
      undefined,
    )
    expect(paths).toContain(abs)
  })

  it('resolves a relative name against cwd', () => {
    const cwd = resolvePath('D:\\work\\company\\sanmu')
    const paths = extractOpaquePaths(
      { prompt: 'create temp-who-are-you.txt' },
      undefined,
      cwd,
    )
    expect(paths).toContain(resolvePath(cwd, 'temp-who-are-you.txt'))
  })

  it('skips urls and globs', () => {
    const paths = extractOpaquePaths({
      prompt: 'see https://example.com/a.ts and skip *.log',
    }, undefined, undefined)
    expect(paths.some(path => path.includes('example.com'))).toBe(false)
    expect(paths.some(path => path.includes('*.log'))).toBe(false)
  })

  it('reads arrays, result values, quoted relatives, and posix abs', () => {
    const cwd = join(tmpdir(), 'opaque-ws')
    const fromArray = extractOpaquePaths(['note.txt'], undefined, cwd)
    expect(fromArray).toContain(resolvePath(cwd, 'note.txt'))
    const absOut = join(cwd, 'out.ts').replaceAll('\\', '/')
    const fromValue = extractOpaquePaths(
      {},
      { value: `wrote ${absOut}` },
      undefined,
    )
    expect(fromValue.some(path => path.replaceAll('\\', '/').endsWith('out.ts'))).toBe(true)
    const fromObjectValue = extractOpaquePaths(
      {},
      { value: { path: 'lib/app.ts' } },
      cwd,
    )
    expect(fromObjectValue).toContain(resolvePath(cwd, 'lib/app.ts'))
    const quoted = extractOpaquePaths({ prompt: 'edit `src/foo.ts`' }, undefined, cwd)
    expect(quoted).toContain(resolvePath(cwd, 'src/foo.ts'))
    const posix = extractOpaquePaths({ prompt: 'see /tmp/ws/out.ts' }, undefined, undefined)
    expect(posix).toContain('/tmp/ws/out.ts')
  })

  it('skips empty content blocks, deep nests, and overlong strings', () => {
    const cwd = join(tmpdir(), 'opaque-ws')
    const deep = { a: { b: { c: { d: { e: { f: { g: { h: 'deep.ts' } } } } } } } }
    expect(extractOpaquePaths(deep, undefined, cwd).some(path => path.endsWith('deep.ts'))).toBe(false)
    expect(extractOpaquePaths({ prompt: 'x'.repeat(9000) }, undefined, cwd)).toEqual([])
    expect(extractOpaquePaths(
      {},
      { content: [null, 1, { type: 'image' }, { type: 'text', text: 3 }] },
      cwd,
    )).toEqual([])
  })

  it('caps the number of extracted paths', () => {
    const names = Array.from({ length: 50 }, (_, i) => `f${i}.txt`).join(' ')
    expect(extractOpaquePaths({ prompt: names }, undefined, '/tmp').length).toBe(40)
  })

  it('drops quoted non-paths and unescapes doubled Windows slashes', () => {
    const cwd = join(tmpdir(), 'opaque-ws')
    expect(extractOpaquePaths({ prompt: '"x" "noext" "foo*.txt"' }, undefined, cwd)).toEqual([])
    expect(extractOpaquePaths(
      { prompt: 'create src/foo.ts at D:\\work\\company\\sanmu' },
      undefined,
      cwd,
    ).some(path => path.replaceAll('\\', '/').endsWith('src/foo.ts'))).toBe(true)
    expect(extractOpaquePaths({ prompt: '"https://example.com/page"' }, undefined, cwd)).toEqual([])
    expect(extractOpaquePaths({ prompt: `"${'a'.repeat(513)}.txt"` }, undefined, cwd)).toEqual([])
    const doubled = 'D:\\\\work\\\\company\\\\sanmu\\\\a.txt'
    const unescaped = extractOpaquePaths({ prompt: doubled }, undefined, undefined)
    expect(unescaped.some(path => path.replaceAll('/', '\\').includes('work\\company\\sanmu\\a.txt'))).toBe(true)
  })
})

describe('pathLooksWritten', () => {
  it('matches a create-or-overwrite prompt for the named file', () => {
    const path = resolvePath('D:\\work\\company\\sanmu\\temp-who-are-you.txt')
    expect(pathLooksWritten({
      prompt: '在当前工作区 D:\\work\\company\\sanmu 中创建或覆盖临时文本文件 temp-who-are-you.txt',
    }, path)).toBe(true)
  })

  it('rejects a mention without a write verb', () => {
    expect(pathLooksWritten({ prompt: 'touch keep.txt' }, resolvePath('/tmp/keep.txt'))).toBe(false)
  })
})

describe('resultMentionsPath', () => {
  it('matches a basename in the result text', () => {
    const path = resolvePath('D:\\work\\company\\sanmu\\temp-who-are-you.txt')
    expect(resultMentionsPath(
      { content: [{ type: 'text', text: `文件已写好：${path}` }] },
      path,
      undefined,
    )).toBe(true)
  })
})
