/** Host Remote for Agent change review with per-turn shadow snapshots. */

import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve as resolvePath } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { PreToolDecision, ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-tools'
import { collectOpaqueSnap, readHeadText } from './opaque-git.ts'
import type { OpaqueSnap } from './opaque-git.ts'
import { isOpaqueMutationTool } from './opaque-tools.ts'
import { planOpaqueMutations } from './opaque-scan.ts'
import { openTurnFromEvents, pathFromToolArgs } from './paths.ts'
import { ReviewEngine } from './review.ts'
import type { ReviewDisk } from './review.ts'
import { parseShellDeletePaths } from './shell-delete-paths.ts'
import {
  DEFAULT_MAX_SHADOW_BYTES,
  FILE_MUTATION_TOOLS,
  SHELL_MAYBE_TOOLS,
} from './types.ts'
import type {
  AgentReviewJobResult,
  Config,
  GetReviewRequest,
  ReviewDiffResult,
  ReviewFileRequest,
  ReviewSession,
  ReviewTurnRequest,
} from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    agentReview: AgentReviewGateway
  }
}

/** Node disk adapter for workspace files (not shadows). */
export function createNodeDisk(): ReviewDisk {
  return {
    async readText(path) {
      try {
        return await readFile(path, 'utf8')
      } catch {
        return null
      }
    },
    async writeText(path, text) {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, text, 'utf8')
    },
    async remove(path) {
      await rm(path, { force: true })
    },
    async sizeOf(path) {
      try {
        const info = await stat(path)
        return info.isFile() ? info.size : null
      } catch {
        return null
      }
    },
  }
}

/**
 * Resolve a tool path against the session cwd when relative.
 * @param requested - tool argument path.
 * @param cwd - session header cwd.
 */
export function resolveToolPath(requested: string, cwd: string | undefined): string {
  if (isAbsolute(requested)) return requested
  return cwd !== undefined && cwd.length > 0 ? resolvePath(cwd, requested) : resolvePath(requested)
}

