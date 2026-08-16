/**
 * Whether the Git panel may create a commit (user confirm + recommended gates).
 */

/** One gate row as the commit button sees it. */
export type PrecommitGateRow = {
  recommended: boolean
  status: string
}

/** Why the commit button stays disabled. */
export type PrecommitBlockReason =
  | 'nothing-staged'
  | 'empty-message'
  | 'gates-pending'
  | 'gates-failed'
  | 'unconfirmed'

/**
 * True when staged files, a non-empty message, user confirm, and recommended
 * gates are all ready (passed or skipped). No recommended gates → confirm only.
 * @param opts - commit form + gate snapshot.
 */
export function canCreateCommit(opts: {
  message: string
  stagedCount: number
  confirmed: boolean
  gates: readonly PrecommitGateRow[]
}): boolean {
  return precommitBlockReason(opts) === undefined
}

/**
 * First blocking reason, or undefined when the commit may proceed.
 * @param opts - commit form + gate snapshot.
 */
export function precommitBlockReason(opts: {
  message: string
  stagedCount: number
  confirmed: boolean
  gates: readonly PrecommitGateRow[]
}): PrecommitBlockReason | undefined {
  if (opts.stagedCount <= 0) return 'nothing-staged'
  if (opts.message.trim() === '') return 'empty-message'
  const needed = opts.gates.filter(gate => gate.recommended)
  if (needed.some(gate => gate.status === 'failed' || gate.status === 'stopped')) {
    return 'gates-failed'
  }
  if (needed.some(gate => gate.status === 'idle' || gate.status === 'running')) {
    return 'gates-pending'
  }
  if (!opts.confirmed) return 'unconfirmed'
  return undefined
}
