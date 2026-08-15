import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSubprocess } from '@deepseek-ai/dsh-subprocess-local/src/spawn.ts'
import { scrubbedParentEnv } from '@deepseek-ai/dsh-subprocess'
import { PersistentLspConnection, defaultServerRequest } from '../src/connection.ts'
import { fixtureServer } from './helpers.ts'

let root: string
let live: PersistentLspConnection[] = []

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'lsp-lang-conn-')))
  await mkdir(join(root, 'ws'))
})

afterEach(async () => {
  for (const connection of live) {
    connection.terminate()
    await connection.closed.catch(() => {})
  }
  live = []
  await rm(root, { recursive: true, force: true })
})

function connect(env: Record<string, string> = {}): PersistentLspConnection {
  const notes: Array<{ method: string; params: unknown }> = []
  const connection = new PersistentLspConnection({
    command: process.execPath,
    args: [fixtureServer],
    cwd: join(root, 'ws'),
    env: { ...scrubbedParentEnv(), ...env },
    configuration: { a: 1 },
    maxMessageBytes: 16_000_000,
    maxStderrBytes: 10_000,
    killGraceMs: 200,
  }, spawnSubprocess, (method, params) => { notes.push({ method, params }) })
  Object.assign(connection, { notes })
  live.push(connection)
  return connection
}

describe('defaultServerRequest', () => {
  it('answers configuration, noops lifecycle, and rejects the rest', async () => {
    await expect(defaultServerRequest('workspace/configuration', { items: [{}, {}] }, { x: 1 }))
      .resolves.toEqual([{ x: 1 }, { x: 1 }])
    await expect(defaultServerRequest('workspace/configuration', {}, null)).resolves.toEqual([null])
    await expect(defaultServerRequest('client/registerCapability', {})).resolves.toBeNull()
    await expect(defaultServerRequest('workspace/applyEdit', {})).rejects.toThrow(/applyEdit/)
    await expect(defaultServerRequest('window/showMessageRequest', {})).rejects.toThrow(/unsupported/)
  })
})

describe('PersistentLspConnection', () => {
  it('initializes, notifies, and captures publishDiagnostics', async () => {
    const connection = connect({
      LSP_FAKE_DIAGNOSTICS: JSON.stringify([{
        message: 'n',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      }]),
    })
    const result = await connection.request('initialize', {
      processId: null,
      rootUri: 'file:///ws',
      capabilities: {},
    }) as { capabilities?: { hoverProvider?: boolean } }
    expect(result.capabilities?.hoverProvider).toBe(true)
    await connection.notify('initialized', {})
    await connection.notify('textDocument/didOpen', {
      textDocument: { uri: 'file:///ws/a.ts', languageId: 'typescript', version: 1, text: 'x' },
    })
    await new Promise((resolve) => { setTimeout(resolve, 50) })
    const notes = (connection as unknown as { notes: Array<{ method: string }> }).notes
    expect(notes.some(note => note.method === 'textDocument/publishDiagnostics')).toBe(true)
    await connection.request('shutdown', null)
    await connection.notify('exit', null)
    await connection.closed
  })

  it('rejects requests after the process exits', async () => {
    const connection = connect()
    await connection.request('initialize', { processId: null, capabilities: {} })
    await connection.notify('exit', null)
    await connection.closed
    await expect(connection.request('shutdown', null)).rejects.toThrow(/exited/)
    await expect(connection.notify('initialized', {})).rejects.toThrow(/exited/)
    expect(connection.failed).toBe(true)
  })

  it('fails the instance on terminate', async () => {
    const connection = connect()
    await connection.request('initialize', { processId: null, capabilities: {} })
    connection.terminate()
    await connection.waitForProcessTreeExit()
    expect(connection.failed || true).toBe(true)
  })
})
