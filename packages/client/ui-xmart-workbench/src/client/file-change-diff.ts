/**
 * Line-aligned unified diff for the conversation file-change card.
 * Small hunks use LCS; oversized pairs fall back to delete-then-add.
 */

/** One applied hunk, the same shape the write/edit tools put on `card:'diff'`. */
export interface FileChangeHunk {
  path: string
  oldText: string | null
  newText: string
}

/** Word-level mark inside a replaced line. */
export type DiffMark = { kind: 'eq' | 'ins' | 'del'; text: string }

/** One flattened body row (path headers live on the card chrome, not here). */
export interface FileChangeLine {
  kind: 'add' | 'del' | 'ctx' | 'gap'
  text: string
  line?: number
  marks?: DiffMark[]
}

/** Skip LCS when the DP table would be larger than this many cells. */
export const LCS_CELL_CAP = 40_000

type AlignOp = { kind: 'eq' | 'del' | 'add'; text: string }

/**
 * Split a side's text into content lines. A trailing newline is a terminator.
 * @param text - one hunk side.
 */
export function contentLines(text: string): string[] {
  if (text === '') return []
  const body = text.endsWith('\n') ? text.slice(0, -1) : text
  return body.split('\n')
}

/**
 * Align two line arrays into equal / delete / add ops.
 * @param oldLines - prior content lines.
 * @param newLines - content after the change.
 */
export function alignLines(oldLines: string[], newLines: string[]): AlignOp[] {
  return lcsAlign(oldLines, newLines)
}

/**
 * True when every hunk is a create (`oldText === null`).
 * @param hunks - applied hunks.
 */
export function isCreateHunks(hunks: readonly { oldText: string | null }[]): boolean {
  return hunks.length > 0 && hunks.every(hunk => hunk.oldText === null)
}

/**
 * Flatten hunks into aligned card body rows.
 * A same-file second hunk opens with a `⋯` gap instead of repeating the path.
 * @param hunks - applied hunks in file order.
 */
export function flattenFileChangeLines(hunks: readonly FileChangeHunk[]): FileChangeLine[] {
  const rows: FileChangeLine[] = []
  let wrote = false
  for (const hunk of hunks) {
    const oldLines = hunk.oldText === null ? [] : contentLines(hunk.oldText)
    const aligned = alignLines(oldLines, contentLines(hunk.newText))
    if (aligned.length === 0) continue
    if (wrote) rows.push({ kind: 'gap', text: '⋯' })
    wrote = true
    for (const row of rowsFromAligned(aligned)) rows.push(row)
  }
  return rows
}

/**
 * 1-based index of `needle` when it occurs exactly once in `fileText`.
 * @param fileText - current disk text.
 * @param needle - a full line to find.
 */
export function locateLine(fileText: string, needle: string): number | undefined {
  if (needle === '') return undefined
  const lines = contentLines(fileText)
  let found: number | undefined
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== needle) continue
    if (found !== undefined) return undefined
    found = i + 1
  }
  return found
}

/**
 * Infer the 1-based new-file line of the first numbered body row.
 * Creates start at 1. Edits locate a unique add/ctx (or del while disk is old).
 * @param fileText - current disk text, when the card could read it.
 * @param rows - aligned body rows.
 * @param isCreate - every hunk had `oldText === null`.
 */
export function inferStartLine(
  fileText: string | undefined,
  rows: readonly FileChangeLine[],
  isCreate: boolean,
): number | undefined {
  if (isCreate) return rows.length > 0 ? 1 : undefined
  if (fileText === undefined) return undefined
  for (const row of rows) {
    if (row.kind !== 'add' && row.kind !== 'ctx') continue
    const start = startFromHit(fileText, row, rows, 'new')
    if (start !== undefined) return start
  }
  for (const row of rows) {
    if (row.kind !== 'del') continue
    const start = startFromHit(fileText, row, rows, 'old')
    if (start !== undefined) return start
  }
  return undefined
}

