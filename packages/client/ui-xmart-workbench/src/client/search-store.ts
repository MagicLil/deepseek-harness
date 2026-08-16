/**
 * Per-session state and pure projection helpers for the workbench search
 * panel. State lives in memory (one store per plugin apply, like the files
 * store) so switching activity-bar panes — which unmounts the search pane —
 * keeps the query and results; nothing persists to localStorage.
 */
import type { FileSearchHit } from '@deepseek-ai/dsh-client-runtime/client'
import { basename, dirname, isUnder, relativeTo } from './route-file.ts'
import type { ExplorerRoot } from './explorer-roots.ts'

/** Where one session's search stands. */
export type SearchStatus = 'idle' | 'searching' | 'done' | 'error'

/** Error class the panel can turn into a locale string. */
export type SearchErrorKind = 'invalid' | 'failed'

/** One session's search panel state. */
export type WorkbenchSearchState = {
  /** Pattern text as typed. */
  query: string
  /** Ripgrep regex mode toggle. */
  regex: boolean
  /** Exact-case toggle. */
  caseSensitive: boolean
  /** Whole-word toggle. */
  wholeWord: boolean
  /** Whether the include/exclude filter rows are visible. */
  filtersOpen: boolean
  /** Positive include glob ('' = unfiltered). */
  include: string
  /** Positive exclude glob ('' = unfiltered). */
  exclude: string
  /** Lifecycle of the latest search. */
  status: SearchStatus
  /** Set when `status` is 'error'. */
  errorKind: SearchErrorKind | null
  /** Flat hits of the latest completed search. */
  hits: readonly FileSearchHit[]
  /** Distinct files across `hits`. */
  fileCount: number
  /** True when the host cut the result at its cap or time budget. */
  truncated: boolean
  /** Collapsed file groups (absolute path → true). */
  collapsed: Record<string, boolean>
}

/** Fresh panel state (also the sentinel for sessions never searched). */
export const EMPTY_SEARCH_STATE: WorkbenchSearchState = Object.freeze({
  query: '',
  regex: false,
  caseSensitive: false,
  wholeWord: false,
  filtersOpen: false,
  include: '',
  exclude: '',
  status: 'idle',
  errorKind: null,
  hits: Object.freeze([]) as readonly FileSearchHit[],
  fileCount: 0,
  truncated: false,
  collapsed: {},
})

/** Search store closed over by the search pane body. */
export type WorkbenchSearchStore = {
  /** Current state for one session ({@link EMPTY_SEARCH_STATE} until written). */
  stateOf: (sessionId: string) => WorkbenchSearchState
  /** Merge a patch into one session's state and notify. */
  update: (sessionId: string, patch: Partial<WorkbenchSearchState>) => void
  /** Subscribe to any session's change. */
  subscribe: (fn: () => void) => () => void
}

/**
 * Create the search store (one per plugin apply).
 * @returns the store face.
 */
export function createWorkbenchSearchStore(): WorkbenchSearchStore {
  const states = new Map<string, WorkbenchSearchState>()
  const listeners = new Set<() => void>()
  return {
    stateOf: sessionId => states.get(sessionId) ?? EMPTY_SEARCH_STATE,
    update: (sessionId, patch) => {
      const current = states.get(sessionId) ?? EMPTY_SEARCH_STATE
      states.set(sessionId, { ...current, ...patch })
      for (const listener of listeners) listener()
    },
    subscribe: (fn) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
  }
}

/** One file group of the results list. */
export type SearchFileGroup = {
  /** Absolute file path (group identity and open target). */
  path: string
  /** File base name (row title). */
  name: string
  /** Root-relative parent directory ('' at the root). */
  dir: string
  /** The file's hits in host order. */
  hits: FileSearchHit[]
}

/**
 * Group flat hits by file (first-seen order — ripgrep emits one file's
 * matches contiguously) and resolve each file's display name against the
 * explorer roots.
 * @param hits - flat hits from the host.
 * @param roots - explorer roots used to relativize the directory label.
 * @returns file groups in output order.
 */
