import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { join } from 'node:path'
import MarketplaceGateway from '../src/index.ts'
import { CATALOG_SNAPSHOT } from '../src/catalog-snapshot.ts'
import { jsonFetch, memFs, spawnFail, spawnOk, testRuntime, throwFetch } from './helpers.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

async function harness(): Promise<MarketplaceGateway> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(MarketplaceGateway)
  return ctx.get('marketplace') as MarketplaceGateway
}

describe('MarketplaceGateway', () => {
  it('publishes the marketplace remotes', async () => {
    const gw = await harness()
    expect(gw.typertRemote).toMatchObject({ serviceKey: 'marketplace', namespace: 'marketplace' })
    expect(remoteMethods(gw).map(item => item.method)).toEqual([
      'searchPlugins',
      'listInstalledPlugins',
      'installPlugin',
      'uninstallPlugin',
      'searchExtensions',
      'listInstalledExtensions',
      'installExtension',
      'uninstallExtension',
    ])
  })

  it('searches and lists DSH plugins from the snapshot when the live catalog fails', async () => {
    const gw = await harness()
    const fs = memFs()
    fs.files.set(join('/h', 'profiles', 'desktop', 'package.json'), JSON.stringify({
      dependencies: { 'dsh-find-plugin': '1.0.0', leftover: '1' },
    }))
    gw.runtime = testRuntime('/h', { fetch: throwFetch(), vsixFs: fs, readFile: fs.readText, writeFile: fs.writeText })
    const found = await gw.searchPlugins({ query: 'find', locale: 'en' }, new AbortController().signal)
    expect(found.items[0]?.name).toBe('dsh-find-plugin')
    expect(found.items[0]?.installed).toBe(true)
    const listed = await gw.listInstalledPlugins({ locale: 'zh' })
    expect(listed.items.some(item => item.name === 'dsh-find-plugin')).toBe(true)
    expect(listed.items.some(item => item.name === 'leftover')).toBe(true)
  })

  it('refuses HTTP-only plugins and empty specs, then installs with a restart', async () => {
    const gw = await harness()
    const fs = memFs()
    fs.files.set(join('/h', 'profiles', 'desktop', 'package.json'), JSON.stringify({ dependencies: {} }))
    gw.runtime = testRuntime('/h', {
      fetch: jsonFetch(CATALOG_SNAPSHOT),
      spawn: spawnOk(),
      vsixFs: fs,
      readFile: fs.readText,
      writeFile: fs.writeText,
    })
    const blocked = CATALOG_SNAPSHOT.plugins[1]!
    expect(await gw.installPlugin({ spec: blocked.name })).toMatchObject({
      ok: false,
      error: 'desktop-http',
    })
    expect(await gw.installPlugin({ spec: '  ' })).toMatchObject({ ok: false, error: 'empty-spec' })
    gw.runtime.spawn = spawnFail()
    expect(await gw.installPlugin({ spec: 'acme/ok' })).toMatchObject({ ok: false, error: 'pnpm-add-failed' })
    gw.runtime.spawn = spawnOk()
    expect(await gw.installPlugin({ spec: 'acme/ok', allowBuilds: true })).toMatchObject({
      ok: true,
      needsRestart: true,
    })
    expect(await gw.installPlugin({ spec: 'dsh-find-plugin' })).toMatchObject({
      ok: true,
      needsRestart: true,
    })
    expect(await gw.installPlugin({ spec: 'awesome-dsh-plugin/dsh-find-plugin' })).toMatchObject({
      ok: true,
      needsRestart: true,
    })
  })

  it('uninstalls DSH plugins and reports pnpm failures', async () => {
    const gw = await harness()
    const fs = memFs()
    fs.files.set(join('/h', 'profiles', 'desktop', 'package.json'), JSON.stringify({ dependencies: { a: '1' } }))
    gw.runtime = testRuntime('/h', { spawn: spawnOk(), vsixFs: fs, readFile: fs.readText, writeFile: fs.writeText })
    expect(await gw.uninstallPlugin({ name: '  ' })).toMatchObject({ ok: false, error: 'empty-name' })
    gw.runtime.spawn = spawnFail()
    expect(await gw.uninstallPlugin({ name: 'a' })).toMatchObject({ ok: false, error: 'pnpm-remove-failed' })
    gw.runtime.spawn = spawnOk()
    expect(await gw.uninstallPlugin({ name: 'a' })).toMatchObject({ ok: true, needsRestart: true })
  })

  it('searches Open VSX, lists stored vsix, and refuses unsupported ids', async () => {
    const gw = await harness()
    const fs = memFs()
    gw.runtime = testRuntime('/h', {
      fetch: jsonFetch({
        extensions: [{
          namespace: 'Vue',
          name: 'volar',
          displayName: 'Vue - Official',
          files: { download: 'https://x/v.vsix' },
        }],
      }),
      vsixFs: fs,
    })
    const empty = await gw.searchExtensions({ query: '  ' })
    expect(empty.items.some(item => item.id === 'Vue.volar')).toBe(true)
    expect(empty.items.find(item => item.id === 'ms-vscode-remote.remote-ssh')?.compatibility)
      .toBe('unsupported')
    const searched = await gw.searchExtensions({ query: 'vue' })
    expect(searched.items[0]?.id).toBe('Vue.volar')
    expect(await gw.listInstalledExtensions()).toEqual({ query: '', items: [] })
    expect(await gw.installExtension({ id: '  ' })).toMatchObject({ ok: false, error: 'empty-id' })
    expect(await gw.installExtension({ id: 'ms-vscode-remote.remote-ssh' }))
      .toMatchObject({ ok: false, error: 'unsupported' })
    expect(await gw.installExtension({ id: 'Vue.volar' })).toMatchObject({ ok: true, needsRestart: false })
    expect((await gw.searchExtensions({ query: 'vue' })).items[0]?.installed).toBe(true)
    expect(await gw.installExtension({ id: 'acme.other' })).toMatchObject({ ok: true })
    expect(await gw.installExtension({ id: 'nodot', downloadUrl: '' })).toMatchObject({ ok: true })
    expect((await gw.listInstalledExtensions()).items[0]?.id).toBe('Vue.volar')
    expect(await gw.uninstallExtension({ id: '  ' })).toMatchObject({ ok: false, error: 'empty-id' })
    expect(await gw.uninstallExtension({ id: 'missing' })).toMatchObject({ ok: false, error: 'not-installed' })
    expect(await gw.uninstallExtension({ id: 'Vue.volar' })).toMatchObject({ ok: true })
  })

  it('fails a vsix install when Open VSX has no download and when fetch throws', async () => {
    const gw = await harness()
    gw.runtime = testRuntime('/h', { fetch: jsonFetch({ extensions: [] }) })
    expect(await gw.installExtension({ id: 'acme.none' })).toMatchObject({ ok: false, error: 'no-download-url' })
    gw.runtime.fetch = throwFetch()
    expect(await gw.installExtension({ id: 'acme.none', downloadUrl: 'https://x' }))
      .toMatchObject({ ok: false, error: 'net' })
    const boomFetch: typeof fetch = async () => {
      throw 'boom'
    }
    gw.runtime.fetch = boomFetch
    expect(await gw.installExtension({ id: 'acme.none', downloadUrl: 'https://x' }))
      .toMatchObject({ ok: false, error: 'download-failed' })
  })
})
