/** Host Remote for workspace check script runs (typecheck / lint / test / build). */

import type { Context } from '@deepseek-ai/cordis'
import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-subprocess'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { CheckRunRegistry, InvalidCheckError, SpawnFailedError } from './registry.ts'
import { wrapResolvedCheckArgv } from './resolve-argv.ts'
import {
  DEFAULT_GRACE_MS,
  DEFAULT_MAX_LOG_BYTES,
  type Config,
  type PollCheckRequest,
  type PollCheckResult,
  type StartCheckRequest,
  type StartCheckResult,
  type StopCheckRequest,
  type StopCheckResult,
} from './types.ts'

export type * from './types.ts'
export { CheckRunRegistry, InvalidCheckError, SpawnFailedError } from './registry.ts'
export { wrapResolvedCheckArgv, WINDOWS_CHECK_EXECUTABLE_ENV } from './resolve-argv.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    workspaceChecks: WorkspaceChecksGateway
  }
}

/** Remote gateway over `ctx.subprocess`. */
export class WorkspaceChecksGateway extends TypertRemoteService {
  static inject = ['subprocess']

  /** Run registry (replaceable in tests). */
  registry: CheckRunRegistry

  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'workspaceChecks')
    const maxLogBytes = config.maxLogBytes ?? DEFAULT_MAX_LOG_BYTES
    const graceMs = config.graceMs ?? DEFAULT_GRACE_MS
    this.registry = new CheckRunRegistry(
      spec => this.spawnCollect(spec.argv, spec.cwd, spec.graceMs, spec.maxLogBytes),
      maxLogBytes,
      graceMs,
    )
  }

  /**
   * Start one check subprocess (stops any previous live run).
   * @param request - cwd + argv.
   */
  @Remote('start')
  async start(request: StartCheckRequest): Promise<StartCheckResult> {
    try {
      const { runId } = await this.registry.start(
        request.workspaceRoot,
        request.argv,
        request.label,
      )
      return { ok: true, runId }
    } catch (error) {
      if (error instanceof InvalidCheckError) {
        return { ok: false, error: { code: 'invalid', message: error.message } }
      }
      if (error instanceof SpawnFailedError) {
        return { ok: false, error: { code: 'spawn-failed', message: error.message } }
      }
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, error: { code: 'spawn-failed', message } }
    }
  }

  /**
   * Poll stdout/stderr deltas and status.
   * @param request - run id + offsets.
   */
  @Remote('poll')
  poll(request: PollCheckRequest): Promise<PollCheckResult> {
    return Promise.resolve(this.registry.poll(
      request.runId,
      request.stdoutFrom,
      request.stderrFrom,
    ))
  }

  /**
   * Stop a live run.
   * @param request - run id.
   */
  @Remote('stop')
  async stop(request: StopCheckRequest): Promise<StopCheckResult> {
    const ok = await this.registry.stop(request.runId)
    return { ok }
  }

  private async spawnCollect(
    argv: readonly string[],
    cwd: string,
    graceMs: number,
    maxLogBytes: number,
  ): Promise<SubprocessHandle> {
    const [program, ...args] = argv
    if (program === undefined || program.length === 0) {
      throw new InvalidCheckError('argv must contain a program')
    }
    // Prefer an absolute PATH hit; on miss keep the bare name so Windows can
    // still ask cmd.exe (and surface "not recognized" on stderr).
    const resolved = await this.ctx.subprocess.resolveExecutable(program).catch(() => program)
    const wrapped = wrapResolvedCheckArgv(resolved, args)
    return this.ctx.subprocess.spawn({
      argv: wrapped.argv,
      cwd,
      graceMs,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: maxLogBytes },
        stderr: { maxBytes: maxLogBytes },
      },
      ...(wrapped.env !== undefined ? { env: wrapped.env } : {}),
    })
  }
}

export default WorkspaceChecksGateway
