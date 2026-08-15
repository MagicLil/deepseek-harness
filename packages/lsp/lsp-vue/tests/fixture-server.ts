/**
 * Fake Vue language server over stdio for lsp-vue tests.
 * Env:
 * - LSP_FAKE_COMPLETE / LSP_FAKE_HOVER / LSP_FAKE_DEF / LSP_FAKE_REFS / LSP_FAKE_IMPL
 * - LSP_FAKE_DIAGNOSTICS: JSON Diagnostic[] published on didOpen/didChange
 * - LSP_FAKE_ON_OPEN: configuration | applyEdit | unknown
 * - LSP_FAKE_ERROR: "1" answers textDocument/* with an error
 * - LSP_FAKE_HANG: "1" never answers textDocument/*
 * - LSP_FAKE_ENCODING: advertised positionEncoding (default utf-16)
 */

import { appendFileSync } from 'node:fs'

const enc = process.env.LSP_FAKE_ENCODING ?? 'utf-16'
const hang = process.env.LSP_FAKE_HANG === '1'
const errorReply = process.env.LSP_FAKE_ERROR === '1'
const onOpen = process.env.LSP_FAKE_ON_OPEN
const openMarker = process.env.LSP_FAKE_OPEN_MARKER
const changeMarker = process.env.LSP_FAKE_CHANGE_MARKER
const closeMarker = process.env.LSP_FAKE_CLOSE_MARKER

let serverRequestId = 10_000
const pendingServerRequests = new Map<number, string>()

function envJson(name: string, fallback: unknown): unknown {
  const raw = process.env[name]
  return raw === undefined ? fallback : JSON.parse(raw)
}

function resultFor(method: string): unknown {
  switch (method) {
    case 'textDocument/completion': return envJson('LSP_FAKE_COMPLETE', { items: [{ label: 'Foo' }] })
    case 'textDocument/definition': return envJson('LSP_FAKE_DEF', null)
    case 'textDocument/references': return envJson('LSP_FAKE_REFS', null)
    case 'textDocument/implementation': return envJson('LSP_FAKE_IMPL', null)
    case 'textDocument/hover': return envJson('LSP_FAKE_HOVER', { contents: 'hover' })
    default: return null
  }
}

let buffer = Buffer.alloc(0)
process.stdin.on('data', (chunk: Buffer) => {
  buffer = Buffer.concat([buffer, chunk])
  for (;;) {
    const sep = buffer.indexOf('\r\n\r\n')
    if (sep < 0) break
    const header = buffer.toString('ascii', 0, sep)
    const match = /content-length:\s*(\d+)/i.exec(header)
    if (!match) { buffer = buffer.subarray(sep + 4); continue }
    const length = Number(match[1])
    const start = sep + 4
    if (buffer.length < start + length) break
    const body = buffer.toString('utf8', start, start + length)
    buffer = buffer.subarray(start + length)
    handle(JSON.parse(body) as { id?: number; method?: string; params?: unknown; result?: unknown; error?: unknown })
  }
})

function handle(message: { id?: number; method?: string; params?: unknown; result?: unknown; error?: unknown }): void {
  const { id, method } = message
  if (method === undefined && id !== undefined && pendingServerRequests.has(id)) {
    pendingServerRequests.delete(id)
    return
  }
  if (method === 'initialize') {
    send({
      id,
      result: {
        capabilities: {
          positionEncoding: enc,
          textDocumentSync: 1,
          definitionProvider: true,
          referencesProvider: true,
          implementationProvider: true,
          hoverProvider: true,
          completionProvider: { triggerCharacters: ['.'] },
        },
      },
    })
    return
  }
  if (method === 'shutdown') {
    send({ id, result: null })
    return
  }
  if (method === 'exit') {
    process.exit(0)
  }
  if (method === 'initialized') return
  if (method === 'textDocument/didOpen') {
    if (openMarker !== undefined) {
      const params = message.params as { textDocument?: { text?: unknown } } | undefined
      appendFileSync(openMarker, `${JSON.stringify(params?.textDocument?.text)}\n`)
    }
    publishDiagnostics(message.params)
    if (onOpen !== undefined) emitServerRequest(onOpen)
    return
  }
  if (method === 'textDocument/didChange') {
    if (changeMarker !== undefined) {
      const params = message.params as { contentChanges?: Array<{ text?: unknown }> } | undefined
      appendFileSync(changeMarker, `${JSON.stringify(params?.contentChanges?.[0]?.text)}\n`)
    }
    publishDiagnostics(message.params)
    return
  }
  if (method === 'textDocument/didClose') {
    if (closeMarker !== undefined) appendFileSync(closeMarker, 'CLOSE\n')
    return
  }
  if (method?.startsWith('textDocument/')) {
    if (hang) return
    if (errorReply) {
      send({ id, error: { code: -32000, message: 'server refused the request' } })
      return
    }
    send({ id, result: resultFor(method) })
    return
  }
  if (id !== undefined) send({ id, result: null })
}

function publishDiagnostics(params: unknown): void {
  const uri = (params as { textDocument?: { uri?: string } } | undefined)?.textDocument?.uri
    ?? (params as { uri?: string } | undefined)?.uri
  if (typeof uri !== 'string') return
  send({
    method: 'textDocument/publishDiagnostics',
    params: { uri, diagnostics: envJson('LSP_FAKE_DIAGNOSTICS', []) },
  })
}

function emitServerRequest(kind: string): void {
  const id = serverRequestId++
  const method = kind === 'configuration'
    ? 'workspace/configuration'
    : kind === 'applyEdit'
      ? 'workspace/applyEdit'
      : 'window/showMessageRequest'
  const params = kind === 'configuration' ? { items: [{ section: 'a' }, { section: 'b' }] } : {}
  pendingServerRequests.set(id, method)
  send({ id, method, params })
}

function send(message: Record<string, unknown>): void {
  const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...message }), 'utf8')
  process.stdout.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii'), body]))
}

process.stdin.resume()
