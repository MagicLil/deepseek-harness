/**
 * Newest-first lane assignment for the SCM history graph. When `parents`
 * is missing, each row is treated as the first parent of the next row
 * (a single spine). Merge parents become extra lanes plus a painted edge.
 */
import type { GitLogEntry } from '@deepseek-ai/dsh-client-runtime/client'

/** One ref pill painted on a history row. */
export type GitGraphRef = {
  kind: 'head' | 'branch' | 'remote' | 'tag'
  name: string
}

/** One merge/second-parent edge painted on a row. */
export type GitGraphMerge = {
  from: number
  to: number
}

/** One painted history row. */
export type GitGraphNode = {
  hash: string
  subject: string
  author: string
  timestamp: number
  body?: string
  files?: number
  insertions?: number
  deletions?: number
  originUrl?: string
  lane: number
  railCount: number
  rails: readonly number[]
  merges: readonly GitGraphMerge[]
  refs: readonly GitGraphRef[]
}

/**
 * Assign a lane, continuing rails, and merge edges to each log row.
 * @param rows - `git log` newest first.
 */
export function layoutGitGraph(rows: readonly GitLogEntry[]): GitGraphNode[] {
  const slots: (string | undefined)[] = []
  const out: GitGraphNode[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row === undefined) continue
    let lane = slots.indexOf(row.hash)
    if (lane < 0) {
      lane = slots.indexOf(undefined)
      if (lane < 0) {
        lane = slots.length
        slots.push(row.hash)
      }
      else {
        slots[lane] = row.hash
      }
    }
    const rails: number[] = []
    for (let slot = 0; slot < slots.length; slot++) {
      if (slots[slot] !== undefined) rails.push(slot)
    }
    const parents = parentsOf(row, i, rows)
    const merges: GitGraphMerge[] = []
    slots[lane] = parents[0]
    for (const extra of parents.slice(1)) {
      const existing = slots.indexOf(extra)
      if (existing >= 0) {
        merges.push({ from: lane, to: existing })
        continue
      }
      const dest = slots.indexOf(undefined)
      if (dest < 0) {
        merges.push({ from: lane, to: slots.length })
        slots.push(extra)
      }
      else {
        slots[dest] = extra
        merges.push({ from: lane, to: dest })
      }
    }
    out.push({
      hash: row.hash,
      subject: row.subject,
      author: row.author,
      timestamp: row.timestamp,
      ...row.body !== undefined ? { body: row.body } : {},
      ...row.files !== undefined ? { files: row.files } : {},
      ...row.insertions !== undefined ? { insertions: row.insertions } : {},
      ...row.deletions !== undefined ? { deletions: row.deletions } : {},
      ...row.originUrl !== undefined ? { originUrl: row.originUrl } : {},
      lane,
      railCount: Math.max(slots.length, 1),
      rails,
      merges,
      refs: row.refs ?? [],
    })
  }
  return out
}

function parentsOf(row: GitLogEntry, index: number, rows: readonly GitLogEntry[]): string[] {
  if (row.parents !== undefined) return row.parents.filter(hash => hash.length > 0)
  const next = rows[index + 1]
  return next === undefined ? [] : [next.hash]
}

/** CSS module key for a repeating lane color. */
export function gitLaneClass(lane: number): 'lane0' | 'lane1' | 'lane2' | 'lane3' | 'lane4' | 'lane5' {
  const tone = ((lane % 6) + 6) % 6
  if (tone === 1) return 'lane1'
  if (tone === 2) return 'lane2'
  if (tone === 3) return 'lane3'
  if (tone === 4) return 'lane4'
  if (tone === 5) return 'lane5'
  return 'lane0'
}

/** CSS module key for a ref pill. */
export function gitRefClass(kind: GitGraphRef['kind']): 'refHead' | 'refBranch' | 'refRemote' | 'refTag' {
  if (kind === 'head') return 'refHead'
  if (kind === 'branch') return 'refBranch'
  if (kind === 'tag') return 'refTag'
  return 'refRemote'
}
