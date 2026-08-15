/** Unwrap a Typert RemoteResult or throw the wire error. */

export type RemoteResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

/**
 * Read a successful Remote payload.
 * @param label - method name for the thrown message.
 * @param result - wire result.
 */
export function unwrapRemote<T>(label: string, result: RemoteResult<T>): T {
  if (!result.ok) throw new Error(`${label} failed: ${result.error.code}: ${result.error.message}`)
  return result.value
}
