/**
 * One Vue language-server process per canonical workspace, registered on
 * `ctx.lsp` for `.vue` only. Editor remotes and agent queries share the pool.
 * @module @deepseek-ai/dsh-lsp-vue/provider
 */

import type { FileSystem } from '@deepseek-ai/dsh-fs'
import { LspError, LspProviderId } from '@deepseek-ai/dsh-lsp'
import type { LspOperation, LspProvider, LspProviderQuery, LspQueryResult } from '@deepseek-ai/dsh-lsp'
import { canonicalizeWorkspace, readHostSource } from '@deepseek-ai/dsh-lsp-stdio'
import { VueLspSession } from './session.ts'
import type { VueSessionSpec } from './session.ts'
import type { ConnectionSpawner } from './connection.ts'
import { nodeLaunch, resolveVueRuntime, vueServerArgv } from './resolve.ts'
import type { VueRuntime } from './resolve.ts'
import type {
  VueLspCompletionItem,
  VueLspDiagnostic,
} from './types.ts'

const MAX_MESSAGE_BYTES = 16_000_000
const MAX_STDERR_BYTES = 1_000_000
const MAX_DOCUMENT_BYTES = 4_000_000
const SHUTDOWN_TIMEOUT_MS = 5_000
const KILL_GRACE_MS = 2_000

type HostWorkspace = Awaited<ReturnType<typeof canonicalizeWorkspace>>
type WorkspaceKey = HostWorkspace['target']['targetKey']

/** How the pool launches and identifies a Vue language-server. */
export interface VuePoolOptions {
  /** Filesystem seam sharing the server's execution world. */
  readonly fs: FileSystem
  /** Subprocess spawn. */
  readonly spawn: ConnectionSpawner
  /** Override the bundled Vue runtime (tests inject a fixture). */
  readonly runtime?: VueRuntime
  /** Extra child env merged after the Node-launch extras. */
  readonly env?: Record<string, string>
}

/** Pooled persistent Vue language-server sessions. */
export class VueLspPool {
  readonly id = LspProviderId('vue')
  readonly extensionToLanguage: Readonly<Record<string, string>> = { '.vue': 'vue' }
  private readonly instances = new Map<WorkspaceKey, VueLspSession>()
  private readonly queues = new Map<WorkspaceKey, Promise<void>>()
  private readonly lifetime = new AbortController()
  private disposed = false
  private runtimeMemo: VueRuntime | undefined

  constructor(private readonly options: VuePoolOptions) {}

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

  /**
   * Launch (or reuse) the workspace session and wait for `initialize`.
   * @param workspaceRoot - folder the server indexes.
   * @param signal - abort.
   */
  async warmup(workspaceRoot: string, signal?: AbortSignal): Promise<void> {
    const session = await this.sessionFor(workspaceRoot, signal)
    await session.whenReady(this.querySignal(signal))
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
  ): Promise<readonly VueLspCompletionItem[]> {
    const session = await this.sessionFor(workspaceRoot, signal)
    return session.complete(workspaceRoot, filePath, line, character, this.querySignal(signal))
  }

  async diagnostics(workspaceRoot: string, filePath: string, signal?: AbortSignal): Promise<readonly VueLspDiagnostic[]> {
    const session = await this.sessionFor(workspaceRoot, signal)
    return session.diagnosticsFor(workspaceRoot, filePath)
  }

  async navigate(
    operation: LspOperation,
    workspaceRoot: string,
    filePath: string,
    line: number,
    character: number,
    signal?: AbortSignal,
  ): Promise<LspQueryResult> {
    const session = await this.sessionFor(workspaceRoot, signal)
    return session.navigate(operation, workspaceRoot, filePath, line, character, this.querySignal(signal))
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
      let session = this.instanceFor(workspaceKey, workspace)
      try {
        return await session.query(request, source, querySignal)
      /* v8 ignore start -- a dead transport is replaced once and the query retried. */
      } catch (error) {
        if (!session.isTransportFailure(error)) throw error
        await session.dispose()
        this.evictIfCurrent(workspaceKey, session)
        this.assertActive(querySignal)
        session = this.instanceFor(workspaceKey, workspace)
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
    this.lifetime.abort(new LspError('lsp-vue provider is disposed', 'LSP_DISPOSED'))
    const live = [...this.instances.values()]
    this.instances.clear()
    await Promise.allSettled(live.map(session => session.dispose()))
  }

  private runtime(): VueRuntime {
    this.runtimeMemo ??= this.options.runtime !== undefined ? this.options.runtime : resolveVueRuntime()
    return this.runtimeMemo
  }

  private async sessionFor(workspaceRoot: string, signal?: AbortSignal): Promise<VueLspSession> {
    this.assertActive(signal)
    const querySignal = this.querySignal(signal)
    const workspace = await canonicalizeWorkspace(this.options.fs, workspaceRoot, querySignal)
    this.assertActive(querySignal)
    return this.instanceFor(workspace.target.targetKey, workspace)
  }

  private instanceFor(workspaceKey: WorkspaceKey, workspace: HostWorkspace): VueLspSession {
    this.assertActive()
    const existing = this.instances.get(workspaceKey)
    /* v8 ignore next -- a dead slot is replaced on the next query. */
    if (existing !== undefined && !existing.dead) return existing
    const created = this.createSession(workspace)
    this.instances.set(workspaceKey, created)
    return created
  }

  private createSession(workspace: HostWorkspace): VueLspSession {
    const launch = nodeLaunch()
    const argv = vueServerArgv(this.runtime(), launch)
    const spec: VueSessionSpec = {
      command: argv.command,
      args: argv.args,
      cwd: workspace.canonicalPath,
      workspacePath: workspace.canonicalPath,
      workspaceUri: workspace.fileUrl,
      env: { ...launch.extraEnv, ...argv.extraEnv, ...this.options.env },
      configuration: null,
      initializationOptions: { typescript: { tsdk: this.runtime().tsdk } },
      maxMessageBytes: MAX_MESSAGE_BYTES,
      maxStderrBytes: MAX_STDERR_BYTES,
      shutdownTimeoutMs: SHUTDOWN_TIMEOUT_MS,
      killGraceMs: KILL_GRACE_MS,
    }
    return new VueLspSession(spec, this.options.spawn)
  }

  /* v8 ignore start -- eviction runs only on a dead transport. */
  private evictIfCurrent(workspace: WorkspaceKey, session: VueLspSession): void {
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
    if (this.isDisposed()) throw new LspError('lsp-vue provider is disposed', 'LSP_DISPOSED')
    if (signal?.aborted) throw new LspError('lsp-vue query aborted', 'LSP_DISPOSED')
  }

  private querySignal(signal?: AbortSignal): AbortSignal {
    return signal === undefined
      ? this.lifetime.signal
      : AbortSignal.any([signal, this.lifetime.signal])
  }
}
