/**
 * Encode / decode agent-review diff tab paths: `turn|absolutePath`.
 */
/**
 * Build a stable tab.path for one review file.
 * @param turn - turn number.
 * @param path - absolute workspace path.
 */
export function encodeAgentReviewPath(turn, path) {
  return `${String(turn)}|${path}`
}
/**
 * Parse a review-diff tab.path.
 * @param encoded - value from {@link encodeAgentReviewPath}.
 */
export function parseAgentReviewPath(encoded) {
  const bar = encoded.indexOf('|')
  if (bar <= 0)
    return undefined
  const turn = Number(encoded.slice(0, bar))
  const path = encoded.slice(bar + 1)
  if (!Number.isFinite(turn) || path.length === 0)
    return undefined
  return { turn, path }
}
