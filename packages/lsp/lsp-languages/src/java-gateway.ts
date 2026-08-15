/**
 * Java language-server host. Registers `.java` on `ctx.lsp` and publishes
 * the `javaLsp` Remote namespace. JDT LS is resolved or downloaded on first use.
 * @module @deepseek-ai/dsh-lsp-languages/java-gateway
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { LspProviderId } from '@deepseek-ai/dsh-lsp'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-lsp'
import type {} from '@deepseek-ai/dsh-subprocess'
import { PersistentLspPool } from './pool.ts'
import type { PersistentLspPoolOptions } from './pool.ts'
import { JAVA_EXTENSION_TO_LANGUAGE } from './protocol.ts'
import { javaSessionLaunch } from './resolve-java.ts'
import type {
  EditorLspChangeRequest,
  EditorLspCloseRequest,
  EditorLspCompleteRequest,
  EditorLspCompleteResult,
  EditorLspDiagnosticsRequest,
  EditorLspDiagnosticsResult,
  EditorLspHoverResult,
  EditorLspLocationsResult,
  EditorLspOpenRequest,
  EditorLspWarmupRequest,
} from './types.ts'
import { toEditorHover, toEditorLocations } from './types.ts'

/** Remote-only Java LSP service plus the `ctx.lsp` provider registration. */
export class JavaLspGateway extends TypertRemoteService {
  static inject = ['lsp', 'fs', 'subprocess']

  /** Replaceable pool for tests. */
  poolOverride: PersistentLspPool | undefined
  private created: PersistentLspPool | undefined

  constructor(ctx: Context) {
    super(ctx, 'javaLsp')
    ctx.effect(() => ctx.lsp.registerProvider({
      id: LspProviderId('java'),
      extensionToLanguage: JAVA_EXTENSION_TO_LANGUAGE,
      query: (request, signal) => this.pool.query(request, signal),
    }), 'lsp-languages.java.provider')
    ctx.effect(() => () => { void this.pool.disposeAll() }, 'lsp-languages.java.pool')
  }

  get pool(): PersistentLspPool {
    if (this.poolOverride !== undefined) return this.poolOverride
    this.created ??= new PersistentLspPool(this.defaultOptions())
    return this.created
  }

  /**
   * Open a Java buffer (full text).
   * @param request - workspace, path, and text.
   * @param signal - abort.
   */
  @Remote('open')
  async open(request: EditorLspOpenRequest, signal?: AbortSignal): Promise<void> {
    await this.pool.open(request.workspaceRoot, request.path, request.text, signal)
  }

  /**
   * Replace the full text of an open Java buffer.
   * @param request - workspace, path, and text.
   * @param signal - abort.
   */
  @Remote('change')
  async change(request: EditorLspChangeRequest, signal?: AbortSignal): Promise<void> {
    await this.pool.change(request.workspaceRoot, request.path, request.text, signal)
  }

  /**
   * Close a Java buffer.
   * @param request - workspace and path.
   * @param signal - abort.
   */
  @Remote('close')
  async close(request: EditorLspCloseRequest, signal?: AbortSignal): Promise<void> {
    await this.pool.close(request.workspaceRoot, request.path, signal)
  }

  /**
   * Completions at a zero-based UTF-16 cursor.
   * @param request - workspace, path, and position.
   * @param signal - abort.
   */
  @Remote('complete')
  async complete(request: EditorLspCompleteRequest, signal?: AbortSignal): Promise<EditorLspCompleteResult> {
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
  async diagnostics(request: EditorLspDiagnosticsRequest, signal?: AbortSignal): Promise<EditorLspDiagnosticsResult> {
    const items = await this.pool.diagnostics(request.workspaceRoot, request.path, signal)
    return { items }
  }

  /**
   * Go-to-definition at a zero-based UTF-16 cursor on an open buffer.
   * @param request - workspace, path, and position.
   * @param signal - abort.
   */
  @Remote('definition')
  async definition(request: EditorLspCompleteRequest, signal?: AbortSignal): Promise<EditorLspLocationsResult> {
    return toEditorLocations(await this.pool.navigate(
      'goToDefinition',
      request.workspaceRoot,
      request.path,
      request.line,
      request.character,
      signal,
    ))
  }

  /**
   * Hover documentation at a zero-based UTF-16 cursor on an open buffer.
   * @param request - workspace, path, and position.
   * @param signal - abort.
   */
  @Remote('hover')
  async hover(request: EditorLspCompleteRequest, signal?: AbortSignal): Promise<EditorLspHoverResult> {
    return toEditorHover(await this.pool.navigate(
      'hover',
      request.workspaceRoot,
      request.path,
      request.line,
      request.character,
      signal,
    ))
  }

  /**
   * Find-references at a zero-based UTF-16 cursor on an open buffer.
   * @param request - workspace, path, and position.
   * @param signal - abort.
   */
  @Remote('references')
  async references(request: EditorLspCompleteRequest, signal?: AbortSignal): Promise<EditorLspLocationsResult> {
    return toEditorLocations(await this.pool.navigate(
      'findReferences',
      request.workspaceRoot,
      request.path,
      request.line,
      request.character,
      signal,
    ))
  }

  /**
   * Go-to-implementation at a zero-based UTF-16 cursor on an open buffer.
   * @param request - workspace, path, and position.
   * @param signal - abort.
   */
  @Remote('implementation')
  async implementation(request: EditorLspCompleteRequest, signal?: AbortSignal): Promise<EditorLspLocationsResult> {
    return toEditorLocations(await this.pool.navigate(
      'goToImplementation',
      request.workspaceRoot,
      request.path,
      request.line,
      request.character,
      signal,
    ))
  }

  /**
   * Start JDT LS for this workspace before any Java buffer is opened.
   * @param request - workspace root.
   * @param signal - abort.
   */
  @Remote('warmup')
  async warmup(request: EditorLspWarmupRequest, signal?: AbortSignal): Promise<void> {
    await this.pool.warmup(request.workspaceRoot, signal)
  }

  private defaultOptions(): PersistentLspPoolOptions {
    return {
      id: LspProviderId('java'),
      extensionToLanguage: JAVA_EXTENSION_TO_LANGUAGE,
      fs: this.ctx.fs,
      /* v8 ignore next -- the live pool is constructed in tests via poolOverride. */
      spawn: spec => this.ctx.subprocess.spawn(spec),
      /* v8 ignore next -- launch is covered by javaSessionLaunch tests. */
      launch: workspace => javaSessionLaunch(workspace.canonicalPath),
    }
  }
}
/* jscpd:ignore-end */
