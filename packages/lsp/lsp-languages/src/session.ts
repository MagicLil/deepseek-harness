/**
 * One persistent language-server process for one workspace. Editor documents
 * stay open; agent queries reuse an open buffer or transient-open.
 * @module @deepseek-ai/dsh-lsp-languages/session
 */

/* jscpd:ignore-start */
import { LspError } from '@deepseek-ai/dsh-lsp'
import type { LspOperation, LspProviderQuery, LspQueryResult } from '@deepseek-ai/dsh-lsp'
import {
  negotiatePositionEncoding,
  normalizeHover,
  normalizeLocations,
  requestMethod,
} from '@deepseek-ai/dsh-lsp-stdio'
import { deadline, timeoutOf } from '@deepseek-ai/dsh-timeout'
import { PersistentLspConnection } from './connection.ts'
import type { ConnectionSpawner, PersistentConnectionSpec } from './connection.ts'
import { fileUrlFor, languageIdFor, normalizeCompletions, normalizeDiagnostics } from './protocol.ts'
import type { EditorLspCompletionItem, EditorLspDiagnostic } from './types.ts'

/** Launch + initialize parameters for one workspace session. */
export interface PersistentSessionSpec extends PersistentConnectionSpec {
  /** Canonical workspace directory (subprocess cwd and path joins). */
  readonly workspacePath: string
  /** Canonical workspace file URI. */
  readonly workspaceUri: string
  /** Static `initialize` options. */
  readonly initializationOptions: unknown
  /** Graceful `shutdown`/`exit` budget before escalation (ms). */
  readonly shutdownTimeoutMs: number
  /** Leading-dot extension → LSP language id for editor opens. */
  readonly extensionToLanguage: Readonly<Record<string, string>>
}

interface OpenDoc {
  version: number
  text: string
}

const CLIENT_CAPABILITIES = {
  general: { positionEncodings: ['utf-16'] },
  workspace: { workspaceFolders: true, configuration: true },
  textDocument: {
    synchronization: { dynamicRegistration: false },
    hover: { contentFormat: ['markdown', 'plaintext'] },
    definition: { linkSupport: true },
    implementation: { linkSupport: true },
    references: {},
    completion: { completionItem: { snippetSupport: false } },
    publishDiagnostics: { relatedInformation: false },
  },
} as const

/** One initialized language-server process. */
export class PersistentLspSession {
  private readonly connection: PersistentLspConnection
  private readonly docs = new Map<string, OpenDoc>()
  private readonly diagnostics = new Map<string, EditorLspDiagnostic[]>()
  private queue: Promise<unknown> = Promise.resolve()
  private disposed = false
  private teardownPromise: Promise<void> | undefined
  private processClosed = false
  private readonly ready: Promise<void>

  constructor(private readonly spec: PersistentSessionSpec, spawner: ConnectionSpawner) {
    this.connection = new PersistentLspConnection(
      spec,
      spawner,
      (method, params) => { this.onNotification(method, params) },
    )
    this.ready = this.initialize()
    this.ready.catch(() => {})
    void this.connection.closed.then(() => { this.processClosed = true })
  }

  get dead(): boolean {
    return this.processClosed || this.disposed || this.connection.failed
  }

  isTransportFailure(error: unknown): boolean {
    return this.connection.failedWith(error)
  }

  /** Latest published diagnostics for a source path. */
  diagnosticsFor(workspaceRoot: string, filePath: string): EditorLspDiagnostic[] {
    return this.diagnostics.get(fileUrlFor(workspaceRoot, filePath)) ?? []
  }

  /**
   * Wait until `initialize` finishes so a later `open` does not pay the handshake.
   * @param signal - abort.
   */
  whenReady(signal?: AbortSignal): Promise<void> {
    return this.enqueue(signal, () => this.ensureReady(signal))
  }

