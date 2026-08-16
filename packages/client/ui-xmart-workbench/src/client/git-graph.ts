/**
 * Newest-first lane assignment, same rules as `git log --graph` / Cursor:
 * HEAD takes lane 0 (left), first parent stays on that lane, extra parents
 * take the leftmost hole. Parents not in the remaining page get a short
 * stub just to the right of the commit — never a dump onto the last lane.
 */
import type { GitLogEntry } from '@deepseek-ai/dsh-client-runtime/client'

/** Horizontal pitch between rails, in px (Cursor-like). */
export const GIT_GRAPH_LANE = 10
/** Left inset so the first dot is not clipped. */
export const GIT_GRAPH_PAD = 10
/** Row height of one history SVG — must match `.history` or rails break. */
export const GIT_GRAPH_ROW = 26
/** Vertical center of the commit dot. */
export const GIT_GRAPH_MID = 13
/** Solid-dot radius for a regular commit. */
export const GIT_GRAPH_DOT = 3.5
/** Inner-dot radius inside a merge ring. */
export const GIT_GRAPH_MERGE_DOT = 1.75
/** Outer ring radius for a merge (Cursor double-circle). */
export const GIT_GRAPH_MERGE_RING = 6
/** Quarter-circle elbow on a merge rail. */
export const GIT_GRAPH_ELBOW = 6
/** Live rails kept at once — more than this becomes a barcode. */
export const GIT_GRAPH_MAX_LANES = 8

/** One ref pill painted on a history row. */
export type GitGraphRef = {
  kind: 'head' | 'branch' | 'remote' | 'tag'
  name: string
}

/** One merge/second-parent edge painted on a row. */
export type GitGraphMerge = {
  from: number
  to: number
  /** Second parent is not nearby — short hook, no continuing rail. */
  stub?: true
  /** Side rail arriving from above into this commit (diamond close). */
  join?: true
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
  /** Two or more parents — Cursor paints a ring around the dot. */
  merge?: true
}

/**
 * SVG width for one row from its live rail count.
 * @param row - a laid-out history row.
 */
export function gitGraphRowWidth(row: Pick<GitGraphNode, 'railCount'>): number {
  return Math.max(row.railCount, 1) * GIT_GRAPH_LANE + GIT_GRAPH_PAD
}

/**
 * Shared graph-column width so every row paints the same rails and
 * subjects line up after the column (Cursor), with no broken verticals.
 * @param rows - laid-out history.
 */
export function gitGraphPageWidth(rows: readonly Pick<GitGraphNode, 'railCount'>[]): number {
  return gitGraphRowWidth({ railCount: Math.max(1, ...rows.map(row => row.railCount)) })
}

/** X center of a rail or commit dot. */
export function gitGraphX(lane: number): number {
  return lane * GIT_GRAPH_LANE + 6
}

/** Cursor gap between the graph column and the subject column. */
export const GIT_GRAPH_TEXT_GAP = 8

/**
 * Shared subject-column start: graph column + Cursor gutter.
 * Every row uses this same value — text never follows a dot.
 * @param pageWidth - {@link gitGraphPageWidth} for the painted page.
 */
export function gitGraphTextInset(pageWidth: number): number {
  return pageWidth + GIT_GRAPH_TEXT_GAP
}

/**
 * Cursor-style merge rail: horizontal, then a quarter-circle down the
 * target lane. A stub stops short of the next row. A join comes from
 * above and turns into the commit.
 * @param from - commit lane (or arriving side rail when `join`).
 * @param to - other-parent lane (or commit lane when `join`).
 * @param stub - parent is not nearby.
 * @param join - close a side rail onto this commit.
 */
export function gitGraphMergePath(from: number, to: number, stub = false, join = false): string {
  const x0 = gitGraphX(from)
  const x1 = gitGraphX(to)
  const mid = GIT_GRAPH_MID
  const radius = Math.min(GIT_GRAPH_ELBOW, Math.abs(x1 - x0) || GIT_GRAPH_ELBOW)
  if (join) {
    if (x0 === x1) return `M ${String(x0)} -1 V ${String(mid)}`
    const dir = x1 > x0 ? 1 : -1
    const sweep = dir > 0 ? 0 : 1
    return [
      `M ${String(x0)} -1`,
      `V ${String(mid - radius)}`,
      `A ${String(radius)} ${String(radius)} 0 0 ${String(sweep)} ${String(x0 + dir * radius)} ${String(mid)}`,
      `H ${String(x1)}`,
    ].join(' ')
  }
  const bottom = stub ? GIT_GRAPH_ROW - 3 : GIT_GRAPH_ROW + 1
  if (x0 === x1) return `M ${String(x0)} ${String(mid)} V ${String(bottom)}`
  const dir = x1 > x0 ? 1 : -1
  const sweep = dir > 0 ? 1 : 0
  return [
    `M ${String(x0)} ${String(mid)}`,
    `H ${String(x1 - dir * radius)}`,
    `A ${String(radius)} ${String(radius)} 0 0 ${String(sweep)} ${String(x1)} ${String(mid + radius)}`,
    `V ${String(bottom)}`,
  ].join(' ')
}

