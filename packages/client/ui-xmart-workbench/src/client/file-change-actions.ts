/**
 * Inject-side helpers for the conversation file-change card (no React).
 */
import { normalizeEditorPath } from './editor-nav.ts'
import { isActionable } from './review-counts.ts'
import type { ReviewFileRow, ReviewSessionRow, ReviewTurnRow } from './review-client.ts'

/**
 * The turn that owns `path` (pending first, then any status). Slash / drive case are ignored.
 * @param session - review projection.
 * @param path - file the conversation card is showing.
 */
export function pickReviewTurnForPath(
  session: ReviewSessionRow | undefined,
  path: string,
): ReviewTurnRow | undefined {
  if (session === undefined || !Array.isArray(session.turns)) return undefined
  const turns: readonly ReviewTurnRow[] = session.turns
  const want = normalizeEditorPath(path)
  for (const turn of turns) {
    if (turnHasPath(turn, want, true)) return turn
  }
  for (const turn of turns) {
    if (turnHasPath(turn, want, false)) return turn
  }
  return undefined
}

/**
 * Resolve the review turn that owns `path`, or undefined when review is empty / offline.
 * @param load - fetches the session projection.
 * @param path - file the card is showing.
 */
export async function resolveCardReviewTurn(
  load: () => Promise<ReviewSessionRow>,
  path: string,
): Promise<number | undefined> {
  try {
    const session = await load()
    return pickReviewTurnForPath(session, path)?.turn
  }
  catch {
    return undefined
  }
}

function turnHasPath(turn: ReviewTurnRow, want: string, pendingOnly: boolean): boolean {
  if (!Array.isArray(turn.files)) return false
  const files: readonly ReviewFileRow[] = turn.files
  return files.some((file) => {
    if (normalizeEditorPath(file.path) !== want) return false
    return pendingOnly ? isActionable(file) : true
  })
}
