import { describe, expect, it } from 'vitest'
import { gitFileKind, gitPathParts } from '../src/client/git-display.ts'

describe('gitPathParts', () => {
  it('splits a nested path and keeps a bare name', () => {
    expect(gitPathParts('src/foo/a.ts')).toEqual({ name: 'a.ts', dir: 'src/foo' })
    expect(gitPathParts('a.ts')).toEqual({ name: 'a.ts', dir: '' })
    expect(gitPathParts('src\\b.tsx')).toEqual({ name: 'b.tsx', dir: 'src' })
  })
})

describe('gitFileKind', () => {
  it('maps common extensions and falls back', () => {
    expect(gitFileKind('a.ts')).toBe('ts')
    expect(gitFileKind('a.tsx')).toBe('tsx')
    expect(gitFileKind('a.js')).toBe('js')
    expect(gitFileKind('a.jsx')).toBe('js')
    expect(gitFileKind('a.mjs')).toBe('js')
    expect(gitFileKind('a.cjs')).toBe('js')
    expect(gitFileKind('a.css')).toBe('css')
    expect(gitFileKind('a.scss')).toBe('css')
    expect(gitFileKind('a.less')).toBe('css')
    expect(gitFileKind('README.md')).toBe('md')
    expect(gitFileKind('NOTES.markdown')).toBe('md')
    expect(gitFileKind('page.mdx')).toBe('md')
    expect(gitFileKind('a.json')).toBe('json')
    expect(gitFileKind('a.jsonc')).toBe('json')
    expect(gitFileKind('Makefile')).toBe('other')
    expect(gitFileKind('a.')).toBe('other')
    expect(gitFileKind('a.py')).toBe('other')
  })
})
