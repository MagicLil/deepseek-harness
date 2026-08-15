/**
 * Lean JSON-RPC endpoint over one language server. Reuses lsp-stdio framing
 * and captures `textDocument/publishDiagnostics` (the generic LspConnection
 * ignores server notifications).
 * @module @deepseek-ai/dsh-lsp-vue/connection
 */

import type { Writable } from 'node:stream'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { encodeMessage, MessageDecoder } from '@deepseek-ai/dsh-lsp-stdio'

/** How to launch the server and answer its config requests. */
export interface VueConnectionSpec {
  /** The resolved absolute executable path (no shell). */
  readonly command: string
  /** Arguments passed to the executable. */
  readonly args: readonly string[]
  /** The child's working directory (the canonical workspace). */
  readonly cwd: string
  /** Explicit child environment overrides. */
  readonly env: Record<string, string>
  /** Largest single framed message accepted from the server. */
  readonly maxMessageBytes: number
  /** Largest stderr tail retained for diagnostics. */
  readonly maxStderrBytes: number
  /** SIGTERM→SIGKILL window. */
  readonly killGraceMs: number
  /** Static answer to every `workspace/configuration` item. */
  readonly configuration: unknown
}

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

/** Spawn one subprocess for this connection. */
export type ConnectionSpawner = (spec: SubprocessSpawnSpec) => SubprocessHandle

/** Server→client notification (`method` + `params`). */
export type NotificationHandler = (method: string, params: unknown) => void

const LIFECYCLE_NOOP_METHODS = new Set([
  'window/workDoneProgress/create',
  'client/registerCapability',
  'client/unregisterCapability',
])

/** A live JSON-RPC endpoint bound to one child process. */
export class VueLspConnection {
  private readonly handle: SubprocessHandle
  private readonly stdin: Writable
  private readonly decoder: MessageDecoder
  private readonly pending = new Map<number, Pending>()
  private readonly onServerRequest: (method: string, params: unknown) => Promise<unknown>
  private nextId = 1
  private closeReason: Error | undefined
  readonly closed: Promise<void>

  constructor(
    spec: VueConnectionSpec,
    spawner: ConnectionSpawner,
    private readonly onNotification: NotificationHandler,
    onServerRequest?: (method: string, params: unknown) => Promise<unknown>,
  ) {
    this.onServerRequest = onServerRequest
      ?? ((method, params) => defaultServerRequest(method, params, spec.configuration))
    this.decoder = new MessageDecoder(spec.maxMessageBytes)
    this.handle = spawner({
      argv: [spec.command, ...spec.args],
      cwd: spec.cwd,
      stdio: {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: { maxBytes: spec.maxStderrBytes },
      },
      graceMs: spec.killGraceMs,
      env: spec.env,
    })
    /* v8 ignore start -- 'pipe' dispositions expose both streams by the seam contract. */
    if (this.handle.stdin === undefined || this.handle.stdout === undefined) {
      throw new Error('lsp-vue: subprocess implementation dropped a piped protocol stream')
    }
    /* v8 ignore stop */
    this.stdin = this.handle.stdin
    this.closed = new Promise<void>((resolve) => {
      const close = (): void => {
        const reason = this.closeReason ?? new Error(this.exitMessage())
        this.closeReason = reason
        this.failAll(reason)
        resolve()
      }
      /* v8 ignore start -- spawn-level rejection is the fatal cause and the close boundary. */
      this.handle.done.then(close, (error: unknown) => {
        this.fail(asError(error))
        close()
      })
      /* v8 ignore stop */
    })
    /* v8 ignore next -- stdin errors are fatal; Node delivers them asynchronously. */
    this.stdin.on('error', (error) => { this.fail(error) })
    this.handle.stdout.on('data', (chunk: Buffer) => { this.onStdout(chunk) })
  }

  get failed(): boolean {
    return this.closeReason !== undefined
  }

  failedWith(error: unknown): boolean {
    return this.closeReason === error
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++
    const promise = new Promise<unknown>((resolve, reject) => {
      if (this.closeReason !== undefined) {
        reject(this.closeReason)
        return
      }
      this.pending.set(id, { resolve, reject })
      /* v8 ignore next -- write() already records a fatal failure. */
      void this.write({ jsonrpc: '2.0', id, method, params }).catch(() => {})
    })
    /* v8 ignore next -- a caller that stops awaiting must not surface an unhandled rejection. */
    promise.catch(() => {})
    return promise
  }

  notify(method: string, params: unknown): Promise<void> {
    return this.write({ jsonrpc: '2.0', method, params })
  }

  terminate(): void {
    this.handle.terminate()
  }

