import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { LspProviderQuery } from '@deepseek-ai/dsh-lsp'
import { VueLspSession } from '../src/session.ts'
import { makeSession } from './helpers.ts'

let root: string
let ws: string
let live: VueLspSession[] = []

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'lsp-vue-ses-')))
  ws = join(root, 'ws')
  await mkdir(ws)
  await writeFile(join(ws, 'App.vue'), '<template><div /></template>\n')
})

afterEach(async () => {
  for (const session of live) await session.dispose()
  live = []
  await rm(root, { recursive: true, force: true })
})

function session(env: Record<string, string> = {}): VueLspSession {
  const created = makeSession(ws, env)
  live.push(created)
  return created
}

function query(operation: LspProviderQuery['operation'] = 'hover'): LspProviderQuery {
  return {
    operation,
    filePath: 'App.vue',
    position: { line: 0, character: 1 },
    workspaceRoot: ws,
    languageId: 'vue',
  }
}

describe('VueLspSession', () => {
  it('warms initialize before the first open', async () => {
    const s = session()
    await s.whenReady()
    await s.open(ws, 'App.vue', '<template />')
    expect(s.diagnosticsFor(ws, 'App.vue')).toEqual([])
  })

  it('opens, publishes diagnostics, completes, and changes', async () => {
    const s = session({
      LSP_FAKE_DIAGNOSTICS: JSON.stringify([{
        message: 'oops',
        severity: 1,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
      }]),
      LSP_FAKE_COMPLETE: JSON.stringify({ items: [{ label: 'div', insertText: 'div' }] }),
    })
    await s.open(ws, 'App.vue', '<template></template>')
    await new Promise((resolve) => { setTimeout(resolve, 50) })
    expect(s.diagnosticsFor(ws, 'App.vue')[0]?.message).toBe('oops')
    const items = await s.complete(ws, 'App.vue', 0, 1)
    expect(items[0]?.label).toBe('div')
    await s.change(ws, 'App.vue', '<template><span /></template>')
    await s.close(ws, 'App.vue')
    expect(s.diagnosticsFor(ws, 'App.vue')).toEqual([])
    expect(await s.complete(ws, 'App.vue', 0, 0)).toEqual([])
  })

  it('treats change without open as open, and open-again as change', async () => {
    const s = session()
    await s.change(ws, 'Other.vue', '<script setup></script>')
    await s.open(ws, 'Other.vue', '<script setup>const x = 1</script>')
    await s.close(ws, 'missing.vue')
  })

  it('reuses a persistent document for an agent query', async () => {
    const s = session({
      LSP_FAKE_HOVER: JSON.stringify({ contents: 'from-server' }),
    })
    await s.open(ws, 'App.vue', '<template />')
    const result = await s.query(query('hover'), {
      fileUrl: pathToFileURL(join(ws, 'App.vue')).href,
      text: '<template />',
    })
    expect(result).toEqual({ kind: 'hover', hover: { contents: 'from-server' } })
  })

  it('transient-opens for an agent query when the editor has not opened the file', async () => {
    const s = session({
      LSP_FAKE_DEF: JSON.stringify({
        uri: 'file:///x',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      }),
    })
    const result = await s.query(query('goToDefinition'), {
      fileUrl: pathToFileURL(join(ws, 'App.vue')).href,
      text: '<template />',
    })
    expect(result.kind).toBe('locations')
    if (result.kind === 'locations') expect(result.locations).toHaveLength(1)
    const refs = await s.query(query('findReferences'), {
      fileUrl: pathToFileURL(join(ws, 'App.vue')).href,
      text: '<template />',
    })
    expect(refs.kind).toBe('locations')
  })

  it('navigates an open editor buffer and returns empty for a closed one', async () => {
    const s = session({
      LSP_FAKE_DEF: JSON.stringify({
        uri: 'file:///x',
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 2 } },
      }),
      LSP_FAKE_HOVER: JSON.stringify({ contents: 'nav' }),
      LSP_FAKE_REFS: JSON.stringify([{
        uri: 'file:///x',
        range: { start: { line: 3, character: 0 }, end: { line: 3, character: 1 } },
      }]),
    })
    expect(await s.navigate('goToDefinition', ws, 'App.vue', 0, 1)).toEqual({
      kind: 'locations', locations: [], resolvedWorkspaceUri: pathToFileURL(ws).href,
    })
    expect(await s.navigate('hover', ws, 'App.vue', 0, 1)).toEqual({ kind: 'hover', hover: null })
    await s.open(ws, 'App.vue', '<template />')
    expect(await s.navigate('goToDefinition', ws, 'App.vue', 0, 1)).toEqual({
      kind: 'locations',
      locations: [{ uri: 'file:///x', range: { start: { line: 1, character: 0 }, end: { line: 1, character: 2 } } }],
      resolvedWorkspaceUri: pathToFileURL(ws).href,
    })
    expect(await s.navigate('hover', ws, 'App.vue', 0, 1)).toEqual({ kind: 'hover', hover: { contents: 'nav' } })
    const refs = await s.navigate('findReferences', ws, 'App.vue', 0, 1)
    expect(refs.kind).toBe('locations')
    if (refs.kind === 'locations') expect(refs.locations).toHaveLength(1)
  })

  it('gives up a hung hover so the editor is not stuck on Loading', async () => {
    const s = session({ LSP_FAKE_HANG: '1' })
    await s.open(ws, 'App.vue', '<template />')
    await expect(s.navigate('hover', ws, 'App.vue', 0, 1)).rejects.toThrow()
  })

  it('rejects a disposed session and an aborted signal', async () => {
    const s = session()
    await s.dispose()
    await expect(s.open(ws, 'App.vue', 'x')).rejects.toThrow(/disposed/)
    const liveSession = session()
    const controller = new AbortController()
    controller.abort()
    await expect(liveSession.open(ws, 'App.vue', 'x', controller.signal)).rejects.toThrow()
  })

  it('answers configuration and rejects applyEdit on didOpen', async () => {
    const configured = session({ LSP_FAKE_ON_OPEN: 'configuration' })
    await configured.open(ws, 'App.vue', '<template />')
    const apply = session({ LSP_FAKE_ON_OPEN: 'applyEdit' })
    await apply.open(ws, 'App.vue', '<template />')
    const unknown = session({ LSP_FAKE_ON_OPEN: 'unknown' })
    await unknown.open(ws, 'App.vue', '<template />')
  })

  it('surfaces a server error response', async () => {
    const s = session({ LSP_FAKE_ERROR: '1' })
    await s.open(ws, 'App.vue', '<template />')
    await expect(s.complete(ws, 'App.vue', 0, 0)).rejects.toThrow(/refused/)
  })

  it('rejects a non-utf-16 initialize encoding', async () => {
    const s = session({ LSP_FAKE_ENCODING: 'utf-8' })
    await expect(s.open(ws, 'App.vue', 'x')).rejects.toThrow(/utf-16/)
  })
})