/**
 * Assign a lane, continuing rails, and merge edges to each log row.
 * @param rows - `git log` newest first.
 */
export function layoutGitGraph(rows: readonly GitLogEntry[]): GitGraphNode[] {
  const at = new Map<string, number>()
  for (let i = 0; i < rows.length; i++) {
    const hash = rows[i]?.hash
    if (hash !== undefined) at.set(hash, i)
  }
  const slots: (string | undefined)[] = []
  const out: GitGraphNode[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row === undefined) continue
    let lane = slots.indexOf(row.hash)
    if (lane < 0) {
      lane = takeLane(slots, at, i)
      slots[lane] = row.hash
    }
    const incoming: number[] = []
    for (let slot = 0; slot < slots.length; slot++) {
      if (slot !== lane && slots[slot] === row.hash) incoming.push(slot)
    }
    const rails: number[] = []
    for (let slot = 0; slot < slots.length; slot++) {
      if (slots[slot] !== undefined && !incoming.includes(slot)) rails.push(slot)
    }
    const parents = parentsOf(row, i, rows)
    const merges: GitGraphMerge[] = []
    for (const slot of incoming) {
      merges.push({ from: slot, to: lane, join: true })
      slots[slot] = undefined
    }
    const first = parents[0]
    const firstLane = first === undefined ? -1 : slots.indexOf(first)
    if (first !== undefined && ((at.get(first) ?? -1) > i || firstLane >= 0)) {
      slots[lane] = first
    }
    else {
      slots[lane] = undefined
    }
    for (const extra of parents.slice(1)) {
      const existing = slots.indexOf(extra)
      if (existing >= 0) {
        merges.push({ from: lane, to: existing })
        continue
      }
      if ((at.get(extra) ?? -1) <= i) {
        merges.push({ from: lane, to: lane + 1, stub: true })
        continue
      }
      const dest = slots.indexOf(undefined)
      if (dest >= 0) {
        slots[dest] = extra
        merges.push({ from: lane, to: dest })
        continue
      }
      if (slots.length < GIT_GRAPH_MAX_LANES) {
        merges.push({ from: lane, to: slots.length })
        slots.push(extra)
        continue
      }
      merges.push({ from: lane, to: lane + 1, stub: true })
    }
    while (slots.length > 0 && slots[slots.length - 1] === undefined) slots.pop()
    const extent = Math.max(
      slots.length,
      lane + 1,
      ...merges.map(edge => Math.max(edge.from, edge.to) + 1),
      1,
    )
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
      railCount: extent,
      rails,
      merges,
      refs: row.refs ?? [],
      ...isMergeCommit(row, parents) ? { merge: true } as const : {},
    })
  }
  return out
}

/**
 * Leftmost free rail, or a new one, or a side waiter whose parent is
 * farthest. Lane 0 is the HEAD first-parent spine and is never stolen.
 */
function takeLane(
  slots: (string | undefined)[],
  at: Map<string, number>,
  from: number,
): number {
  const hole = slots.indexOf(undefined)
  if (hole >= 0) return hole
  if (slots.length < GIT_GRAPH_MAX_LANES) {
    slots.push(undefined)
    return slots.length - 1
  }
  let best = Math.max(slots.length - 1, 1)
  let bestScore = -1
  for (let slot = 1; slot < slots.length; slot++) {
    const waiting = slots[slot]
    const when = waiting === undefined ? 1_000_000 : at.get(waiting)
    const score = when === undefined || when <= from ? 1_000_000 : when
    if (score > bestScore) {
      bestScore = score
      best = slot
    }
  }
  return best
}

function isMergeCommit(row: GitLogEntry, parents: readonly string[]): boolean {
  return parents.length > 1 || /^merge\b/i.test(row.subject.trim())
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
