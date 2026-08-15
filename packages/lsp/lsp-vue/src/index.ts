/**
 * First-party Vue language-server host. Registers a `.vue` provider on
 * `ctx.lsp` and publishes the `vueLsp` Remote namespace for the editor.
 * @module @deepseek-ai/dsh-lsp-vue
 */

import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { LspProviderId } from '@deepseek-ai/dsh-lsp'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-lsp'
import type {} from '@deepseek-ai/dsh-subprocess'
import { VueLspPool } from './provider.ts'
import type { VuePoolOptions } from './provider.ts'
import type {
  VueLspChangeRequest,
  VueLspCloseRequest,
  VueLspCompleteRequest,
  VueLspCompleteResult,
  VueLspDiagnosticsRequest,
  VueLspDiagnosticsResult,
  VueLspOpenRequest,
} from './types.ts'

export type * from './types.ts'
export { VueLspPool } from './provider.ts'
export { VueLspSession } from './session.ts'
export { VueLspConnection, defaultServerRequest } from './connection.ts'
export { fileUrlFor, isVuePath, normalizeCompletions, normalizeDiagnostics } from './protocol.ts'
export { nodeLaunch, resolveVueRuntime, vueServerArgv } from './resolve.ts'

/** Remote-only Vue LSP service plus the `ctx.lsp` provider registration. */
export class VueLspGateway extends TypertRemoteService {
  static inject = ['lsp', 'fs', 'subprocess']

  /** Replaceable pool for tests. */
  poolOverride: VueLspPool | undefined
  private created: VueLspPool | undefined

  constructor(ctx: Context) {
    super(ctx, 'vueLsp')
    ctx.effect(() => ctx.lsp.registerProvider({
      id: LspProviderId('vue'),
      extensionToLanguage: { '.vue': 'vue' },
      query: (request, signal) => this.pool.query(request, signal),
    }), 'lsp-vue.provider')
    ctx.effect(() => () => { void this.pool.disposeAll() }, 'lsp-vue.pool')
  }

  get pool(): VueLspPool {
    if (this.poolOverride !== undefined) return this.poolOverride
    this.created ??= new VueLspPool(this.defaultOptions())
    return this.created
  }

  /**
   * Open a `.vue` buffer (full text). The process stays up for later queries.
   * @param request - workspace, path, and text.
   * @param signal - abort.
   */
  @Remote('open')
  async open(request: VueLspOpenRequest, signal?: AbortSignal): Promise<void> {
    await this.pool.open(request.workspaceRoot, request.path, request.text, signal)
  }

  /**
   * Replace the full text of an open `.vue` buffer.
   * @param request - workspace, path, and text.
   * @param signal - abort.
   */
  @Remote('change')
  async change(request: VueLspChangeRequest, signal?: AbortSignal): Promise<void> {
    await this.pool.change(request.workspaceRoot, request.path, request.text, signal)
  }

  /**
   * Close a `.vue` buffer.
   * @param request - workspace and path.
   * @param signal - abort.
   */
  @Remote('close')
  async close(request: VueLspCloseRequest, signal?: AbortSignal): Promise<void> {
    await this.pool.close(request.workspaceRoot, request.path, signal)
  }

  /**
   * Completions at a zero-based UTF-16 cursor.
   * @param request - workspace, path, and position.
   * @param signal - abort.
   */
  @Remote('complete')
  async complete(request: VueLspCompleteRequest, signal?: AbortSignal): Promise<VueLspCompleteResult> {
    const items = await this.pool.complete(
      request.workspaceRoot,
      request.path,
      request.line,
      request.character,
      signal,
    )
    return { items }
  }

  /**
   * Latest published diagnostics for one buffer (not a session event).
   * @param request - workspace and path.
   * @param signal - abort.
   */
  @Remote('diagnostics')
  async diagnostics(request: VueLspDiagnosticsRequest, signal?: AbortSignal): Promise<VueLspDiagnosticsResult> {
    const items = await this.pool.diagnostics(request.workspaceRoot, request.path, signal)
    return { items }
  }

  private defaultOptions(): VuePoolOptions {
    return {
      fs: this.ctx.fs,
      /* v8 ignore next -- the live pool is constructed in tests via poolOverride. */
      spawn: spec => this.ctx.subprocess.spawn(spec),
    }
  }
}

export default VueLspGateway
