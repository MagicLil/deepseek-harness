import { describe, expect, it, vi } from 'vitest'
import type { FileListing } from '@deepseek-ai/dsh-client-runtime/client'
import {
  collectWarmProjects,
  findSeedFile,
  languagesFromNames,
  packageJsonLooksLikeVue,
  remotesForLanguages,
  resolveWarmProject,
  rootKey,
  seedLanguageServer,
  uniqueWarmRoots,
} from '../src/client/editor-lsp-warmup.ts'
import type { EditorLspRemote } from '../src/client/editor-lsp.ts'

function listing(names: readonly string[]): FileListing {
  return {
    path: '/ws',
    truncated: false,
    entries: names.map(name => ({
      name,
      path: `/ws/${name}`,
      kind: name.includes('.') ? 'file' : 'directory',
      hidden: false,
    })),
  }
}

function remote(): EditorLspRemote {
  return {
    open: vi.fn(async () => ({ ok: true as const, value: undefined })),
    change: vi.fn(async () => ({ ok: true as const, value: undefined })),
    close: vi.fn(async () => ({ ok: true as const, value: undefined })),
    complete: vi.fn(async () => ({ ok: true as const, value: { items: [] } })),
    diagnostics: vi.fn(async () => ({ ok: true as const, value: { items: [] } })),
    definition: vi.fn(async () => ({ ok: true as const, value: { items: [] } })),
    hover: vi.fn(async () => ({ ok: true as const, value: {} })),
    references: vi.fn(async () => ({ ok: true as const, value: { items: [] } })),
    implementation: vi.fn(async () => ({ ok: true as const, value: { items: [] } })),
    warmup: vi.fn(async () => ({ ok: true as const, value: undefined })),
  }
}

