import { describe, expect, it } from 'vitest'
import { parseShellDeletePaths } from '../src/shell-delete-paths.ts'

describe('parseShellDeletePaths', () => {
  it('parses PowerShell Remove-Item and aliases', () => {
    expect(parseShellDeletePaths('Remove-Item tmp-test-file.txt')).toEqual([
      'tmp-test-file.txt',
    ])
    expect(parseShellDeletePaths('ri -Force "./a.txt"')).toEqual(['./a.txt'])
    expect(parseShellDeletePaths("del 'D:\\x\\y.txt'")).toEqual(['D:\\x\\y.txt'])
    expect(parseShellDeletePaths('Erase -LiteralPath C:\\a\\b.txt')).toEqual([
      'C:\\a\\b.txt',
    ])
  })

  it('parses multiple paths and skips globs', () => {
    expect(parseShellDeletePaths('Remove-Item a.txt, b.txt')).toEqual([
      'a.txt',
      'b.txt',
    ])
    expect(parseShellDeletePaths('Remove-Item *.tmp')).toEqual([])
    expect(parseShellDeletePaths('rm -f foo.txt bar.txt')).toEqual([
      'foo.txt',
      'bar.txt',
    ])
  })

  it('parses unlink and ignores empty / flag-only', () => {
    expect(parseShellDeletePaths('unlink ./gone.txt')).toEqual(['./gone.txt'])
    expect(parseShellDeletePaths('rm -rf')).toEqual([])
    expect(parseShellDeletePaths('')).toEqual([])
  })
})
