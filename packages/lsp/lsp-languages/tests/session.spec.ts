import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile, realpath, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { LspProviderQuery } from '@deepseek-ai/dsh-lsp'
import { PersistentLspSession } from '../src/session.ts'
import { JAVA_EXTENSION_TO_LANGUAGE } from '../src/protocol.ts'
import { makeSession } from './helpers.ts'

let root: string
let ws: string
let live: PersistentLspSession[] = []

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'lsp-lang-ses-')))
  ws = join(root, 'ws')
  await mkdir(ws)
  await writeFile(join(ws, 'app.ts'), 'const x = 1\n')
})

afterEach(async () => {
  for (const session of live) await session.dispose()
  live = []
  await rm(root, { recursive: true, force: true })
})

function session(env: Record<string, string> = {}): PersistentLspSession {
  const created = makeSession(ws, env)
  live.push(created)
  return created
}

function query(operation: LspProviderQuery['operation'] = 'hover'): LspProviderQuery {
  return {
    operation,
    filePath: 'app.ts',
    position: { line: 0, character: 1 },
    workspaceRoot: ws,
    languageId: 'typescript',
  }
}

describe('PersistentLspSession', () => {
  it('warms initialize before the first open', async () => {
    const s = session()
    await s.whenReady()
    await s.open(ws, 'app.ts', 'const x = 1')
    expect(s.diagnosticsFor(ws, 'app.ts')).toEqual([])
  })

  it('opens, publishes diagnostics, completes, and changes', async () => {
    const marker = join(root, 'open.txt')
    const s = session({
      LSP_FAKE_OPEN_MARKER: marker,
      LSP_FAKE_DIAGNOSTICS: JSON.stringify([{
        message: 'oops',
        severity: 1,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
      }]),
      LSP_FAKE_COMPLETE: JSON.stringify({ items: [{ label: 'const', insertText: 'const' }] }),
    })
    await s.open(ws, 'app.ts', 'const x = 1')
    await new Promise((resolve) => { setTimeout(resolve, 50) })
    expect(s.diagnosticsFor(ws, 'app.ts')[0]?.message).toBe('oops')
    const opened = JSON.parse((await readFile(marker, 'utf8')).trim()) as { languageId: string }
    expect(opened.languageId).toBe('typescript')
    const items = await s.complete(ws, 'app.ts', 0, 1)
    expect(items[0]?.label).toBe('const')
    await s.change(ws, 'app.ts', 'const x = 2')
    await s.close(ws, 'app.ts')
    expect(s.diagnosticsFor(ws, 'app.ts')).toEqual([])
    expect(await s.complete(ws, 'app.ts', 0, 0)).toEqual([])
  })

  it('treats change without open as open, and open-again as change', async () => {
    const s = session()
    await s.change(ws, 'other.ts', 'export const y = 1')
    await s.open(ws, 'other.ts', 'export const y = 2')
    await s.close(ws, 'missing.ts')
  })

  it('opens a Java buffer with languageId java', async () => {
    const marker = join(root, 'java-open.txt')
    const s = makeSession(ws, { LSP_FAKE_OPEN_MARKER: marker }, {
      extensionToLanguage: JAVA_EXTENSION_TO_LANGUAGE,
    })
    live.push(s)
    await s.open(ws, 'Foo.java', 'class Foo {}')
    await new Promise((resolve) => { setTimeout(resolve, 50) })
    const opened = JSON.parse((await readFile(marker, 'utf8')).trim()) as { languageId: string }
    expect(opened.languageId).toBe('java')
  })

  it('reuses a persistent document for an agent query', async () => {
    const s = session({
      LSP_FAKE_HOVER: JSON.stringify({ contents: 'from-server' }),
    })
    await s.open(ws, 'app.ts', 'const x = 1')
    const result = await s.query(query('hover'), {
      fileUrl: pathToFileURL(join(ws, 'app.ts')).href,
      text: 'const x = 1',
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
      fileUrl: pathToFileURL(join(ws, 'app.ts')).href,
      text: 'const x = 1',
    })
    expect(result.kind).toBe('locations')
    if (result.kind === 'locations') expect(result.locations).toHaveLength(1)
    const refs = await s.query(query('findReferences'), {
      fileUrl: pathToFileURL(join(ws, 'app.ts')).href,
      text: 'const x = 1',
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
    expect(await s.navigate('goToDefinition', ws, 'app.ts', 0, 1)).toEqual({
      kind: 'locations', locations: [], resolvedWorkspaceUri: pathToFileURL(ws).href,
    })
    expect(await s.navigate('hover', ws, 'app.ts', 0, 1)).toEqual({ kind: 'hover', hover: null })
    await s.open(ws, 'app.ts', 'const x = 1')
    const definition = await s.navigate('goToDefinition', ws, 'app.ts', 0, 1)
    expect(definition).toEqual({
      kind: 'locations',
      locations: [{ uri: 'file:///x', range: { start: { line: 1, character: 0 }, end: { line: 1, character: 2 } } }],
      resolvedWorkspaceUri: pathToFileURL(ws).href,
    })
    expect(await s.navigate('hover', ws, 'app.ts', 0, 1)).toEqual({ kind: 'hover', hover: { contents: 'nav' } })
    const refs = await s.navigate('findReferences', ws, 'app.ts', 0, 1)
    expect(refs.kind).toBe('locations')
    if (refs.kind === 'locations') expect(refs.locations).toHaveLength(1)
  })

  it('rejects a disposed session and an aborted signal', async () => {
    const s = session()
    await s.dispose()
    await expect(s.open(ws, 'app.ts', 'x')).rejects.toThrow(/disposed/)
    const liveSession = session()
    const controller = new AbortController()
    controller.abort()
    await expect(liveSession.open(ws, 'app.ts', 'x', controller.signal)).rejects.toThrow()
  })

  it('answers configuration and rejects applyEdit on didOpen', async () => {
    const configured = session({ LSP_FAKE_ON_OPEN: 'configuration' })
    await configured.open(ws, 'app.ts', 'const x = 1')
    const apply = session({ LSP_FAKE_ON_OPEN: 'applyEdit' })
    await apply.open(ws, 'app.ts', 'const x = 1')
    const unknown = session({ LSP_FAKE_ON_OPEN: 'unknown' })
    await unknown.open(ws, 'app.ts', 'const x = 1')
  })

  it('surfaces a server error response', async () => {
    const s = session({ LSP_FAKE_ERROR: '1' })
    await s.open(ws, 'app.ts', 'const x = 1')
    await expect(s.complete(ws, 'app.ts', 0, 0)).rejects.toThrow(/refused/)
  })

  it('rejects a non-utf-16 initialize encoding', async () => {
    const s = session({ LSP_FAKE_ENCODING: 'utf-8' })
    await expect(s.open(ws, 'app.ts', 'x')).rejects.toThrow(/utf-16/)
  })
})
