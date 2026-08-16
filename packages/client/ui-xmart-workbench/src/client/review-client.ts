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

/** localStorage key for a dismissed shell-only warning. */
export function shellDismissKey(sessionId, turn) {
  return `dsh.review.shellDismissed:${sessionId}:${turn}`
}

/**
 * Whether this session/turn's shell warning was dismissed in this browser.
 * @param sessionId - session id.
 * @param turn - turn number.
 */
export function readShellDismissed(sessionId, turn) {
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
export function writeShellDismissed(sessionId, turn) {
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
export async function unwrapReview(promise: Promise<unknown>): Promise<unknown> {
  const raw = await promise
  if (raw !== null && typeof raw === 'object' && 'ok' in raw) {
    const boxed = raw
    if (boxed.ok === true && 'value' in boxed)
      return boxed.value
    if (boxed.ok === false && isRemoteFailure(boxed.error)) {
      throw new Error(boxed.error.message)
    }
  }
  return raw
}
/**
 * Cheap line-count delta for dock list chips (not a real diff).
 * @param before - shadow / empty for create.
 * @param after - current disk text.
 */
export function roughLineStats(before, after) {
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
function isRemoteFailure(error) {
  return error !== null
        && typeof error === 'object'
        && 'message' in error
        && typeof error.message === 'string'
}