export function groupSearchHits(
  hits: readonly FileSearchHit[],
  roots: readonly ExplorerRoot[],
): SearchFileGroup[] {
  const groups = new Map<string, SearchFileGroup>()
  for (const hit of hits) {
    const existing = groups.get(hit.path)
    if (existing !== undefined) {
      existing.hits.push(hit)
      continue
    }
    const parent = dirname(hit.path)
    const root = roots.find(row => isUnder(hit.path, row.path))
    const dir = root === undefined ? parent : relativeTo(root.path, parent)
    groups.set(hit.path, {
      path: hit.path,
      name: basename(hit.path),
      dir: dir === parent && root === undefined ? parent : dir,
      hits: [hit],
    })
  }
  return [...groups.values()]
}

/** One render segment of a matched line. */
export type SearchLineSegment = {
  /** Segment text. */
  text: string
  /** True when the segment is inside a match span (rendered highlighted). */
  hit: boolean
}

/**
 * Split a matched line into plain/highlight segments the renderer can map
 * onto `<mark>` runs. Overlapping or unsorted spans are merged; span bounds
 * are clamped into the line.
 * @param text - the matched line text.
 * @param spans - UTF-16 `[start, end)` ranges from the host.
 * @returns segments in order; one plain segment when no span survives.
 */
export function splitSearchLine(
  text: string,
  spans: readonly { start: number; end: number }[],
): SearchLineSegment[] {
  const clamped = spans
    .map(span => ({
      start: Math.max(0, Math.min(span.start, text.length)),
      end: Math.max(0, Math.min(span.end, text.length)),
    }))
    .filter(span => span.end > span.start)
    .sort((a, b) => a.start - b.start)
  const merged: { start: number; end: number }[] = []
  for (const span of clamped) {
    const last = merged[merged.length - 1]
    if (last !== undefined && span.start <= last.end) {
      last.end = Math.max(last.end, span.end)
      continue
    }
    merged.push({ ...span })
  }
  if (merged.length === 0) return [{ text, hit: false }]
  const segments: SearchLineSegment[] = []
  let cursor = 0
  for (const span of merged) {
    if (span.start > cursor) segments.push({ text: text.slice(cursor, span.start), hit: false })
    segments.push({ text: text.slice(span.start, span.end), hit: true })
    cursor = span.end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false })
  return segments
}

/**
 * The first highlight span of a hit, as the zero-based cursor the editor
 * should reveal when the row is clicked.
 * @param hit - one search hit.
 * @returns zero-based line/character.
 */
export function revealTarget(hit: FileSearchHit): { line: number; character: number } {
  return { line: Math.max(0, hit.line - 1), character: hit.spans[0]?.start ?? 0 }
}

/**
 * Classify a failed search call into a locale-selectable error class. The
 * runtime's SearchAccessError carries the host RpcError; a `search-invalid`
 * code means the user's pattern (not the host) is at fault. Duck-typed so
 * the panel never imports the runtime error class.
 * @param error - rejection of `ctx.workspaces.search`.
 * @returns 'invalid' for a user-fixable pattern, else 'failed'.
 */
export function classifySearchFailure(error: unknown): SearchErrorKind {
  const code = (error as { rpcError?: { code?: string } } | null)?.rpcError?.code
  return code === 'search-invalid' ? 'invalid' : 'failed'
}

/**
 * Substitute `{n}` / `{m}` counters in a locale template.
 * @param template - locale string carrying `{n}` (and optionally `{m}`).
 * @param n - value for `{n}`.
 * @param m - value for `{m}`.
 * @returns the substituted string.
 */
export function formatSearchCount(template: string, n: number, m?: number): string {
  const withN = template.replaceAll('{n}', String(n))
  return m === undefined ? withN : withN.replaceAll('{m}', String(m))
}
