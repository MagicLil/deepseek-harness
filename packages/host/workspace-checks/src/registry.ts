/**
 * In-memory registry for workspace check subprocesses (one live run).
 */
import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess'
import {
  DEFAULT_GRACE_MS,
  DEFAULT_MAX_LOG_BYTES,
  type CheckRunStatus,
  type PollCheckResult,
} from './types.ts'

/** Spawn inputs used by the gateway (testable). */
export type SpawnFn = (spec: {
  argv: readonly string[]
  cwd: string
  graceMs: number
  maxLogBytes: number
  env?: Readonly<Record<string, string>>
}) => SubprocessHandle | Promise<SubprocessHandle>

type LiveRun = {
  runId: string
  label: string | undefined
  handle: SubprocessHandle
  status: CheckRunStatus
  exitCode: number | null
  done: Promise<void>
  /** Async spawn failure message (ENOENT / EINVAL) once `done` rejects. */
  spawnError?: string
  /** Whether poll already emitted {@link spawnError} into stderr. */
  spawnErrorEmitted?: boolean
}

/** Mutable run registry. */
export class CheckRunRegistry {
  private live: LiveRun | null = null
  private finished: LiveRun | null = null

  private seq = 0

  constructor(
    private readonly spawn: SpawnFn,
    private readonly maxLogBytes: number = DEFAULT_MAX_LOG_BYTES,
    private readonly graceMs: number = DEFAULT_GRACE_MS,
  ) {}

  /**
   * Start a new run after stopping any previous live run.
   * @param workspaceRoot - cwd.
   * @param argv - program + args.
   * @param label - optional UI label.
   */
  async start(
    workspaceRoot: string,
    argv: readonly string[],
    label?: string,
  ): Promise<{ runId: string }> {
    if (argv.length === 0 || workspaceRoot.trim().length === 0) {
      throw new InvalidCheckError('workspaceRoot and argv are required')
    }
    if (this.live !== null) await this.stop(this.live.runId)
    const runId = `check-${++this.seq}`
    let handle: SubprocessHandle
    try {
      handle = await this.spawn({
        argv,
        cwd: workspaceRoot,
        graceMs: this.graceMs,
        maxLogBytes: this.maxLogBytes,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new SpawnFailedError(message)
    }
    const run: LiveRun = {
      runId,
      label,
      handle,
      status: 'running',
      exitCode: null,
      done: Promise.resolve(),
    }
    run.done = handle.done.then((outcome) => {
      run.exitCode = outcome.exitCode
      if (run.status !== 'stopped') {
        run.status = outcome.exitCode === 0 ? 'passed' : 'failed'
      }
      this.finished = run
      if (this.live?.runId === runId) this.live = null
    }, (reason: unknown) => {
      if (run.status !== 'stopped') run.status = 'failed'
      run.spawnError = reason instanceof Error ? reason.message : String(reason)
      this.finished = run
      if (this.live?.runId === runId) this.live = null
    })
    this.live = run
    return { runId }
  }

  /**
   * Poll live or finished run output.
   * @param runId - id from start.
   * @param stdoutFrom - byte offset.
   * @param stderrFrom - byte offset.
   */
  poll(runId: string, stdoutFrom: number, stderrFrom: number): PollCheckResult {
    const run = this.find(runId)
    if (run === null) {
      return {
        ok: false,
        status: 'unknown',
        exitCode: null,
        stdout: '',
        stderr: '',
        stdoutNext: stdoutFrom,
        stderrNext: stderrFrom,
        lossy: false,
      }
    }
    const stdoutRead = run.handle.collected.stdout?.readFrom(stdoutFrom)
    const stderrRead = run.handle.collected.stderr?.readFrom(stderrFrom)
    return {
      ok: true,
      status: run.status,
      exitCode: run.exitCode,
      stdout: stdoutRead?.text ?? '',
      stderr: stderrRead?.text ?? '',
      stdoutNext: stdoutRead?.nextOffset ?? stdoutFrom,
      stderrNext: stderrRead?.nextOffset ?? stderrFrom,
      lossy: (stdoutRead?.lossy === true) || (stderrRead?.lossy === true),
      ...(run.label === undefined ? {} : { label: run.label }),
    }
  }

  /**
   * Terminate a live run.
   * @param runId - id from start.
   */
  async stop(runId: string): Promise<boolean> {
    const run = this.live
    if (run === null || run.runId !== runId) return false
    run.status = 'stopped'
    try {
      run.handle.terminate()
    } catch {
      // ignore
    }
    await run.done.catch(() => undefined)
    this.finished = run
    if (this.live?.runId === runId) this.live = null
    return true
  }

  private find(runId: string): LiveRun | null {
    if (this.live?.runId === runId) return this.live
    if (this.finished?.runId === runId) return this.finished
    return null
  }
}

/** Invalid start arguments. */
export class InvalidCheckError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidCheckError'
  }
}

/** Subprocess spawn threw. */
export class SpawnFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SpawnFailedError'
  }
}
