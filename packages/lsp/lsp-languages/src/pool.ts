/**
 * One language-server process per canonical workspace. Editor remotes and
 * agent queries share the pool. Launch is async so Java can ensure JDT LS.
 * @module @deepseek-ai/dsh-lsp-languages/pool
 */

/* jscpd:ignore-start */
import type { FileSystem } from '@deepseek-ai/dsh-fs'
import { LspError } from '@deepseek-ai/dsh-lsp'
import type { LspProvider, LspProviderId, LspProviderQuery, LspQueryResult } from '@deepseek-ai/dsh-lsp'
import { canonicalizeWorkspace, readHostSource } from '@deepseek-ai/dsh-lsp-stdio'
import { PersistentLspSession } from './session.ts'
import type { PersistentSessionSpec } from './session.ts'
import type { ConnectionSpawner } from './connection.ts'
import type { EditorLspCompletionItem, EditorLspDiagnostic } from './types.ts'

const MAX_MESSAGE_BYTES = 16_000_000
const MAX_STDERR_BYTES = 1_000_000
const MAX_DOCUMENT_BYTES = 4_000_000
const SHUTDOWN_TIMEOUT_MS = 5_000
const KILL_GRACE_MS = 2_000

type HostWorkspace = Awaited<ReturnType<typeof canonicalizeWorkspace>>
type WorkspaceKey = HostWorkspace['target']['targetKey']

/** Argv + initialize facts for one workspace session. */
export interface SessionLaunch {
  /** Absolute executable (no shell). */
  readonly command: string
  /** Arguments passed to the executable. */
  readonly args: readonly string[]
  /** Extra child env merged after Node-launch extras. */
  readonly extraEnv?: Record<string, string>
  /** Static `initialize` options. */
  readonly initializationOptions?: unknown
  /** Static answer to every `workspace/configuration` item. */
  readonly configuration?: unknown
}

/** How the pool launches and identifies a language-server. */
export interface PersistentLspPoolOptions {
  /** Branded provider id (`typescript` / `java`). */
  readonly id: LspProviderId
  /** Exclusive extension map this pool registers. */
  readonly extensionToLanguage: Readonly<Record<string, string>>
  /** Filesystem seam sharing the server's execution world. */
  readonly fs: FileSystem
  /** Subprocess spawn. */
  readonly spawn: ConnectionSpawner
  /** Extra child env merged after the launch extras. */
  readonly env?: Record<string, string>
  /** Resolve command/args/init options (Java downloads here). */
  readonly launch: (workspace: HostWorkspace) => Promise<SessionLaunch>
}

/** Pooled persistent language-server sessions. */
export class PersistentLspPool {
  readonly id: LspProviderId
  readonly extensionToLanguage: Readonly<Record<string, string>>
  private readonly instances = new Map<WorkspaceKey, PersistentLspSession>()
  private readonly queues = new Map<WorkspaceKey, Promise<void>>()
  private readonly lifetime = new AbortController()
  private disposed = false

  constructor(private readonly options: PersistentLspPoolOptions) {
    this.id = options.id
    this.extensionToLanguage = options.extensionToLanguage
  }

  asProvider(): LspProvider {
    return {
      id: this.id,
      extensionToLanguage: this.extensionToLanguage,
      query: (request, signal) => this.query(request, signal),
    }
  }

  async open(workspaceRoot: string, filePath: string, text: string, signal?: AbortSignal): Promise<void> {
    const session = await this.sessionFor(workspaceRoot, signal)
    await session.open(workspaceRoot, filePath, text, this.querySignal(signal))
  }

  async change(workspaceRoot: string, filePath: string, text: string, signal?: AbortSignal): Promise<void> {
    const session = await this.sessionFor(workspaceRoot, signal)
    await session.change(workspaceRoot, filePath, text, this.querySignal(signal))
  }

  async close(workspaceRoot: string, filePath: string, signal?: AbortSignal): Promise<void> {
    const session = await this.sessionFor(workspaceRoot, signal)
    await session.close(workspaceRoot, filePath, this.querySignal(signal))
  }

  async complete(
    workspaceRoot: string,
    filePath: string,
    line: number,
    character: number,
    signal?: AbortSignal,
  ): Promise<readonly EditorLspCompletionItem[]> {
    const session = await this.sessionFor(workspaceRoot, signal)
    return session.complete(workspaceRoot, filePath, line, character, this.querySignal(signal))
  }

  async diagnostics(workspaceRoot: string, filePath: string, signal?: AbortSignal): Promise<readonly EditorLspDiagnostic[]> {
    const session = await this.sessionFor(workspaceRoot, signal)
    return session.diagnosticsFor(workspaceRoot, filePath)
  }

