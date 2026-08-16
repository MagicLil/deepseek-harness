/**
 * Duck-typed client over `remote.workspaceChecks` (start / poll / stop).
 */

/** Face mounted on `ctx.remote.workspaceChecks`. */
export type WorkspaceChecksRemote = {
  start: (req: {
    workspaceRoot: string
    argv: readonly string[]
    label?: string
  }) => Promise<unknown>
  poll: (req: {
    runId: string
    stdoutFrom: number
    stderrFrom: number
  }) => Promise<unknown>
  stop: (req: { runId: string }) => Promise<unknown>
}

function asChecksRemote(value: unknown): WorkspaceChecksRemote | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const face = value as Partial<WorkspaceChecksRemote>
  if (typeof face.start !== 'function' || typeof face.poll !== 'function') return undefined
  return face as WorkspaceChecksRemote
}

/**
 * Pull workspaceChecks off a bag, a bare face, or `ctx.get('remote.workspaceChecks')`.
 * @param remote - `{ workspaceChecks }` bag or the face itself.
 * @param lookup - optional `ctx.get`.
 */
export function peekWorkspaceChecks(
  remote: unknown,
  lookup?: (serviceKey: string) => unknown,
): WorkspaceChecksRemote | undefined {
  const direct = asChecksRemote(remote)
  if (direct !== undefined) return direct
  if (remote !== null && typeof remote === 'object') {
    const fromBag = asChecksRemote((remote as { workspaceChecks?: unknown }).workspaceChecks)
    if (fromBag !== undefined) return fromBag
  }
  if (lookup === undefined) return undefined
  try {
    return asChecksRemote(lookup('remote.workspaceChecks'))
  } catch {
    return undefined
  }
}

/**
 * Unwrap a Typert `{ ok, value }` / `{ ok:false, error }` envelope when present.
 * Payload objects that also use an `ok` field (e.g. start result) pass through
 * when they carry no `value`/`error` twin.
 */
export async function unwrapCheck<T>(promise: Promise<unknown>): Promise<T> {
  const raw = await promise
  if (raw !== null && typeof raw === 'object' && 'ok' in raw) {
    const boxed = raw as { ok: boolean; value?: T; error?: { message: string } }
    if (boxed.ok === true && 'value' in boxed) return boxed.value as T
    if (boxed.ok === false && boxed.error !== undefined) {
      throw new Error(boxed.error.message)
    }
  }
  return raw as T
}
