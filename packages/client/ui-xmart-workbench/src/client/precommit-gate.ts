/**
 * Whether the Git panel may create a commit (staged files + message + confirm).
 */

/** Why the commit button stays disabled. */
export type PrecommitBlockReason =
  | 'nothing-staged'
  | 'empty-message'
  | 'unconfirmed'

/**
 * True when staged files, a non-empty message, and user confirm are ready.
 * @param opts - commit form snapshot.
 */
export function canCreateCommit(opts: {
  message: string
  stagedCount: number
  confirmed: boolean
}): boolean {
  return precommitBlockReason(opts) === undefined
}

/**
 * First blocking reason, or undefined when the commit may proceed.
 * @param opts - commit form snapshot.
 */
export function precommitBlockReason(opts: {
  message: string
  stagedCount: number
  confirmed: boolean
}): PrecommitBlockReason | undefined {
  if (opts.stagedCount <= 0) return 'nothing-staged'
  if (opts.message.trim() === '') return 'empty-message'
  if (!opts.confirmed) return 'unconfirmed'
  return undefined
}
