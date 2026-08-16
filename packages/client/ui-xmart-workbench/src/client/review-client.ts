/**
 * Typert envelope helpers for `remote.agentReview`.
 * Host methods return `{ ok, value }` / `{ ok:false, error }` RemoteResult.
 * Business payloads that also use `ok` (diff / job results) pass through when
 * they have no `value` twin and their `error` is not a RemoteFailure object.
 */

/** Host Remote surface used by the Cursor-style review dock. */
export type AgentReviewRemote = {
  get: (request: { sessionId: string }) => Promise<unknown>
  accept: (request: { sessionId: string; turn: number; path: string }) => Promise<unknown>
  acceptAll: (request: { sessionId: string; turn: number }) => Promise<unknown>
  revert: (request: {
    sessionId: string
    turn: number
    path: string
    force?: boolean
  }) => Promise<unknown>
  revertAll: (request: {
    sessionId: string
    turn: number
    force?: boolean
  }) => Promise<unknown>
  dismissShell?: (request: { sessionId: string; turn: number }) => Promise<unknown>
  diff: (request: { sessionId: string; turn: number; path: string }) => Promise<unknown>
}

/** One file row as the dock understands it. */
export type ReviewFileRow = {
  path: string
  kind: 'create' | 'update' | 'delete'
  status: 'pending' | 'accepted' | 'reverted' | 'irreversible'
}

/** One turn bucket. */
export type ReviewTurnRow = {
  turn: number
  shellMaybeMutated: boolean
  files: readonly ReviewFileRow[]
}

/** Session projection. */
export type ReviewSessionRow = {
  sessionId: string
  turns: readonly ReviewTurnRow[]
}

/** Accept / revert result. */
export type ReviewJob = {
  ok: boolean
  error?: string
  skipped?: readonly string[]
  review?: ReviewSessionRow
}

/** before/after texts. */
export type ReviewDiff = {
  path: string
  before: string
  after: string
  ok: boolean
  error?: string
}

/** localStorage key for a dismissed shell-only warning. */
export function shellDismissKey(sessionId: string, turn: number): string {
  return `dsh.review.shellDismissed:${sessionId}:${turn}`
}

/**
 * Whether this session/turn's shell warning was dismissed in this browser.
 * @param sessionId - session id.
 * @param turn - turn number.
 */
export function readShellDismissed(sessionId: string, turn: number): boolean {
  try {
    return globalThis.localStorage?.getItem(shellDismissKey(sessionId, turn)) === '1'
  }
  catch {
    return false
  }
}

/**
 * Remember a shell-warning dismiss so a remount without Host persist still hides it.
 * @param sessionId - session id.
 * @param turn - turn number.
 */
export function writeShellDismissed(sessionId: string, turn: number): void {
  try {
    globalThis.localStorage?.setItem(shellDismissKey(sessionId, turn), '1')
  }
  catch {
    /* private mode / quota */
  }
}

/**
 * Unwrap a Typert RemoteResult when present.
 * @param promise - remote method promise.
 */
export async function unwrapReview<T>(promise: Promise<unknown>): Promise<T> {
  const raw = await promise
  if (raw !== null && typeof raw === 'object' && 'ok' in raw) {
    const boxed = raw as { ok: unknown; value?: T; error?: unknown }
    if (boxed.ok === true && 'value' in boxed)
      return boxed.value as T
    if (boxed.ok === false && isRemoteFailure(boxed.error)) {
      throw new Error(boxed.error.message)
    }
  }
  return raw as T
}
/**
 * Cheap line-count delta for dock list chips (not a real diff).
 * @param before - shadow / empty for create.
 * @param after - current disk text.
 */
export function roughLineStats(before: string, after: string): { add: number; del: number } {
  const beforeLines = before === '' ? 0 : before.split('\n').length
  const afterLines = after === '' ? 0 : after.split('\n').length
  if (before === '')
    return { add: afterLines, del: 0 }
  if (after === '')
    return { add: 0, del: beforeLines }
  return {
    add: Math.max(0, afterLines - beforeLines),
    del: Math.max(0, beforeLines - afterLines),
  }
}
function isRemoteFailure(error: unknown): error is { message: string } {
  return error !== null
        && typeof error === 'object'
        && 'message' in error
        && typeof error.message === 'string'
}