/** Remote + capture gateway. */
export class AgentReviewGateway extends TypertRemoteService {
  /** Harness home used for shadows. */
  readonly dshHome: string | undefined
  /**
   * Shadow engine. Public so Cordis Proxies forward it; not a @Remote method.
   */
  readonly review: ReviewEngine
  private readonly disk: ReviewDisk
  private readonly maxShadowBytes: number
  private readonly extraOpaque: readonly string[]
  /** Before-snapshots for in-flight opaque tools, keyed by session|turn|call. */
  private readonly opaqueSnaps = new Map<string, OpaqueSnap>()

  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'agentReview')
    this.dshHome = config.dshHome
    this.disk = createNodeDisk()
    this.maxShadowBytes = config.maxShadowBytes ?? DEFAULT_MAX_SHADOW_BYTES
    this.extraOpaque = config.opaqueMutationTools ?? []
    this.review = new ReviewEngine({
      ...(config.dshHome !== undefined ? { dshHome: config.dshHome } : {}),
      maxShadowBytes: this.maxShadowBytes,
      disk: this.disk,
    })
    ctx.effect(() => ctx.on('tools/pre-execute', async (exec: ToolExecution, next: () => Promise<PreToolDecision>) => {
      await this.onPreExecute(exec)
      return next()
    }), 'agent-review: pre-execute')
    ctx.effect(() => ctx.on('tools/result', (exec: ToolExecution, result: ToolExecutionResult) => {
      void this.onResult(exec, result)
    }), 'agent-review: result')
  }

  /**
   * Full review projection for one session.
   * @param request - session id.
   */
  @Remote('get')
  get(request: GetReviewRequest): Promise<ReviewSession> {
    return this.review.get(request.sessionId)
  }

  /**
   * Accept one file.
   * @param request - session/turn/path.
   */
  @Remote('accept')
  accept(request: ReviewFileRequest): Promise<AgentReviewJobResult> {
    return this.review.accept(request.sessionId, request.turn, request.path)
  }

  /**
   * Accept every pending file in a turn.
   * @param request - session/turn.
   */
  @Remote('acceptAll')
  acceptAll(request: ReviewTurnRequest): Promise<AgentReviewJobResult> {
    return this.review.acceptAll(request.sessionId, request.turn)
  }

  /**
   * Revert one file to its shadow.
   * @param request - session/turn/path and optional force.
   */
  @Remote('revert')
  revert(request: ReviewFileRequest): Promise<AgentReviewJobResult> {
    return this.review.revert(
      request.sessionId,
      request.turn,
      request.path,
      request.force === true,
    )
  }

  /**
   * Revert every pending file in a turn.
   * @param request - session/turn and optional force.
   */
  @Remote('revertAll')
  revertAll(request: ReviewTurnRequest): Promise<AgentReviewJobResult> {
    return this.review.revertAll(
      request.sessionId,
      request.turn,
      request.force === true,
    )
  }

  /**
   * before/after texts for one file.
   * @param request - session/turn/path.
   */
  @Remote('diff')
  diff(request: ReviewFileRequest): Promise<ReviewDiffResult> {
    return this.review.diff(request.sessionId, request.turn, request.path)
  }

  /**
   * Persist dismissal of the shell-only warning for one turn.
   * @param request - session/turn.
   */
  @Remote('dismissShell')
  dismissShell(request: ReviewTurnRequest): Promise<AgentReviewJobResult> {
    return this.review.dismissShell(request.sessionId, request.turn)
  }

  private async onPreExecute(exec: ToolExecution): Promise<void> {
    const session = exec.agent?.session
    if (session === undefined) return
    const turn = openTurnFromEvents(session.events)
    if (turn === null) return
    const sessionId = String(session.header.id)
    if (isOpaqueMutationTool(exec.name, this.extraOpaque)) {
      await this.snapshotOpaque(exec, sessionId, turn, session.header.cwd)
      return
    }
    if (SHELL_MAYBE_TOOLS.has(exec.name)) {
      await this.review.markShell(sessionId, turn)
      const command = commandFromToolArgs(exec.arguments)
      if (command !== undefined) {
        for (const requested of parseShellDeletePaths(command)) {
          const path = resolveToolPath(requested, session.header.cwd)
          await this.review.captureDelete(sessionId, turn, path)
        }
      }
      return
    }
    if (!FILE_MUTATION_TOOLS.has(exec.name)) return
    const requested = pathFromToolArgs(exec.arguments)
    if (requested === undefined) return
    const path = resolveToolPath(requested, session.header.cwd)
    await this.review.captureBefore(sessionId, turn, path)
  }

  private async onResult(exec: ToolExecution, result: ToolExecutionResult): Promise<void> {
    const session = exec.agent?.session
    if (session === undefined) return
    const turn = openTurnFromEvents(session.events)
    if (turn === null) return
    const sessionId = String(session.header.id)
    const ok = !result.isError

    if (isOpaqueMutationTool(exec.name, this.extraOpaque)) {
      await this.settleOpaque(exec, sessionId, turn, session.header.cwd)
      return
    }

    if (SHELL_MAYBE_TOOLS.has(exec.name)) {
      const command = commandFromToolArgs(exec.arguments)
      if (command === undefined) return
      for (const requested of parseShellDeletePaths(command)) {
        const path = resolveToolPath(requested, session.header.cwd)
        await this.review.settle(sessionId, turn, path, ok)
      }
      return
    }

    if (!FILE_MUTATION_TOOLS.has(exec.name)) return
    const requested = pathFromToolArgs(exec.arguments)
    if (requested === undefined) return
    const path = resolveToolPath(requested, session.header.cwd)
    await this.review.settle(sessionId, turn, path, ok)
  }

  private async snapshotOpaque(
    exec: ToolExecution,
    sessionId: string,
    turn: number,
    cwd: string | undefined,
  ): Promise<void> {
    if (cwd === undefined || cwd.length === 0) {
      await this.review.markShell(sessionId, turn)
      return
    }
    const snap = await collectOpaqueSnap(cwd, this.disk, this.maxShadowBytes)
    if (snap === null) {
      await this.review.markShell(sessionId, turn)
      return
    }
    this.opaqueSnaps.set(opaqueKey(sessionId, turn, exec), snap)
  }

  private async settleOpaque(
    exec: ToolExecution,
    sessionId: string,
    turn: number,
    cwd: string | undefined,
  ): Promise<void> {
    const key = opaqueKey(sessionId, turn, exec)
    const before = this.opaqueSnaps.get(key)
    this.opaqueSnaps.delete(key)
    if (before === undefined || cwd === undefined || cwd.length === 0) {
      await this.review.markShell(sessionId, turn)
      return
    }
    const after = await collectOpaqueSnap(cwd, this.disk, this.maxShadowBytes)
    if (after === null) {
      await this.review.markShell(sessionId, turn)
      return
    }
    for (const plan of planOpaqueMutations(before.files, after.files)) {
      let beforeText = plan.beforeText
      if (beforeText === null && plan.kind !== 'create') {
        beforeText = await readHeadText(before.root, plan.relPath)
      }
      await this.review.observe(sessionId, turn, plan.absPath, plan.kind, beforeText)
    }
  }
}

function opaqueKey(sessionId: string, turn: number, exec: ToolExecution): string {
  return `${sessionId}\0${turn}\0${String(exec.callId)}`
}

/**
 * Shell `command` string from tool arguments, when present.
 * @param args - tool arguments object.
 */
export function commandFromToolArgs(args: unknown): string | undefined {
  if (args === null || typeof args !== 'object') return undefined
  const command = (args as Record<string, unknown>).command
  return typeof command === 'string' && command.length > 0 ? command : undefined
}

export default AgentReviewGateway
