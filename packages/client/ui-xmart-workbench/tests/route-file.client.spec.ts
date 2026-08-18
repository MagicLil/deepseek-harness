import { describe, expect, it, vi } from 'vitest'
import {
  absPath, basename, dirname, hasNulByte, isSingleSegment, isUnder, joinPath, relativeTo, rewritePath, tabTypeForViewer,
} from '../src/client/route-file.ts'
import { isMarkdownPath, languageFromPath } from '../src/client/language-from-path.ts'
import { indexGitChanges, letter, markKind } from '../src/client/git-marks.ts'
import { noteFsTouch } from '../src/client/fs-touch.ts'

describe('route-file helpers', () => {
  it('maps viewers and sniffs NUL', () => {
    expect(tabTypeForViewer('image')).toBe('image')
    expect(tabTypeForViewer('binary-download')).toBe('binary')
    expect(tabTypeForViewer('code')).toBe('editor')
    expect(tabTypeForViewer(undefined)).toBe('editor')
    expect(hasNulByte(new Uint8Array([1, 2]))).toBe(false)
    expect(hasNulByte(new Uint8Array([1, 0, 2]))).toBe(true)
  })

  it('joins, relatives, and basenames on both separators', () => {
    expect(basename('C:\\proj\\main.ts')).toBe('main.ts')
    expect(basename('')).toBe('')
    expect(dirname('/ws/a.ts')).toBe('/ws')
    expect(dirname('C:\\ws\\a.ts')).toBe('C:\\ws')
    expect(dirname('/a.ts')).toBe('/')
    expect(dirname('a.ts')).toBe('a.ts')
    expect(joinPath('/ws', 'a.ts')).toBe('/ws/a.ts')
    expect(joinPath('C:\\ws\\', 'a.ts')).toBe('C:\\ws\\a.ts')
    expect(absPath('C:\\repo', 'src/a.ts')).toBe('C:\\repo\\src\\a.ts')
    expect(relativeTo('/ws', '/ws')).toBe('')
    expect(relativeTo('/ws', '/ws/a.ts')).toBe('a.ts')
    expect(relativeTo('C:\\ws', 'C:\\ws\\a.ts')).toBe('a.ts')
    expect(relativeTo('/ws', '/other')).toBe('/other')
    expect(isUnder('/ws', '/ws')).toBe(true)
    expect(isUnder('/ws/a', '/ws')).toBe(true)
    expect(isUnder('C:\\ws\\a', 'C:\\ws')).toBe(true)
    expect(isUnder('/other', '/ws')).toBe(false)
    expect(isSingleSegment('a.ts')).toBe(true)
    expect(isSingleSegment('  ')).toBe(false)
    expect(isSingleSegment('a/b')).toBe(false)
    expect(isSingleSegment('a\\b')).toBe(false)
    expect(rewritePath('/ws/a.ts', '/ws/a.ts', '/ws/b.ts')).toBe('/ws/b.ts')
    expect(rewritePath('/ws/src/a.ts', '/ws/src', '/ws/lib')).toBe('/ws/lib/a.ts')
    expect(rewritePath('C:\\ws\\src\\a.ts', 'C:\\ws\\src', 'C:\\ws\\lib')).toBe('C:\\ws\\lib\\a.ts')
    expect(rewritePath('/other', '/ws', '/x')).toBe('/other')
  })
})

describe('language-from-path', () => {
  it('maps extensions, exact names, and treats unknowns as plaintext', () => {
    expect(languageFromPath('/a.ts')).toBe('typescript')
    expect(languageFromPath('/a.vue')).toBe('html')
    expect(languageFromPath('/a.md')).toBe('markdown')
    expect(languageFromPath('/a.mdc')).toBe('markdown')
    expect(languageFromPath('/build.gradle')).toBe('groovy')
    expect(languageFromPath('C:\\ws\\settings.gradle')).toBe('groovy')
    expect(languageFromPath('/gradle.properties')).toBe('properties')
    expect(languageFromPath('/.prettierignore')).toBe('gitignore')
    expect(languageFromPath('/.stylelintignore')).toBe('gitignore')
    expect(languageFromPath('/.oxfmtrc.json')).toBe('json')
    expect(languageFromPath('/.gitignore')).toBe('gitignore')
    expect(languageFromPath('/.npmrc')).toBe('ini')
    expect(languageFromPath('/.prettierrc')).toBe('json')
    expect(languageFromPath('/.eslintrc.js')).toBe('javascript')
    expect(languageFromPath('/commitlint.config.js')).toBe('javascript')
    expect(languageFromPath('/gradlew')).toBe('shellscript')
    expect(languageFromPath('/gradlew.bat')).toBe('bat')
    expect(languageFromPath('/Dockerfile')).toBe('docker')
    expect(languageFromPath('/.env')).toBe('dotenv')
    expect(languageFromPath('/.env.local')).toBe('dotenv')
    expect(languageFromPath('/foo.bar.ts')).toBe('typescript')
    expect(languageFromPath('/a')).toBe('plaintext')
    expect(languageFromPath('')).toBe('plaintext')
    expect(languageFromPath('/a.unknown')).toBe('plaintext')
    expect(isMarkdownPath('/a.md')).toBe(true)
    expect(isMarkdownPath('/a.ts')).toBe(false)
  })
})

describe('git-marks', () => {
  it('letters, colors, and absolute index', () => {
    expect(letter('modified')).toBe('M')
    expect(letter('added')).toBe('A')
    expect(letter('deleted')).toBe('D')
    expect(letter('untracked')).toBe('U')
    expect(letter('renamed')).toBe('R')
    expect(letter('conflict')).toBe('C')
    expect(markKind('modified')).toBe('modified')
    expect(markKind('added')).toBe('added')
    expect(markKind('untracked')).toBe('added')
    expect(markKind('deleted')).toBe('deleted')
    expect(markKind('conflict')).toBe('deleted')
    expect(markKind('renamed')).toBe('renamed')
    expect(indexGitChanges({
      root: '/repo', branch: 'main', ahead: 0, behind: 0, detached: false,
      changes: [
        { path: 'a.ts', status: 'added', area: 'index' },
        { path: 'a.ts', status: 'modified', area: 'worktree' },
      ],
    })).toEqual({ '/repo/a.ts': 'modified' })
  })
})

describe('noteFsTouch', () => {
  it('gates on seq and skips empty path lists', () => {
    const files = { bumpRefresh: vi.fn(), markReload: vi.fn() }
    expect(noteFsTouch(files, 3, 2, ['/a'], ['/a'])).toBe(3)
    expect(files.bumpRefresh).not.toHaveBeenCalled()
    expect(noteFsTouch(files, 3, 4, [], [])).toBe(4)
    expect(files.bumpRefresh).not.toHaveBeenCalled()
    expect(noteFsTouch(files, 4, 5, ['/a'], ['/a'])).toBe(5)
    expect(files.bumpRefresh).toHaveBeenCalledOnce()
    expect(files.markReload).toHaveBeenCalledWith(['/a'])
  })
})
