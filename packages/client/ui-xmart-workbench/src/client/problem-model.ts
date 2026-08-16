/**
 * Shared problem row used by the Problems panel (LSP + check parsers).
 */

export type ProblemSeverity = 'error' | 'warning' | 'info' | 'hint'

/** One problem row. */
export type ProblemItem = {
  id: string
  source: 'lsp' | 'typecheck' | 'lint' | 'test' | 'build' | 'other'
  severity: ProblemSeverity
  message: string
  path?: string
  line?: number
  character?: number
  endLine?: number
  endCharacter?: number
}

/** Grouping mode for the Problems list. */
export type ProblemGroupBy = 'file' | 'source' | 'severity'

/** One group in the Problems list. */
export type ProblemGroup = {
  key: string
  label: string
  items: readonly ProblemItem[]
}

const SEVERITY_ORDER: Record<ProblemSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
  hint: 3,
}

/**
 * Sort problems: severity, then path, then line, then message.
 * @param items - unsorted rows.
 */
export function sortProblems(items: readonly ProblemItem[]): ProblemItem[] {
  return [...items].sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sev !== 0) return sev
    const pathA = a.path ?? ''
    const pathB = b.path ?? ''
    if (pathA !== pathB) return pathA.localeCompare(pathB)
    const lineA = a.line ?? -1
    const lineB = b.line ?? -1
    if (lineA !== lineB) return lineA - lineB
    return a.message.localeCompare(b.message)
  })
}

/**
 * Group sorted problems.
 * @param items - rows (will be sorted first).
 * @param by - grouping mode.
 */
export function groupProblems(
  items: readonly ProblemItem[],
  by: ProblemGroupBy,
): readonly ProblemGroup[] {
  const sorted = sortProblems(items)
  const map = new Map<string, ProblemItem[]>()
  for (const item of sorted) {
    const key = groupKey(item, by)
    const bucket = map.get(key)
    if (bucket === undefined) map.set(key, [item])
    else bucket.push(item)
  }
  return [...map.entries()].map(([key, groupItems]) => ({
    key,
    label: key.length === 0 ? '(no file)' : key,
    items: groupItems,
  }))
}

function groupKey(item: ProblemItem, by: ProblemGroupBy): string {
  if (by === 'file') return item.path ?? ''
  if (by === 'source') return item.source
  return item.severity
}

/**
 * Keep problems whose path is under the related set (basename or relative match).
 * @param items - all problems.
 * @param relatedPaths - repo-relative or absolute dirty paths.
 */
export function filterProblemsToRelated(
  items: readonly ProblemItem[],
  relatedPaths: readonly string[],
): readonly ProblemItem[] {
  if (relatedPaths.length === 0) return items
  const norms = new Set(relatedPaths.map(normalizePathKey))
  return items.filter((item) => {
    if (item.path === undefined) return true
    const key = normalizePathKey(item.path)
    if (norms.has(key)) return true
    for (const rel of norms) {
      if (key.endsWith(`/${rel}`) || key.endsWith(`\\${rel}`) || key.endsWith(rel)) return true
    }
    return false
  })
}

/** Slash-normalize and lower-case for path matching on Windows. */
export function normalizePathKey(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

/**
 * Keep problems matching a simple text filter (message / path / source).
 */
export function filterProblemsByQuery(
  items: readonly ProblemItem[],
  query: string,
): readonly ProblemItem[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return items
  return items.filter((item) => {
    if (item.message.toLowerCase().includes(q)) return true
    if (item.source.toLowerCase().includes(q)) return true
    if (item.path !== undefined && item.path.toLowerCase().includes(q)) return true
    return false
  })
}

/**
 * Split an absolute/relative path into basename + parent display fragment.
 */
export function splitProblemPath(path: string): { name: string; dir: string } {
  const norm = path.replace(/\\/g, '/')
  const i = norm.lastIndexOf('/')
  if (i === -1) return { name: norm, dir: '' }
  return { name: norm.slice(i + 1), dir: norm.slice(0, i) }
}

/**
 * Count errors and warnings in a problem list.
 */
export function countProblemSeverities(items: readonly ProblemItem[]): {
  errors: number
  warnings: number
} {
  let errors = 0
  let warnings = 0
  for (const item of items) {
    if (item.severity === 'error') errors += 1
    else if (item.severity === 'warning') warnings += 1
  }
  return { errors, warnings }
}
