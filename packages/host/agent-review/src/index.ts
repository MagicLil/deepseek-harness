/** Host Remote for Agent change review with per-turn shadow snapshots. */

import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve as resolvePath } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { PreToolDecision, ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-tools'
import { collectOpaqueSnap, readHeadText, readHeadTextForAbs } from './opaque-git.ts'
import type { OpaqueSnap } from './opaque-git.ts'
import { extractOpaquePaths, pathLooksWritten, resultMentionsPath } from './opaque-paths.ts'
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
  /** Before-snapshots + path hints for in-flight opaque tools. */
  private readonly opaqueFlights = new Map<string, OpaqueFlight>()

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
      await this.settleOpaque(exec, result, sessionId, turn, session.header.cwd)
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
    const hinted = new Map<string, OpaqueHint>()
    for (const path of extractOpaquePaths(exec.arguments, undefined, cwd)) {
      const size = await this.disk.sizeOf(path)
      if (size === null) {
        hinted.set(path, { existed: false, text: null })
        continue
      }
      hinted.set(path, {
        existed: true,
        text: size > this.maxShadowBytes ? null : await this.disk.readText(path),
      })
    }
    let snap: OpaqueSnap | null = null
    if (cwd !== undefined && cwd.length > 0) {
      snap = await collectOpaqueSnap(cwd, this.disk, this.maxShadowBytes)
    }
    this.opaqueFlights.set(opaqueKey(sessionId, turn, exec), { snap, hinted })
  }

  private async settleOpaque(
    exec: ToolExecution,
    result: ToolExecutionResult,
    sessionId: string,
    turn: number,
    cwd: string | undefined,
  ): Promise<void> {
    const key = opaqueKey(sessionId, turn, exec)
    const flight = this.opaqueFlights.get(key)
    this.opaqueFlights.delete(key)
    let imported = 0
    const beforeSnap = flight?.snap ?? null
    let afterSnap: OpaqueSnap | null = null
    if (beforeSnap !== null && cwd !== undefined && cwd.length > 0) {
      afterSnap = await collectOpaqueSnap(cwd, this.disk, this.maxShadowBytes)
    }
    if (beforeSnap !== null && afterSnap !== null) {
      for (const plan of planOpaqueMutations(beforeSnap.files, afterSnap.files)) {
        let beforeText = plan.beforeText
        if (beforeText === null && plan.kind !== 'create') {
          beforeText = await readHeadText(beforeSnap.root, plan.relPath)
        }
        await this.review.observe(sessionId, turn, plan.absPath, plan.kind, beforeText)
        imported += 1
      }
    }
    imported += await this.importHintedPaths(exec, result, sessionId, turn, cwd, flight)
    if (imported === 0 && beforeSnap !== null && cwd !== undefined && cwd.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 250))
      const lateSnap = await collectOpaqueSnap(cwd, this.disk, this.maxShadowBytes)
      if (lateSnap !== null) {
        for (const plan of planOpaqueMutations(beforeSnap.files, lateSnap.files)) {
          let beforeText = plan.beforeText
          if (beforeText === null && plan.kind !== 'create') {
            beforeText = await readHeadText(beforeSnap.root, plan.relPath)
          }
          await this.review.observe(sessionId, turn, plan.absPath, plan.kind, beforeText)
          imported += 1
        }
        imported += await this.importHintedPaths(exec, result, sessionId, turn, cwd, flight)
      }
    }
    if (imported === 0) await this.review.markShell(sessionId, turn)
  }

  private async importHintedPaths(
    exec: ToolExecution,
    result: ToolExecutionResult,
    sessionId: string,
    turn: number,
    cwd: string | undefined,
    flight: OpaqueFlight | undefined,
  ): Promise<number> {
    const hinted = flight?.hinted ?? new Map<string, OpaqueHint>()
    const beforeSnap = flight?.snap ?? null
    const candidates = new Set<string>([
      ...hinted.keys(),
      ...extractOpaquePaths(exec.arguments, result, cwd),
    ])
    let imported = 0
    for (const path of candidates) {
      const size = await this.disk.sizeOf(path)
      const exists = size !== null
      const hint = hinted.get(path)
      let existed = hint?.existed
      let beforeText = hint?.text ?? beforeSnap?.files.get(path)?.text ?? null
      if (existed === undefined) {
        const inBefore = beforeSnap?.files.get(path)
        if (inBefore !== undefined && inBefore.code !== 'deleted') {
          existed = true
        } else if (exists) {
          const head = await readHeadTextForAbs(path)
          if (head !== null) {
            existed = true
            beforeText = beforeText ?? head
          } else {
            existed = false
          }
        } else {
          existed = false
        }
      }
      if (!exists && !existed) continue
      if (!exists && existed) {
        await this.review.observe(sessionId, turn, path, 'delete', beforeText)
        imported += 1
        continue
      }
      if (exists && !existed) {
        await this.review.observe(sessionId, turn, path, 'create', null)
        imported += 1
        continue
      }
      const claimed = resultMentionsPath(result, path, cwd) || pathLooksWritten(exec.arguments, path)
      // Same-content overwrite of a named write target still belongs in the
      // dock. The first cursor_agent create often leaves the file on disk; a
      // later "create again" with the same body must not fall back to the
      // yellow shell bar. Prompt-only mentions that did not change stay out.
      if (!claimed && beforeText !== null) {
        const after = await this.disk.readText(path)
        if (after === beforeText) continue
      }
      await this.review.observe(sessionId, turn, path, 'update', beforeText)
      imported += 1
    }
    return imported
  }
}

/** Pre-execute snapshot of one mentioned path. */
interface OpaqueHint {
  readonly existed: boolean
  readonly text: string | null
}

/** In-flight opaque capture: git porcelain plus mentioned-path stats. */
interface OpaqueFlight {
  readonly snap: OpaqueSnap | null
  readonly hinted: Map<string, OpaqueHint>
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
