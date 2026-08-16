/**
 * Typert envelope helpers for `remote.agentReview`.
 * Host methods return `{ ok, value }` / `{ ok:false, error }` RemoteResult.
 * Business payloads that also use `ok` (diff / job results) pass through when
 * they have no `value` twin and their `error` is not a RemoteFailure object.
 */
/**
 * Unwrap a Typert RemoteResult when present.
 * @param promise - remote method promise.
 */
export async function unwrapReview(promise) {
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
