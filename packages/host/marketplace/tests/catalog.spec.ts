import { describe, expect, it } from 'vitest'
import { CATALOG_SNAPSHOT } from '../src/catalog-snapshot.ts'
import { cardFromRow, filterCards, installSpecOf, loadCatalog, parseCatalog } from '../src/catalog.ts'
import { jsonFetch, throwFetch } from './helpers.ts'

describe('catalog', () => {
  it('extracts the pnpm spec from a documented add line', () => {
    expect(installSpecOf('dsh plugin --profile web add github:acme/plug')).toBe('github:acme/plug')
    expect(installSpecOf('just-a-name')).toBe('just-a-name')
  })

  it('maps a row and marks install + desktop incompatibility', () => {
    const ok = CATALOG_SNAPSHOT.plugins[0]!
    const blocked = CATALOG_SNAPSHOT.plugins[1]!
    const installed = new Set([ok.name])
    const zh = cardFromRow(ok, 'zh', installed)
    expect(zh.installed).toBe(true)
    expect(zh.description).toBe(ok.description.zh)
    expect(zh.desktopCompatible).toBe(true)
    const en = cardFromRow(ok, 'en', new Set([ok.install.split('add ')[1]!]))
    expect(en.installed).toBe(true)
    expect(en.description).toBe(ok.description.en)
    const bad = cardFromRow(blocked, 'en', new Set())
    expect(bad.desktopCompatible).toBe(false)
    expect(bad.incompatibilityReason).toBe('desktop-http')
  })

  it('filters by name, owner, description, and category', () => {
    const items = CATALOG_SNAPSHOT.plugins.map(row => cardFromRow(row, 'en', new Set()))
    expect(filterCards(items, '  ')).toHaveLength(items.length)
    expect(filterCards(items, 'FIND').map(item => item.name)).toEqual(['dsh-find-plugin'])
    expect(filterCards(items, 'omdsh-dev')).toHaveLength(1)
    expect(filterCards(items, 'web-profile')).toHaveLength(1)
    expect(filterCards(items, 'ui')).toHaveLength(1)
  })

  it('falls back to the snapshot on unknown catalog shapes', () => {
    expect(parseCatalog(null)).toBe(CATALOG_SNAPSHOT.plugins)
    expect(parseCatalog('x')).toBe(CATALOG_SNAPSHOT.plugins)
    expect(parseCatalog({})).toBe(CATALOG_SNAPSHOT.plugins)
    expect(parseCatalog({ plugins: 'nope' })).toBe(CATALOG_SNAPSHOT.plugins)
    expect(parseCatalog({ plugins: [null, 1, { name: 1 }] })).toBe(CATALOG_SNAPSHOT.plugins)
    expect(parseCatalog({
      plugins: [{ name: 'a', owner: 'b', install: 1, category: 'c', description: { en: 'e', zh: 'z' } }],
    })).toBe(CATALOG_SNAPSHOT.plugins)
    expect(parseCatalog({
      plugins: [{ name: 'a', owner: 'b', install: 'add x', category: 'c', description: null }],
    })).toBe(CATALOG_SNAPSHOT.plugins)
    expect(parseCatalog({
      plugins: [{ name: 'a', owner: 'b', install: 'add x', category: 'c', description: { en: 1, zh: 'z' } }],
    })).toBe(CATALOG_SNAPSHOT.plugins)
  })

  it('keeps well-formed rows and defaults url/stars', () => {
    const rows = parseCatalog({
      plugins: [{
        name: 'n',
        owner: 'o',
        install: 'dsh plugin add n',
        category: 'c',
        description: { en: 'e', zh: 'z' },
      }],
    })
    expect(rows).toEqual([{
      name: 'n',
      owner: 'o',
      url: '',
      category: 'c',
      description: { en: 'e', zh: 'z' },
      install: 'dsh plugin add n',
      stars: 0,
    }])
  })

  it('loads the live catalog or falls back', async () => {
    const live = await loadCatalog(jsonFetch({
      plugins: [{
        name: 'live',
        owner: 'o',
        url: 'https://x',
        install: 'add live',
        category: 'c',
        description: { en: 'e', zh: 'z' },
        stars: 3,
      }],
    }))
    expect(live[0]?.name).toBe('live')
    expect(await loadCatalog(jsonFetch({}, false))).toBe(CATALOG_SNAPSHOT.plugins)
    expect(await loadCatalog(throwFetch())).toBe(CATALOG_SNAPSHOT.plugins)
    expect(await loadCatalog(jsonFetch(CATALOG_SNAPSHOT), new AbortController().signal))
      .toEqual(CATALOG_SNAPSHOT.plugins)
  })
})
