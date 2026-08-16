import type { ReviewFileRow, ReviewSessionRow, ReviewTurnRow } from './review-client.ts'

/** Pure helpers for review counts and pending totals. */

/**
 * Count file kinds and pending rows in one turn.
 * @param turn - turn projection.
 */
export function reviewKindCounts(turn: ReviewTurnRow | undefined): {
  create: number
  update: number
  delete: number
  pending: number
} {
  const out = { create: 0, update: 0, delete: 0, pending: 0 }
  if (turn === undefined || !Array.isArray(turn.files))
    return out
  for (const file of turn.files) {
    if (file.kind === 'create')
      out.create += 1
    else if (file.kind === 'update')
      out.update += 1
    else
      out.delete += 1
    if (file.status === 'pending' || file.status === 'irreversible')
      out.pending += 1
  }
  return out
}
/**
 * Pending (+ irreversible) file count across the session.
 * @param session - review projection.
 */
export function reviewPendingTotal(session: ReviewSessionRow | undefined): number {
  if (session === undefined || !Array.isArray(session.turns))
    return 0
  let total = 0
  for (const turn of session.turns) {
    total += reviewKindCounts(turn).pending
  }
  return total
}
/**
 * Prefer the newest turn that still has pending files, else newest with shell flag.
 * @param session - review projection.
 */
export function pickReviewTurn(session: ReviewSessionRow | undefined): ReviewTurnRow | undefined {
  if (session === undefined || !Array.isArray(session.turns))
    return undefined
  for (const turn of session.turns) {
    if (reviewKindCounts(turn).pending > 0)
      return turn
  }
  for (const turn of session.turns) {
    if (turn.shellMaybeMutated)
      return turn
  }
  return session.turns[0]
}
/**
 * Whether the dock should stay visible for a shell-only warning turn.
 * @param turn - selected turn.
 * @param pending - actionable file count for the session.
 */
export function showShellOnlyWarn(turn: ReviewTurnRow | undefined, pending: number): boolean {
  return pending <= 0 && turn !== undefined && turn.shellMaybeMutated
}
/**
 * Display label for one file status.
 * @param status - review status.
 */
export function isActionable(file: ReviewFileRow): boolean {
  return file.status === 'pending' || file.status === 'irreversible'
}
