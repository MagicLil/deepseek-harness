/** Shared agent-review payloads. JSON-only so they cross the Remote wire. */

/** How one tracked path changed in a turn. */
export type ReviewFileKind = 'create' | 'update' | 'delete'

/** Review lifecycle for one path in one turn. */
export type ReviewFileStatus = 'pending' | 'accepted' | 'reverted' | 'irreversible'

/** One file row in a turn's review. */
export interface ReviewFile {
  /** Absolute workspace path. */
  readonly path: string
  /** Create / update / delete. */
  readonly kind: ReviewFileKind
  /** Accept / revert lifecycle. */
  readonly status: ReviewFileStatus
  /** Relative shadow key under the session shadow dir; empty for create-before. */
  readonly shadowKey: string
  /** Content hash before the first mutation this turn, or null for create. */
  readonly beforeHash: string | null
  /** Content hash after the latest successful mutation, or null if unset. */
  readonly afterHash: string | null
}

/** One agent turn's review bucket. */
export interface ReviewTurn {
  /** Session turn number. */
  readonly turn: number
  /** True when a shell-like tool ran this turn (paths not tracked). */
  readonly shellMaybeMutated: boolean
  /** Files touched by write/edit this turn. */
  readonly files: readonly ReviewFile[]
}

/** Durable per-session review index. */
export interface ReviewSession {
  /** Session id. */
  readonly sessionId: string
  /** Turns newest-first in the API projection. */
  readonly turns: readonly ReviewTurn[]
}

/** Load the review index for one session. */
export interface GetReviewRequest {
  /** Session id. */
  readonly sessionId: string
}

/** Target one file in one turn. */
export interface ReviewFileRequest {
  /** Session id. */
  readonly sessionId: string
  /** Turn number. */
  readonly turn: number
  /** Absolute path. */
  readonly path: string
  /** When true, overwrite disk even if hashes conflict. */
  readonly force?: boolean
}

/** Target every pending file in one turn. */
export interface ReviewTurnRequest {
  /** Session id. */
  readonly sessionId: string
  /** Turn number. */
  readonly turn: number
  /** When true, overwrite disk even if hashes conflict. */
  readonly force?: boolean
}

/** Stable error codes the UI localizes. */
export type AgentReviewErrorCode =
  | 'not-found'
  | 'not-pending'
  | 'dirty-editor'
  | 'conflict'
  | 'irreversible'
  | 'io-error'

/** Mutation result. */
export interface AgentReviewJobResult {
  /** Whether the mutation applied. */
  readonly ok: boolean
  /** Stable error when ok is false. */
  readonly error?: AgentReviewErrorCode
  /** Paths skipped during acceptAll / revertAll. */
  readonly skipped?: readonly string[]
  /** Updated session projection when ok. */
  readonly review?: ReviewSession
}

/** Diff payload for one pending (or settled) file. */
export interface ReviewDiffResult {
  /** Absolute path. */
  readonly path: string
  /** Before text (empty string for create). */
  readonly before: string
  /** Current disk text (or last after when missing). */
  readonly after: string
  /** Whether before came from a shadow. */
  readonly ok: boolean
  /** Error when the shadow cannot be read. */
  readonly error?: AgentReviewErrorCode
}

/** Optional Config for the gateway. */
export interface Config {
  /** Override harness home (`~/.dsh`). */
  readonly dshHome?: string
  /** Max UTF-8 bytes to shadow; larger files become irreversible. */
  readonly maxShadowBytes?: number
}

/** Default shadow size cap (2 MiB). */
export const DEFAULT_MAX_SHADOW_BYTES = 2 * 1024 * 1024

/** Tool names that create review shadows. */
export const FILE_MUTATION_TOOLS = new Set(['write', 'edit', 'str_replace_editor'])

/** Tool names that raise shell-maybe-mutated and may yield heuristic deletes. */
export const SHELL_MAYBE_TOOLS = new Set([
  'bash',
  'pwsh',
  'shell',
  'run_terminal_cmd',
  'execute_bash',
])
