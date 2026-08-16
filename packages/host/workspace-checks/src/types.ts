/** Shared workspace-checks payloads. JSON-only so they cross the Remote wire. */

/** Plugin config (optional overrides for tests). */
export interface Config {
  /** Max in-memory log bytes retained per stream (default 1 MiB). */
  readonly maxLogBytes?: number
  /** Terminate escalation grace in ms (default 3000). */
  readonly graceMs?: number
}

/** Start a check script run. */
export interface StartCheckRequest {
  /** Absolute workspace root (cwd). */
  readonly workspaceRoot: string
  /** Fully resolved argv (`pnpm`, `run`, `lint`, …). */
  readonly argv: readonly string[]
  /** Optional label for the UI (script name). */
  readonly label?: string
}

/** Result of start — or a job error. */
export type StartCheckResult =
  | { readonly ok: true; readonly runId: string }
  | { readonly ok: false; readonly error: { readonly code: 'busy' | 'invalid' | 'spawn-failed'; readonly message: string } }

/** Poll incremental output. */
export interface PollCheckRequest {
  /** Run id from start. */
  readonly runId: string
  /** stdout byte offset (from prior poll). */
  readonly stdoutFrom: number
  /** stderr byte offset. */
  readonly stderrFrom: number
}

/** Run lifecycle status. */
export type CheckRunStatus = 'running' | 'passed' | 'failed' | 'stopped' | 'unknown'

/** Poll response. */
export interface PollCheckResult {
  /** Whether the run id is known. */
  readonly ok: boolean
  /** Lifecycle status. */
  readonly status: CheckRunStatus
  /** Exit code when settled; null while running or signal death. */
  readonly exitCode: number | null
  /** stdout delta since stdoutFrom. */
  readonly stdout: string
  /** stderr delta since stderrFrom. */
  readonly stderr: string
  /** Next stdout offset. */
  readonly stdoutNext: number
  /** Next stderr offset. */
  readonly stderrNext: number
  /** True when an in-memory tail lost head bytes. */
  readonly lossy: boolean
  /** Optional UI label. */
  readonly label?: string
}

/** Stop request. */
export interface StopCheckRequest {
  /** Run id. */
  readonly runId: string
}

/** Stop result. */
export interface StopCheckResult {
  /** True when a live run was signaled. */
  readonly ok: boolean
}

/** Default in-memory collect cap. */
export const DEFAULT_MAX_LOG_BYTES = 1_048_576

/** Default terminate grace. */
export const DEFAULT_GRACE_MS = 3_000
