import { describe, expect, it } from 'vitest'
import { iconDataUri, iconSvg, resolveIconId, type IconThemeData } from '../src/client/file-icon.ts'

const theme: IconThemeData = {
  file: 'file',
  folder: 'folder',
  folderExpanded: 'folder-open',
  fileNames: { 'package.json': 'nodejs', dockerfile: 'docker' },
  fileExtensions: { java: 'java', ts: 'typescript', 'd.ts': 'typescript-def', yaml: 'yaml', 'i18n.yaml': 'i18n' },
  folderNames: { src: 'folder-src', '.github': 'folder-github' },
  folderNamesExpanded: { src: 'folder-src-open', '.github': 'folder-github-open' },
  svgs: { file: '<svg id="file"/>', java: '<svg id="java"/>' },
}

describe('resolveIconId', () => {
  it('matches file names, longest extensions, and defaults', () => {
    expect(resolveIconId('package.json', 'file', false, theme)).toBe('nodejs')
    expect(resolveIconId('Dockerfile', 'file', false, theme)).toBe('docker')
    expect(resolveIconId('C:\\ws\\Foo.java', 'file', false, theme)).toBe('java')
    expect(resolveIconId('a.ts', 'file', false, theme)).toBe('typescript')
    expect(resolveIconId('foo.d.ts', 'file', false, theme)).toBe('typescript-def')
    expect(resolveIconId('agent-lifecycle.i18n.yaml', 'file', false, theme)).toBe('i18n')
    expect(resolveIconId('plain.yaml', 'file', false, theme)).toBe('yaml')
    expect(resolveIconId('foo.bar.ts', 'file', false, theme)).toBe('typescript')
    expect(resolveIconId('notes.zzz', 'file', false, theme)).toBe('file')
    expect(resolveIconId('README', 'file', false, theme)).toBe('file')
    expect(resolveIconId('', 'file', false, theme)).toBe('file')
  })

  it('matches special folders and open vs closed defaults', () => {
    expect(resolveIconId('src', 'directory', false, theme)).toBe('folder-src')
    expect(resolveIconId('SRC', 'directory', true, theme)).toBe('folder-src-open')
    expect(resolveIconId('.github', 'directory', false, theme)).toBe('folder-github')
    expect(resolveIconId('misc', 'directory', false, theme)).toBe('folder')
    expect(resolveIconId('misc', 'directory', true, theme)).toBe('folder-open')
  })
})

describe('iconSvg and iconDataUri', () => {
  it('returns the named svg, then the file fallback, then empty', () => {
    expect(iconSvg('java', theme)).toBe('<svg id="java"/>')
    expect(iconSvg('missing', theme)).toBe('<svg id="file"/>')
    expect(iconSvg('missing', { ...theme, svgs: {} })).toBe('')
  })

  it('caches data URIs', () => {
    const first = iconDataUri('<svg id="java"/>')
    const second = iconDataUri('<svg id="java"/>')
    expect(first).toContain('data:image/svg+xml')
    expect(first).toBe(second)
    expect(decodeURIComponent(first.slice(first.indexOf(',') + 1))).toBe('<svg id="java"/>')
  })
})

describe('generated theme', () => {
  it('resolves common workspace names through the baked Material tables', () => {
    expect(resolveIconId('MethodFormat.java', 'file')).toBe('java')
    expect(resolveIconId('a.ts', 'file')).toBe('typescript')
    expect(resolveIconId('package.json', 'file')).toBe('nodejs')
    expect(resolveIconId('src', 'directory')).toBe('folder-src')
    expect(resolveIconId('src', 'directory', true)).toBe('folder-src-open')
    expect(iconSvg('java')).toContain('<svg')
  })
})
