/** Pure porcelain parse + before/after planning for opaque mutators. */

import type { ReviewFileKind } from './types.ts'

/** Coarse porcelain class used to plan create/update/delete. */
export type OpaqueCode = 'untracked' | 'deleted' | 'changed'

/** One path as seen in `git status --porcelain=v1`. */
export interface OpaqueRow {
  /** Path relative to the repository root. */
  readonly relPath: string
  /** Coarse class. */
  readonly code: OpaqueCode
}

/** Disk snapshot of one porcelain path. */
export interface OpaqueFileSnap {
  /** Path relative to the repository root. */
  readonly relPath: string
  /** Absolute workspace path. */
  readonly absPath: string
  /** Coarse porcelain class. */
  readonly code: OpaqueCode
  /** Content hash, or a sentinel when unread. */
  readonly hash: string | null
  /** UTF-8 body when it was safe to read. */
  readonly text: string | null
}

/** One mutation to import into the review engine. */
export interface OpaquePlan {
  /** Absolute workspace path. */
  readonly absPath: string
  /** Path relative to the repository root (for `git show HEAD:`). */
  readonly relPath: string
  /** Review kind. */
  readonly kind: ReviewFileKind
  /** Shadow body when already known; null means try HEAD or mark irreversible. */
  readonly beforeText: string | null
}

/**
 * Parse `git status --porcelain=v1` (optional `##` branch header ignored).
 * @param stdout - porcelain text.
 */
export function parseOpaquePorcelain(stdout: string): Map<string, OpaqueRow> {
  const rows = new Map<string, OpaqueRow>()
  for (const line of stdout.split(/\r?\n/)) {
    if (line.startsWith('##') || line.length < 4) continue
    const index = line.slice(0, 1)
    const worktree = line.slice(1, 2)
    const relPath = renameTarget(line.slice(3))
    if (relPath === '') continue
    rows.set(relPath, { relPath, code: classifyPair(index, worktree) })
  }
  return rows
}

/**
 * Diff two absolute-path snapshots into review import plans.
 * Same-hash rows are skipped. Callers fill `beforeText` from HEAD when null
 * and the kind is not `create`.
 * @param before - snapshot taken on `tools/pre-execute`.
 * @param after - snapshot taken on `tools/result`.
 */
export function planOpaqueMutations(
  before: ReadonlyMap<string, OpaqueFileSnap>,
  after: ReadonlyMap<string, OpaqueFileSnap>,
): OpaquePlan[] {
  const plans: OpaquePlan[] = []
  for (const [absPath, row] of after) {
    const prev = before.get(absPath)
    if (prev === undefined) {
      if (row.code === 'deleted') {
        plans.push({ absPath, relPath: row.relPath, kind: 'delete', beforeText: null })
      } else if (row.code === 'untracked') {
        plans.push({ absPath, relPath: row.relPath, kind: 'create', beforeText: null })
      } else {
        plans.push({ absPath, relPath: row.relPath, kind: 'update', beforeText: null })
      }
      continue
    }
    if (row.code === 'deleted') {
      plans.push({ absPath, relPath: row.relPath, kind: 'delete', beforeText: prev.text })
      continue
    }
    if (row.hash !== prev.hash) {
      plans.push({
        absPath,
        relPath: row.relPath,
        kind: prev.hash === null ? 'create' : 'update',
        beforeText: prev.text,
      })
    }
  }
  for (const [absPath, prev] of before) {
    if (after.has(absPath)) continue
    if (prev.hash === null) continue
    plans.push({ absPath, relPath: prev.relPath, kind: 'delete', beforeText: prev.text })
  }
  return plans
}

function classifyPair(index: string, worktree: string): OpaqueCode {
  if (index === '?' && worktree === '?') return 'untracked'
  if (index === 'D' || worktree === 'D') return 'deleted'
  return 'changed'
}

function renameTarget(rest: string): string {
  const arrow = rest.indexOf(' -> ')
  const raw = arrow >= 0 ? rest.slice(arrow + 4) : rest
  return unquote(raw.trim())
}

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replaceAll('\\"', '"')
  }
  return value
}
