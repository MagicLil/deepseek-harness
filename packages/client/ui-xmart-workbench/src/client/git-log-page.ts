/**
 * Page the SCM graph the way Cursor does: first N rows, then older rows
 * when the history list is scrolled (or the bottom sentinel is visible).
 */
import type { GitLogEntry } from '@deepseek-ai/dsh-client-runtime/client'

/** First paint and each "load more" request. Host caps a single page at 100. */
export const GIT_LOG_PAGE_SIZE = 80

/** Distance from the bottom of the scroller that starts the next page. */
export const GIT_LOG_LOAD_MORE_PX = 80

/**
 * True when this page was full, so older commits may still exist.
 * @param page - newest-first rows from one `gitLog` call.
 * @param pageSize - requested limit.
 */
export function gitLogHasMore(
  page: readonly unknown[],
  pageSize = GIT_LOG_PAGE_SIZE,
): boolean {
  return page.length >= pageSize
}

/**
 * Append older rows, dropping hashes already on screen (a new HEAD can
 * shift `--skip` and overlap the previous page).
 * @param current - rows already painted, newest first.
 * @param next - the next older page, newest first.
 */
export function appendGitLog(
  current: readonly GitLogEntry[],
  next: readonly GitLogEntry[],
): GitLogEntry[] {
  if (next.length === 0) return [...current]
  const seen = new Set(current.map(row => row.hash))
  const extra = next.filter(row => !seen.has(row.hash))
  return extra.length === 0 ? [...current] : [...current, ...extra]
}

/**
 * Merge one older page and decide whether to keep paging. A full page
 * that adds no new hashes is treated as the end (stale host without skip).
 * @param current - rows already painted.
 * @param page - the next older page.
 * @param pageSize - requested limit.
 */
export function mergeGitLogPage(
  current: readonly GitLogEntry[],
  page: readonly GitLogEntry[],
  pageSize = GIT_LOG_PAGE_SIZE,
): { rows: GitLogEntry[]; hasMore: boolean } {
  const rows = appendGitLog(current, page)
  return {
    rows,
    hasMore: gitLogHasMore(page, pageSize) && rows.length > current.length,
  }
}

/**
 * True when the history scroller is close enough to the bottom to fetch.
 * @param el - the overflow container (Git tab body).
 * @param threshold - remaining pixels that count as "near the bottom".
 */
export function shouldLoadMoreFromScroll(
  el: { scrollHeight: number; scrollTop: number; clientHeight: number },
  threshold = GIT_LOG_LOAD_MORE_PX,
): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
}

/**
 * Whether a "load more" request should start.
 * @param root - repository root already painted.
 * @param locked - a page is already in flight.
 * @param hasMore - the last page was full.
 */
export function canRequestGitLogPage(
  root: string | undefined,
  locked: boolean,
  hasMore: boolean,
): root is string {
  return root !== undefined && !locked && hasMore
}

/**
 * Sentinel to observe, or null when paging is done / not mounted.
 * @param hasMore - the last page was full.
 * @param node - the bottom-of-graph element, if any.
 */
export function gitHistoryObserverTarget(
  hasMore: boolean,
  node: Element | null,
): Element | null {
  if (!hasMore || node === null) return null
  return node
}

/**
 * Watch the history sentinel. No-ops when IntersectionObserver is missing
 * (jsdom); the scroll handler still pages.
 * @param target - element at the bottom of the painted graph.
 * @param root - scroll parent, or null for the viewport.
 * @param onVisible - called when the sentinel intersects.
 */
export function observeGitHistorySentinel(
  target: Element,
  root: Element | null,
  onVisible: () => void,
): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {}
  const options: IntersectionObserverInit = { rootMargin: `${GIT_LOG_LOAD_MORE_PX}px` }
  if (root !== null) options.root = root
  const observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) onVisible()
  }, options)
  observer.observe(target)
  return () => { observer.disconnect() }
}