describe('editor-lsp-warmup helpers', () => {
  it('classifies markers and dedupes roots', () => {
    expect(languagesFromNames(['pom.xml', 'src'])).toEqual(['java'])
    expect(languagesFromNames(['Foo.java'])).toEqual(['java'])
    expect(languagesFromNames(['tsconfig.json', 'app.ts'])).toEqual(['ts'])
    expect(languagesFromNames(['App.vue'])).toEqual(['vue'])
    expect(languagesFromNames(['readme.md', '.env'])).toEqual([])
    expect(packageJsonLooksLikeVue('{ "dependencies": { "vue": "3" } }')).toBe(true)
    expect(packageJsonLooksLikeVue('{ "name": "x" }')).toBe(false)
    expect(rootKey('C:\\ws\\')).toBe('c:/ws')
    expect(uniqueWarmRoots([undefined, '', '/ws', '/ws/', '/WS', '/other'])).toEqual(['/ws', '/other'])
    const java = remote()
    const ts = remote()
    expect(remotesForLanguages(['java', 'ts', 'vue'], { javaLsp: java, tsLsp: ts })).toEqual([
      { language: 'java', remote: java },
      { language: 'ts', remote: ts },
    ])
  })

  it('resolves a project at the start folder or by climbing', async () => {
    const listEntries = vi.fn(async (path: string) => {
      if (path === '/ws') return listing(['pom.xml', 'src'])
      return listing(['Foo.java'])
    })
    expect(await resolveWarmProject('/ws', listEntries, undefined)).toEqual({
      root: '/ws',
      languages: ['java'],
    })
    const climb = vi.fn(async (path: string) => {
      if (path.endsWith('/java')) return listing(['com'])
      if (path.endsWith('/main')) return listing(['java'])
      if (path.endsWith('/src')) return listing(['main'])
      return listing(['pom.xml'])
    })
    expect(await resolveWarmProject('/ws/src/main/java', climb, undefined)).toEqual({
      root: '/ws',
      languages: ['java'],
    })
  })

  it('probes marker files when listing fails and reads Vue from package.json', async () => {
    const listEntries = vi.fn(async () => { throw new Error('list') })
    const readFile = vi.fn(async (path: string) => {
      if (path.endsWith('package.json')) return '{ "devDependencies": { "vue": "^3" } }'
      throw new Error('missing')
    })
    expect(await resolveWarmProject('/app', listEntries, readFile)).toEqual({
      root: '/app',
      languages: ['ts', 'vue'],
    })
    const noRead = vi.fn(async () => { throw new Error('list') })
    expect(await resolveWarmProject('/empty', noRead, undefined)).toBeUndefined()
    const probePom = vi.fn(async (path: string) => {
      if (path.endsWith('pom.xml')) return '<project />'
      throw new Error('missing')
    })
    expect(await resolveWarmProject('/ws', undefined, probePom)).toEqual({
      root: '/ws',
      languages: ['java'],
    })
    const pkgFail = vi.fn(async (path: string) => {
      if (path === '/app') return listing(['package.json'])
      throw new Error('pkg')
    })
    const readFail = vi.fn(async () => { throw new Error('pkg') })
    expect(await resolveWarmProject('/app', pkgFail, readFail)).toEqual({
      root: '/app',
      languages: ['ts'],
    })
    const notVue = vi.fn(async () => '{ "name": "lib" }')
    expect(await resolveWarmProject('/lib', async () => listing(['package.json']), notVue)).toEqual({
      root: '/lib',
      languages: ['ts'],
    })
  })

  it('stops on abort, a filesystem root, or the climb cap', async () => {
    const controller = new AbortController()
    controller.abort()
    expect(await resolveWarmProject('/ws', async () => listing(['pom.xml']), undefined, controller.signal))
      .toBeUndefined()
    const onlyRoot = vi.fn(async () => listing(['readme.md']))
    expect(await resolveWarmProject('/', onlyRoot, undefined)).toBeUndefined()
    const deep = vi.fn(async () => listing(['x']))
    expect(await resolveWarmProject('/a/b/c/d/e/f/g/h/i', deep, undefined)).toBeUndefined()
    const midAbort = new AbortController()
    const readFile = vi.fn(async () => 'xml')
    expect(await resolveWarmProject('/ws', async () => {
      midAbort.abort()
      throw new Error('list')
    }, readFile, midAbort.signal)).toBeUndefined()
    expect(readFile).not.toHaveBeenCalled()
    expect(await resolveWarmProject('/app', async () => listing(['App.vue', 'package.json']), undefined))
      .toEqual({ root: '/app', languages: ['vue', 'ts'] })
  })

  it('peeks apps/* packages and finds a Vue seed file', async () => {
    const listEntries = vi.fn(async (path: string) => {
      if (path === '/mono') {
        return {
          path: '/mono',
          truncated: false,
          entries: [
            { name: 'package.json', path: '/mono/package.json', kind: 'file' as const, hidden: false },
            { name: 'apps', path: '/mono/apps', kind: 'directory' as const, hidden: false },
          ],
        }
      }
      if (path === '/mono/apps') {
        return {
          path: '/mono/apps',
          truncated: false,
          entries: [
            { name: 'web', path: '/mono/apps/web', kind: 'directory' as const, hidden: false },
            { name: 'skip', path: '', kind: 'directory' as const, hidden: false },
          ],
        }
      }
      if (path === '/mono/apps/web' || path === '/mono/apps/skip') {
        return listing(['package.json', 'src'])
      }
      if (path.endsWith('/src')) {
        return {
          path,
          truncated: false,
          entries: [
            { name: 'App.vue', path: `${path}/App.vue`, kind: 'file' as const, hidden: false },
            { name: 'util.ts', path: `${path}/util.ts`, kind: 'file' as const, hidden: false },
          ],
        }
      }
      throw new Error(`unexpected ${path}`)
    })
    const readFile = vi.fn(async (path: string) => {
      if (path.endsWith('package.json') && path.includes('apps/web')) {
        return '{ "dependencies": { "vue": "3" } }'
      }
      if (path.endsWith('package.json')) return '{ "name": "mono" }'
      if (path.endsWith('App.vue')) return '<template />'
      throw new Error('missing')
    })
    const projects = await collectWarmProjects(['/mono'], listEntries, readFile)
    expect(projects.some(item => item.root === '/mono/apps/web' && item.languages.includes('vue'))).toBe(true)
    expect(await findSeedFile('/mono/apps/web', 'vue', listEntries)).toBe('/mono/apps/web/src/App.vue')
    expect(await findSeedFile('/mono/apps/web', 'ts', listEntries)).toBe('/mono/apps/web/src/util.ts')
    expect(await findSeedFile('/x', 'java', undefined)).toBeUndefined()
    const aborted = new AbortController()
    aborted.abort()
    expect(await findSeedFile('/mono/apps/web', 'vue', listEntries, aborted.signal)).toBeUndefined()
    expect(await collectWarmProjects(['/mono'], listEntries, readFile, aborted.signal)).toEqual([])
    const vue = remote()
    expect(await seedLanguageServer(
      { root: '/mono/apps/web', languages: ['vue'] },
      'vue',
      vue,
      listEntries,
      readFile,
    )).toBe(true)
    expect(vue.open).toHaveBeenCalledWith({
      workspaceRoot: '/mono/apps/web',
      path: '/mono/apps/web/src/App.vue',
      text: '<template />',
    })
    expect(vue.hover).toHaveBeenCalledWith({
      workspaceRoot: '/mono/apps/web',
      path: '/mono/apps/web/src/App.vue',
      line: 0,
      character: 0,
    })
    vue.open.mockResolvedValueOnce({ ok: false as const, error: { code: 'x', message: 'no' } })
    expect(await seedLanguageServer(
      { root: '/mono/apps/web', languages: ['vue'] },
      'vue',
      vue,
      listEntries,
      readFile,
    )).toBe(false)
    vue.hover.mockRejectedValueOnce(new Error('hover'))
    expect(await seedLanguageServer(
      { root: '/mono/apps/web', languages: ['vue'] },
      'vue',
      vue,
      listEntries,
      readFile,
    )).toBe(true)
    expect(await seedLanguageServer(
      { root: '/mono/apps/web', languages: ['vue'] },
      'vue',
      vue,
      listEntries,
      undefined,
    )).toBe(false)
    vue.open.mockResolvedValueOnce({ ok: false as const, error: { code: 'x', message: 'no' } })
    expect(await seedLanguageServer(
      { root: '/empty', languages: ['vue'] },
      'vue',
      vue,
      async () => listing(['readme.md']),
      readFile,
    )).toBe(false)
    const boom = remote()
    boom.open.mockRejectedValueOnce(new Error('open'))
    expect(await seedLanguageServer(
      { root: '/mono/apps/web', languages: ['vue'] },
      'vue',
      boom,
      listEntries,
      readFile,
    )).toBe(false)
    const emptyPath = vi.fn(async () => ({
      path: '/ws',
      truncated: false,
      entries: [{ name: 'main.ts', path: '', kind: 'file' as const, hidden: false }],
    }))
    expect(await findSeedFile('/ws', 'ts', emptyPath)).toBe('/ws/src/main.ts')
    const nestFail = vi.fn(async (path: string) => {
      if (path === '/mono') return listing(['apps', 'package.json'])
      throw new Error('nest')
    })
    expect(await collectWarmProjects(['/mono'], nestFail, async () => '{ "name": "x" }')).toEqual([
      { root: '/mono', languages: ['ts'] },
    ])
    const startFail = vi.fn(async () => { throw new Error('start') })
    expect(await collectWarmProjects(['/z'], startFail, undefined)).toEqual([])
    const javaSeed = vi.fn(async (path: string) => {
      if (path.includes('src')) throw new Error('no src')
      return {
        path: '/ws',
        truncated: false,
        entries: [{ name: 'Application.java', path: '/ws/Application.java', kind: 'file' as const, hidden: false }],
      }
    })
    expect(await findSeedFile('/ws', 'java', javaSeed)).toBe('/ws/Application.java')
    const many = vi.fn(async (path: string) => {
      if (path === '/big') return listing(['package.json', 'apps'])
      if (path === '/big/apps') {
        return {
          path: '/big/apps',
          truncated: false,
          entries: Array.from({ length: 8 }, (_, i) => ({
            name: `p${i}`,
            path: `/big/apps/p${i}`,
            kind: 'directory' as const,
            hidden: false,
          })),
        }
      }
      return listing(['package.json'])
    })
    expect((await collectWarmProjects(['/big', '/big'], many, async () => '{ "name": "x" }')).length).toBe(6)
    expect((await collectWarmProjects(['/lib', '/lib'], async () => listing(['package.json']), async () => '{ "name": "x" }')))
      .toEqual([{ root: '/lib', languages: ['ts'] }])
    const emptyChild = vi.fn(async (path: string) => {
      if (path === '/mono') return listing(['apps', 'package.json'])
      if (path === '/mono/apps') {
        return {
          path: '/mono/apps',
          truncated: false,
          entries: [{ name: 'empty', path: '/mono/apps/empty', kind: 'directory' as const, hidden: false }],
        }
      }
      if (path === '/mono/apps/empty') return listing(['readme.md'])
      return listing(['package.json'])
    })
    expect((await collectWarmProjects(['/mono'], emptyChild, async () => '{ "name": "x" }')).map(item => item.root))
      .toEqual(['/mono'])
    const orphan = vi.fn(async (path: string) => {
      if (path === '/') {
        return {
          path: '/',
          truncated: false,
          entries: [{ name: 'apps', path: '/apps', kind: 'directory' as const, hidden: false }],
        }
      }
      if (path === '/apps') {
        return {
          path: '/apps',
          truncated: false,
          entries: [{ name: 'empty', path: '/apps/empty', kind: 'directory' as const, hidden: false }],
        }
      }
      return listing(['readme.md'])
    })
    expect(await collectWarmProjects(['/'], orphan, undefined)).toEqual([])
  })
})