  async query(request: LspProviderQuery, signal?: AbortSignal): Promise<LspQueryResult> {
    this.assertActive(signal)
    const querySignal = this.querySignal(signal)
    const workspace = await canonicalizeWorkspace(this.options.fs, request.workspaceRoot, querySignal)
    this.assertActive(querySignal)
    const workspaceKey = workspace.target.targetKey
    return this.enqueue(workspaceKey, async () => {
      this.assertActive(querySignal)
      const source = await readHostSource(
        this.options.fs,
        request.filePath,
        workspace,
        MAX_DOCUMENT_BYTES,
        querySignal,
      )
      this.assertActive(querySignal)
      let session = await this.instanceFor(workspaceKey, workspace)
      try {
        return await session.query(request, source, querySignal)
      /* v8 ignore start -- a dead transport is replaced once and the query retried. */
      } catch (error) {
        if (!session.isTransportFailure(error)) throw error
        await session.dispose()
        this.evictIfCurrent(workspaceKey, session)
        this.assertActive(querySignal)
        session = await this.instanceFor(workspaceKey, workspace)
        return await session.query(request, source, querySignal)
      } finally {
        if (session.dead) {
          await session.dispose()
          this.evictIfCurrent(workspaceKey, session)
        }
      }
      /* v8 ignore stop */
    })
  }

  async disposeAll(): Promise<void> {
    this.disposed = true
    this.lifetime.abort(new LspError('lsp-languages provider is disposed', 'LSP_DISPOSED'))
    const live = [...this.instances.values()]
    this.instances.clear()
    await Promise.allSettled(live.map(session => session.dispose()))
  }

  private async sessionFor(workspaceRoot: string, signal?: AbortSignal): Promise<PersistentLspSession> {
    this.assertActive(signal)
    const querySignal = this.querySignal(signal)
    const workspace = await canonicalizeWorkspace(this.options.fs, workspaceRoot, querySignal)
    this.assertActive(querySignal)
    return this.enqueue(workspace.target.targetKey, () => this.instanceFor(workspace.target.targetKey, workspace))
  }

  private async instanceFor(workspaceKey: WorkspaceKey, workspace: HostWorkspace): Promise<PersistentLspSession> {
    this.assertActive()
    const existing = this.instances.get(workspaceKey)
    /* v8 ignore next -- a dead slot is replaced on the next query. */
    if (existing !== undefined && !existing.dead) return existing
    const created = await this.createSession(workspace)
    /* v8 ignore start -- enqueue serializes create; a raced live slot wins. */
    const raced = this.instances.get(workspaceKey)
    if (raced !== undefined && !raced.dead) {
      void created.dispose()
      return raced
    }
    /* v8 ignore stop */
    this.instances.set(workspaceKey, created)
    return created
  }

  private async createSession(workspace: HostWorkspace): Promise<PersistentLspSession> {
    const launch = await this.options.launch(workspace)
    const spec: PersistentSessionSpec = {
      command: launch.command,
      args: launch.args,
      cwd: workspace.canonicalPath,
      workspacePath: workspace.canonicalPath,
      workspaceUri: workspace.fileUrl,
      env: { ...launch.extraEnv, ...this.options.env },
      configuration: launch.configuration ?? null,
      initializationOptions: launch.initializationOptions ?? null,
      extensionToLanguage: this.extensionToLanguage,
      maxMessageBytes: MAX_MESSAGE_BYTES,
      maxStderrBytes: MAX_STDERR_BYTES,
      shutdownTimeoutMs: SHUTDOWN_TIMEOUT_MS,
      killGraceMs: KILL_GRACE_MS,
    }
    return new PersistentLspSession(spec, this.options.spawn)
  }

  /* v8 ignore start -- eviction runs only on a dead transport. */
  private evictIfCurrent(workspace: WorkspaceKey, session: PersistentLspSession): void {
    if (this.instances.get(workspace) === session) this.instances.delete(workspace)
  }
  /* v8 ignore stop */

  private enqueue<T>(workspace: WorkspaceKey, run: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(workspace) ?? Promise.resolve()
    const result = previous.then(run, run)
    /* v8 ignore next -- the tail never rejects, so later callers do not inherit an earlier outcome. */
    const tail = previous.then(() => result).then(() => undefined, () => undefined)
    this.queues.set(workspace, tail)
    void tail.then(() => {
      /* v8 ignore next -- a newer tail owns the slot. */
      if (this.queues.get(workspace) === tail) this.queues.delete(workspace)
    })
    return result
  }

  private isDisposed(): boolean {
    return this.disposed
  }

  private assertActive(signal?: AbortSignal): void {
    if (this.isDisposed()) throw new LspError('lsp-languages provider is disposed', 'LSP_DISPOSED')
    if (signal?.aborted) throw new LspError('lsp-languages query aborted', 'LSP_DISPOSED')
  }

  private querySignal(signal?: AbortSignal): AbortSignal {
    return signal === undefined
      ? this.lifetime.signal
      : AbortSignal.any([signal, this.lifetime.signal])
  }
}
/* jscpd:ignore-end */