  async waitForProcessTreeExit(signal?: AbortSignal): Promise<boolean> {
    return await this.handle.waitForExit(signal)
  }

  private onStdout(chunk: Buffer): void {
    let messages: unknown[]
    try {
      messages = this.decoder.push(chunk)
    /* v8 ignore start -- a framing/JSON failure corrupts the stream. */
    } catch (error) {
      this.fail(asError(error))
      this.handle.terminate()
      return
    }
    /* v8 ignore stop */
    for (const message of messages) this.dispatch(message)
  }

  private dispatch(message: unknown): void {
    /* v8 ignore next -- the decoder yields objects. */
    if (message === null || typeof message !== 'object') return
    const frame = message as Record<string, unknown>
    const id = frame.id
    const method = frame.method
    if (typeof method === 'string' && (typeof id === 'number' || typeof id === 'string')) {
      /* v8 ignore next -- a response-write failure has already invalidated the connection. */
      void this.handleServerRequest(id, method, frame.params).catch(() => {})
      return
    }
    if (typeof method === 'string') {
      this.onNotification(method, frame.params)
      return
    }
    /* v8 ignore next -- a response without a pending waiter is ignored. */
    if (typeof id === 'number') this.handleResponse(id, frame)
  }

  private async handleServerRequest(id: number | string, method: string, params: unknown): Promise<void> {
    try {
      const result = await this.onServerRequest(method, params)
      await this.write({ jsonrpc: '2.0', id, result })
    } catch (error) {
      /* v8 ignore next -- applyEdit and unknown server requests reject here. */
      await this.write({ jsonrpc: '2.0', id, error: { code: -32601, message: asError(error).message } })
    }
  }

  private handleResponse(id: number, frame: Record<string, unknown>): void {
    const pending = this.pending.get(id)
    /* v8 ignore next -- late or duplicate responses have no waiter. */
    if (!pending) return
    this.pending.delete(id)
    const error = frame.error
    if (error !== null && typeof error === 'object') {
      const record = error as Record<string, unknown>
      /* v8 ignore next -- a missing error.message still becomes a rejection. */
      pending.reject(new Error(typeof record.message === 'string' ? record.message : 'LSP error response'))
      return
    }
    pending.resolve(frame.result)
  }

  private write(message: unknown): Promise<void> {
    if (this.closeReason !== undefined) return Promise.reject(this.closeReason)
    return new Promise<void>((resolve, reject) => {
      const done = (error?: Error | null): void => {
        /* v8 ignore start -- stdin write failures are callback-delivered. */
        if (error === undefined || error === null) {
          resolve()
          return
        }
        this.fail(error)
        reject(error)
        /* v8 ignore stop */
      }
      try {
        this.stdin.write(encodeMessage(message), done)
      /* v8 ignore start -- Node stream write failures are callback-delivered. */
      } catch (error) {
        const failure = asError(error)
        this.fail(failure)
        reject(failure)
      }
      /* v8 ignore stop */
    })
  }

  private exitMessage(): string {
    /* v8 ignore next -- the collect disposition always exposes a stderr reader. */
    const tail = (this.handle.collected.stderr?.readFrom(0).text ?? '').trim()
    /* v8 ignore next -- a non-empty stderr tail is appended when the server wrote any. */
    return tail === '' ? 'language server exited' : `language server exited; stderr: ${tail}`
  }

  /* v8 ignore start -- fail() is reached from stdin/framing/write races. */
  private fail(error: Error): void {
    if (this.closeReason === undefined) this.closeReason = error
    this.failAll(error)
  }
  /* v8 ignore stop */

  private failAll(error: Error): void {
    const waiting = [...this.pending.values()]
    this.pending.clear()
    /* v8 ignore next -- in-flight requests reject when the process closes. */
    for (const pending of waiting) pending.reject(error)
  }
}

/** Answer configuration from static config; reject applyEdit; noop lifecycle. */
export function defaultServerRequest(
  method: string,
  params: unknown,
  configuration: unknown = null,
): Promise<unknown> {
  if (method === 'workspace/configuration') {
    const items = (params as { items?: unknown[] } | undefined)?.items
    const count = Array.isArray(items) ? items.length : 1
    return Promise.resolve(Array.from({ length: count }, () => configuration))
  }
  if (LIFECYCLE_NOOP_METHODS.has(method)) return Promise.resolve(null)
  if (method === 'workspace/applyEdit') {
    return Promise.reject(new Error('workspace/applyEdit is not permitted by this host'))
  }
  return Promise.reject(new Error(`unsupported server request: ${method}`))
}

function asError(value: unknown): Error {
  /* v8 ignore next -- non-Error throw guard. */
  return value instanceof Error ? value : new Error(String(value))
}