  open(workspaceRoot: string, filePath: string, text: string, signal?: AbortSignal): Promise<void> {
    return this.enqueue(signal, async () => {
      await this.ensureReady(signal)
      const uri = fileUrlFor(workspaceRoot, filePath)
      const existing = this.docs.get(uri)
      if (existing !== undefined) {
        await this.changeUri(uri, text, signal)
        return
      }
      this.docs.set(uri, { version: 1, text })
      await abortable(this.connection.notify('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId: languageIdFor(filePath, this.spec.extensionToLanguage),
          version: 1,
          text,
        },
      }), signal)
    })
  }

  change(workspaceRoot: string, filePath: string, text: string, signal?: AbortSignal): Promise<void> {
    return this.enqueue(signal, async () => {
      await this.ensureReady(signal)
      const uri = fileUrlFor(workspaceRoot, filePath)
      if (!this.docs.has(uri)) {
        this.docs.set(uri, { version: 1, text })
        await abortable(this.connection.notify('textDocument/didOpen', {
          textDocument: {
            uri,
            languageId: languageIdFor(filePath, this.spec.extensionToLanguage),
            version: 1,
            text,
          },
        }), signal)
        return
      }
      await this.changeUri(uri, text, signal)
    })
  }

  close(workspaceRoot: string, filePath: string, signal?: AbortSignal): Promise<void> {
    return this.enqueue(signal, async () => {
      await this.ensureReady(signal)
      const uri = fileUrlFor(workspaceRoot, filePath)
      if (!this.docs.has(uri)) return
      this.docs.delete(uri)
      this.diagnostics.delete(uri)
      /* v8 ignore next -- a dead instance is already tearing down. */
      if (!this.dead) {
        await abortable(this.connection.notify('textDocument/didClose', { textDocument: { uri } }), signal)
      }
    })
  }

  complete(
    workspaceRoot: string,
    filePath: string,
    line: number,
    character: number,
    signal?: AbortSignal,
  ): Promise<readonly EditorLspCompletionItem[]> {
    return this.enqueue(signal, async () => {
      await this.ensureReady(signal)
      const uri = fileUrlFor(workspaceRoot, filePath)
      if (!this.docs.has(uri)) return []
      const payload = await abortable(this.connection.request('textDocument/completion', {
        textDocument: { uri },
        position: { line, character },
      }), signal)
      return normalizeCompletions(payload)
    })
  }

  /**
   * Definition / hover / references on an already-open editor buffer.
   * A closed buffer returns an empty result (same rule as {@link complete}).
   * @param operation - one of the three editor-facing seam operations.
   * @param workspaceRoot - workspace used to mint the document URI.
   * @param filePath - open buffer path.
   * @param line - zero-based line.
   * @param character - zero-based UTF-16 offset.
   * @param signal - abort.
   */
  navigate(
    operation: LspOperation,
    workspaceRoot: string,
    filePath: string,
    line: number,
    character: number,
    signal?: AbortSignal,
  ): Promise<LspQueryResult> {
    return this.enqueue(signal, async () => {
      await this.ensureReady(signal)
      const uri = fileUrlFor(workspaceRoot, filePath)
      if (!this.docs.has(uri)) {
        return operation === 'hover'
          ? { kind: 'hover' as const, hover: null }
          : { kind: 'locations' as const, locations: [], resolvedWorkspaceUri: this.spec.workspaceUri }
      }
      const payload = await abortable(this.connection.request(requestMethod(operation), {
        textDocument: { uri },
        position: { line, character },
        ...(operation === 'findReferences' ? { context: { includeDeclaration: true } } : {}),
      }), signal)
      if (operation === 'hover') {
        return { kind: 'hover' as const, hover: normalizeHover(payload) }
      }
      return {
        kind: 'locations' as const,
        locations: normalizeLocations(payload),
        resolvedWorkspaceUri: this.spec.workspaceUri,
      }
    })
  }

  query(request: LspProviderQuery, source: { fileUrl: string; text: string }, signal?: AbortSignal): Promise<LspQueryResult> {
    return this.enqueue(signal, async () => {
      await this.ensureReady(signal)
      const uri = fileUrlFor(this.spec.workspacePath, request.filePath)
      const persistent = this.docs.has(uri)
      if (!persistent) {
        this.docs.set(uri, { version: 1, text: source.text })
        try {
          await abortable(this.connection.notify('textDocument/didOpen', {
            textDocument: { uri, languageId: request.languageId, version: 1, text: source.text },
          }), signal)
        /* v8 ignore start -- a canceled didOpen tears the instance down. */
        } catch (error) {
          this.docs.delete(uri)
          await this.startTeardown()
          throw error
        }
        /* v8 ignore stop */
      }
      try {
        const payload = await abortable(this.connection.request(requestMethod(request.operation), {
          textDocument: { uri },
          position: request.position,
          ...(request.operation === 'findReferences' ? { context: { includeDeclaration: true } } : {}),
        }), signal)
        if (request.operation === 'hover') {
          return { kind: 'hover' as const, hover: normalizeHover(payload) }
        }
        return {
          kind: 'locations' as const,
          locations: normalizeLocations(payload),
          resolvedWorkspaceUri: this.spec.workspaceUri,
        }
      } finally {
        if (!persistent && !this.dead) {
          this.docs.delete(uri)
          try {
            await this.connection.notify('textDocument/didClose', { textDocument: { uri } })
          /* v8 ignore start -- a close-write failure invalidates the instance. */
          } catch {
            await this.startTeardown()
          }
          /* v8 ignore stop */
        }
      }
    })
  }

  async dispose(): Promise<void> {
    await this.startTeardown()
  }

  private async changeUri(uri: string, text: string, signal?: AbortSignal): Promise<void> {
    const doc = this.docs.get(uri)
    /* v8 ignore next -- callers check membership first. */
    if (doc === undefined) return
    doc.version += 1
    doc.text = text
    await abortable(this.connection.notify('textDocument/didChange', {
      textDocument: { uri, version: doc.version },
      contentChanges: [{ text }],
    }), signal)
  }

  private onNotification(method: string, params: unknown): void {
    /* v8 ignore next -- logs and progress notifications are ignored. */
    if (method !== 'textDocument/publishDiagnostics') return
    /* v8 ignore next -- servers send an object payload. */
    if (params === null || typeof params !== 'object') return
    const record = params as { uri?: unknown; diagnostics?: unknown }
    /* v8 ignore next -- a diagnostic notification without a uri is dropped. */
    if (typeof record.uri !== 'string') return
    if (!this.docs.has(record.uri)) return
    this.diagnostics.set(record.uri, normalizeDiagnostics(record.diagnostics))
  }

  private enqueue<T>(signal: AbortSignal | undefined, run: () => Promise<T>): Promise<T> {
    if (this.disposed) return Promise.reject(new LspError('LSP instance was disposed', 'LSP_DISPOSED'))
    if (signal?.aborted) return Promise.reject(abortError(signal))
    const work = abortable(this.queue, signal)
      .then(run)
      .catch(async (error: unknown) => {
        /* v8 ignore next -- a dead transport is torn down before the next query. */
        if (this.isTransportFailure(error)) await this.startTeardown()
        throw error
      })
    this.queue = this.queue.then(() => work).then(() => undefined, () => undefined)
    return work
  }

  private async ensureReady(signal?: AbortSignal): Promise<void> {
    /* v8 ignore next -- enqueue already rejects a disposed session. */
    if (this.disposed) throw new LspError('LSP instance was disposed', 'LSP_DISPOSED')
    /* v8 ignore next -- enqueue already rejects a pre-aborted signal. */
    if (signal?.aborted) throw abortError(signal)
    try {
      await abortable(this.ready, signal)
    } catch (error) {
      /* v8 ignore next -- a failed handshake that left the process up is torn down here. */
      if (!this.dead) await this.startTeardown()
      throw error
    }
  }

  private async initialize(): Promise<void> {
    const result = await this.connection.request('initialize', {
      processId: null,
      rootUri: this.spec.workspaceUri,
      workspaceFolders: [{ uri: this.spec.workspaceUri, name: 'workspace' }],
      capabilities: CLIENT_CAPABILITIES,
      initializationOptions: this.spec.initializationOptions,
    }) as { capabilities?: { positionEncoding?: string } }
    negotiatePositionEncoding(result.capabilities?.positionEncoding)
    await this.connection.notify('initialized', {})
  }

  private startTeardown(): Promise<void> {
    this.disposed = true
    this.teardownPromise ??= this.tearDown()
    return this.teardownPromise
  }

  private async tearDown(): Promise<void> {
    const shutdownDeadline = deadline(undefined, this.spec.shutdownTimeoutMs, 'LSP_SHUTDOWN')
    try {
      await abortable(this.connection.request('shutdown', null), shutdownDeadline.signal)
      await this.connection.notify('exit', null)
      await abortable(this.connection.closed, shutdownDeadline.signal)
    } catch {
      // Graceful shutdown failed; process-tree cleanup below remains authoritative.
    } finally {
      shutdownDeadline[Symbol.dispose]()
    }
    this.connection.terminate()
    await Promise.all([
      this.connection.closed,
      this.connection.waitForProcessTreeExit(),
    ])
  }
}

/* v8 ignore start -- timeout/mid-flight abort/undefined-signal races are defensive. */
function abortError(signal: AbortSignal): Error {
  const timeout = timeoutOf(signal)
  if (timeout !== undefined) return timeout
  const reason: unknown = signal.reason
  if (reason instanceof Error) return reason
  return new Error('LSP query aborted')
}

function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) return work
  if (signal.aborted) return Promise.reject(abortError(signal))
  const canceled = Promise.withResolvers<never>()
  const onAbort = (): void => { canceled.reject(abortError(signal)) }
  signal.addEventListener('abort', onAbort, { once: true })
  const normalized = work.catch((error: unknown) => {
    throw error instanceof Error ? error : new Error(String(error))
  })
  return Promise.race([normalized, canceled.promise])
    .finally(() => { signal.removeEventListener('abort', onAbort) })
}
/* v8 ignore stop */
/* jscpd:ignore-end */