/**
 * Stamp new-file line numbers onto ctx/add (increment) and del (same line).
 * @param rows - aligned body rows.
 * @param start - 1-based new-file line of the first ctx/add/del.
 */
export function applyNewLineNumbers(
  rows: readonly FileChangeLine[],
  start: number,
): FileChangeLine[] {
  let n = start
  return rows.map((row) => {
    if (row.kind === 'gap') return row
    if (row.kind === 'del') return { ...row, line: n }
    const line = n
    n += 1
    return { ...row, line }
  })
}

/**
 * Zero-based reveal for the first numbered change (add/del, else any numbered row).
 * @param rows - numbered body rows.
 */
export function firstChangeReveal(
  rows: readonly FileChangeLine[],
): { line: number; character: number } | undefined {
  const hit = rows.find(row => row.line !== undefined && (row.kind === 'add' || row.kind === 'del'))
    ?? rows.find(row => row.line !== undefined)
  if (hit?.line === undefined) return undefined
  return { line: hit.line - 1, character: 0 }
}

/**
 * Git-style unified patch the card copies. `@@` is omitted when the start line is unknown.
 * @param displayPath - workspace-relative path shown on the card.
 * @param rows - aligned body rows.
 * @param start - 1-based new-file start, when known.
 * @param isCreate - write/create hunks.
 */
export function formatPatch(
  displayPath: string,
  rows: readonly FileChangeLine[],
  start: number | undefined,
  isCreate: boolean,
): string {
  const body = rows.map((row) => {
    if (row.kind === 'add') return `+${row.text}`
    if (row.kind === 'del') return `-${row.text}`
    if (row.kind === 'ctx') return ` ${row.text}`
    return row.text
  })
  const header = isCreate
    ? ['--- /dev/null', `+++ b/${displayPath}`]
    : [`--- a/${displayPath}`, `+++ b/${displayPath}`]
  if (start === undefined) return [...header, ...body].join('\n')
  let oldCount = 0
  let newCount = 0
  for (const row of rows) {
    if (row.kind === 'ctx' || row.kind === 'del') oldCount += 1
    if (row.kind === 'ctx' || row.kind === 'add') newCount += 1
  }
  const hunk = isCreate
    ? `@@ -0,0 +1,${String(newCount)} @@`
    : `@@ -${String(start)},${String(oldCount)} +${String(start)},${String(newCount)} @@`
  return [...header, hunk, ...body].join('\n')
}

function startFromHit(
  fileText: string,
  row: FileChangeLine,
  rows: readonly FileChangeLine[],
  side: 'new' | 'old',
): number | undefined {
  const hit = locateLine(fileText, row.text)
  if (hit === undefined) return undefined
  let start = hit
  for (const prev of rows) {
    if (prev === row) break
    if (side === 'new' && (prev.kind === 'add' || prev.kind === 'ctx')) start -= 1
    if (side === 'old' && (prev.kind === 'del' || prev.kind === 'ctx')) start -= 1
  }
  return start > 0 ? start : undefined
}

function rowsFromAligned(ops: readonly AlignOp[]): FileChangeLine[] {
  const rows: FileChangeLine[] = []
  let skip = 0
  for (const [index, op] of ops.entries()) {
    if (index < skip) continue
    if (op.kind === 'eq') {
      rows.push({ kind: 'ctx', text: op.text })
      continue
    }
    const dels: string[] = []
    const adds: string[] = []
    let consumed = 0
    for (const next of ops.slice(index)) {
      if (next.kind === 'eq') break
      if (next.kind === 'del') dels.push(next.text)
      else adds.push(next.text)
      consumed += 1
    }
    skip = index + consumed
    const shared = Math.min(dels.length, adds.length)
    for (const [oldLine, newLine] of zip(dels, adds, shared)) {
      const marks = markReplace(oldLine, newLine)
      rows.push(withMarks({ kind: 'del', text: oldLine }, marks.del))
      rows.push(withMarks({ kind: 'add', text: newLine }, marks.add))
    }
    for (const extra of dels.slice(shared)) rows.push({ kind: 'del', text: extra })
    for (const extra of adds.slice(shared)) rows.push({ kind: 'add', text: extra })
  }
  return rows
}

