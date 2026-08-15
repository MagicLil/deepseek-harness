import { describe, expect, it } from 'vitest'
import { cardFromOpenVsx, downloadVsix, parseOpenVsxSearch, searchOpenVsx } from '../src/openvsx.ts'
import { jsonFetch, throwFetch } from './helpers.ts'

describe('openvsx', () => {
  it('maps hits and parses the search body', () => {
    const card = cardFromOpenVsx({
      namespace: 'Vue',
      name: 'volar',
      displayName: 'Vue - Official',
      description: 'Vue 3',
      verified: true,
      version: '3.0.0',
      files: { download: 'https://x/a.vsix' },
    }, new Set(['Vue.volar']))
    expect(card).toMatchObject({
      id: 'Vue.volar',
      installed: true,
      verified: true,
      compatibility: 'pending-host',
      downloadUrl: 'https://x/a.vsix',
    })
    expect(cardFromOpenVsx({ namespace: 'a', name: 'b' }, new Set()).displayName).toBe('b')
    expect(parseOpenVsxSearch(null)).toEqual([])
    expect(parseOpenVsxSearch({})).toEqual([])
    expect(parseOpenVsxSearch({ extensions: 'x' })).toEqual([])
    expect(parseOpenVsxSearch({ extensions: [null, { namespace: 1 }] })).toEqual([])
    expect(parseOpenVsxSearch({
      extensions: [{
        namespace: 'n',
        name: 'm',
        displayName: 'N',
        description: 'd',
        verified: true,
        version: '1',
        files: { download: 'https://x' },
      }],
    })).toEqual([{
      namespace: 'n',
      name: 'm',
      displayName: 'N',
      description: 'd',
      verified: true,
      version: '1',
      files: { download: 'https://x' },
    }])
  })

  it('searches and downloads with network fallbacks', async () => {
    const hits = await searchOpenVsx('vue', jsonFetch({
      extensions: [{ namespace: 'Vue', name: 'volar' }],
    }))
    expect(hits).toHaveLength(1)
    expect(await searchOpenVsx('vue', jsonFetch({}, false))).toEqual([])
    expect(await searchOpenVsx('vue', throwFetch())).toEqual([])
    expect(await searchOpenVsx('vue', jsonFetch({ extensions: [] }), new AbortController().signal)).toEqual([])
    const bytes = await downloadVsix('https://x', jsonFetch({}), new AbortController().signal)
    expect(bytes).toEqual(new Uint8Array([1, 2, 3, 4]))
    await expect(downloadVsix('https://x', jsonFetch({}, false, 404))).rejects.toThrow('open-vsx-download-404')
  })
})