function zip(left: readonly string[], right: readonly string[], n: number): Array<[string, string]> {
  const out: Array<[string, string]> = []
  let i = 0
  for (const oldLine of left) {
    if (i >= n) break
    let j = 0
    for (const newLine of right) {
      if (j === i) {
        out.push([oldLine, newLine])
        break
      }
      j += 1
    }
    i += 1
  }
  return out
}

function withMarks(row: FileChangeLine, marks: DiffMark[] | undefined): FileChangeLine {
  if (marks === undefined) return row
  return { ...row, marks }
}

function markReplace(oldLine: string, newLine: string): { del?: DiffMark[]; add?: DiffMark[] } {
  if (oldLine === newLine) return {}
  const left = tokenize(oldLine)
  const right = tokenize(newLine)
  if (left.length * right.length > LCS_CELL_CAP) return {}
  const aligned = lcsAlign(left, right)
  const del: DiffMark[] = []
  const add: DiffMark[] = []
  for (const op of aligned) {
    if (op.kind === 'eq') {
      del.push({ kind: 'eq', text: op.text })
      add.push({ kind: 'eq', text: op.text })
    }
    else if (op.kind === 'del') {
      del.push({ kind: 'del', text: op.text })
    }
    else {
      add.push({ kind: 'ins', text: op.text })
    }
  }
  return { del, add }
}

function tokenize(line: string): string[] {
  return line.split(/(\s+)/).filter(part => part !== '')
}

function lcsAlign(left: string[], right: string[]): AlignOp[] {
  const n = left.length
  const m = right.length
  if (n === 0) return right.map(text => ({ kind: 'add', text }))
  if (m === 0) return left.map(text => ({ kind: 'del', text }))
  if (n * m > LCS_CELL_CAP) {
    return [
      ...left.map(text => ({ kind: 'del' as const, text })),
      ...right.map(text => ({ kind: 'add' as const, text })),
    ]
  }
  const width = m + 1
  const dp = new Int32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const at = i * width + j
      dp[at] = atIndex(left, i) === atIndex(right, j)
        ? cell(dp, (i + 1) * width + (j + 1)) + 1
        : Math.max(cell(dp, (i + 1) * width + j), cell(dp, i * width + (j + 1)))
    }
  }
  const out: AlignOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (atIndex(left, i) === atIndex(right, j)) {
      out.push({ kind: 'eq', text: atIndex(left, i) })
      i += 1
      j += 1
      continue
    }
    if (cell(dp, (i + 1) * width + j) >= cell(dp, i * width + (j + 1))) {
      out.push({ kind: 'del', text: atIndex(left, i) })
      i += 1
    }
    else {
      out.push({ kind: 'add', text: atIndex(right, j) })
      j += 1
    }
  }
  for (const op of tail(left, i, 'del')) out.push(op)
  for (const op of tail(right, j, 'add')) out.push(op)
  return out
}

function cell(dp: Int32Array, index: number): number {
  const value = dp.at(index)
  /* v8 ignore next -- DP indices stay inside the allocated table */
  return value === undefined ? 0 : value
}

function atIndex(lines: readonly string[], index: number): string {
  let i = 0
  for (const text of lines) {
    if (i === index) return text
    i += 1
  }
  /* v8 ignore next -- callers only pass an in-range index */
  return ''
}

function tail(lines: readonly string[], start: number, kind: 'del' | 'add'): AlignOp[] {
  const out: AlignOp[] = []
  let i = 0
  for (const text of lines) {
    if (i >= start) out.push({ kind, text })
    i += 1
  }
  return out
}
