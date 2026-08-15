/**
 * Split a unified patch into per-file sections and paint line numbers.
 */
import { diffLineKind } from './diff-line.ts'

/** SCM letter kind for one file in a commit patch. */
export type DiffFileStatus = 'added' | 'deleted' | 'modified' | 'renamed'

/** One `diff --git` file in a unified patch. */
export type DiffFileSection = {
  path: string
  status: DiffFileStatus
  lines: string[]
}

/** One painted line in a file section. */
export type DiffPaintLine = {
  kind: ReturnType<typeof diffLineKind>
  text: string
  oldNo?: number
  newNo?: number
}

/** One Shiki (or plaintext) span inside a source line. */
export type DiffToken = {
  text: string
  color?: string
}

/** Painted line plus tokens for the source (no `+`/`-` prefix). */
export type DiffPaintRow = DiffPaintLine & {
  tokens: DiffToken[]
}

/**
 * Split unified-diff text into file sections.
 * @param text - `git diff` / `git show --format=` stdout.
 * @param fallbackPath - used when the patch has no `diff --git` header.
 */
export function splitUnifiedPatch(text: string, fallbackPath?: string): DiffFileSection[] {
  if (text === '') return []
  const chunks: string[][] = []
  let current: string[] | undefined
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      if (current !== undefined) chunks.push(current)
      current = [line]
      continue
    }
    if (current !== undefined) current.push(line)
  }
  if (current !== undefined) chunks.push(current)
  if (chunks.length === 0) {
    return [{ path: fallbackPath ?? '', status: 'modified', lines: text.split('\n') }]
  }
  return chunks.map(parseDiffGitChunk)
}

/**
 * Attach old/new line numbers from hunk headers.
 * @param lines - one file's unified-diff lines.
 */
export function paintDiffLines(lines: readonly string[]): DiffPaintLine[] {
  let oldNo = 0
  let newNo = 0
  return lines.map((text) => {
    const kind = diffLineKind(text)
    if (kind === 'hunk') {
      const parsed = parseHunk(text)
      if (parsed !== undefined) {
        oldNo = parsed.oldStart
        newNo = parsed.newStart
      }
      return { kind, text }
    }
    if (kind === 'meta') return { kind, text }
    if (kind === 'del') {
      const row = { kind, text, oldNo }
      oldNo += 1
      return row
    }
    if (kind === 'add') {
      const row = { kind, text, newNo }
      newNo += 1
      return row
    }
    const row = { kind, text, oldNo, newNo }
    oldNo += 1
    newNo += 1
    return row
  })
}

function parseDiffGitChunk(lines: string[]): DiffFileSection {
  const header = lines[0] ?? ''
  const { oldPath, newPath } = pathsFromDiffGit(header)
  let status: DiffFileStatus = 'modified'
  let path = newPath
  for (const line of lines) {
    if (line.startsWith('new file mode')) status = 'added'
    if (line.startsWith('deleted file mode')) {
      status = 'deleted'
      path = oldPath
    }
    if (line.startsWith('rename to ')) {
      status = 'renamed'
      path = line.slice(10)
    }
  }
  return { path, status, lines }
}

function pathsFromDiffGit(line: string): { oldPath: string; newPath: string } {
  const rest = line.slice('diff --git '.length)
  const match = /^a\/(.+) b\/(.+)$/.exec(rest)
  if (match === null || match[1] === undefined || match[2] === undefined) {
    return { oldPath: rest, newPath: rest }
  }
  return { oldPath: match[1], newPath: match[2] }
}

/** Source text of a painted line (`+`/`-`/leading space stripped). */
export function sourceBody(line: DiffPaintLine): string {
  if (line.kind === 'hunk' || line.kind === 'meta') return line.text
  return line.text.slice(1)
}

/**
 * Old / new sides for Shiki. Context lines appear on both sides so the
 * grammar sees a coherent snippet, not isolated `+` / `-` fragments.
 */
export function sourceSides(painted: readonly DiffPaintLine[]): { oldLines: string[]; newLines: string[] } {
  const oldLines: string[] = []
  const newLines: string[] = []
  for (const line of painted) {
    if (line.kind === 'hunk' || line.kind === 'meta') continue
    const body = sourceBody(line)
    if (line.kind === 'del') oldLines.push(body)
    else if (line.kind === 'add') newLines.push(body)
    else {
      oldLines.push(body)
      newLines.push(body)
    }
  }
  return { oldLines, newLines }
}

/**
 * Attach token rows from the highlighted old / new sides.
 * @param painted - numbered unified-diff lines.
 * @param oldTokens - one token row per old-side source line.
 * @param newTokens - one token row per new-side source line.
 */
export function attachTokens(
  painted: readonly DiffPaintLine[],
  oldTokens: readonly DiffToken[][],
  newTokens: readonly DiffToken[][],
): DiffPaintRow[] {
  let oldI = 0
  let newI = 0
  return painted.map((line) => {
    if (line.kind === 'hunk' || line.kind === 'meta') {
      return { ...line, tokens: [{ text: line.text }] }
    }
    const body = sourceBody(line)
    if (line.kind === 'del') {
      const tokens = oldTokens[oldI] ?? [{ text: body }]
      oldI += 1
      return { ...line, tokens }
    }
    if (line.kind === 'add') {
      const tokens = newTokens[newI] ?? [{ text: body }]
      newI += 1
      return { ...line, tokens }
    }
    const tokens = newTokens[newI] ?? oldTokens[oldI] ?? [{ text: body }]
    oldI += 1
    newI += 1
    return { ...line, tokens }
  })
}

/** Left (original) line-number gutter. */
export function oldGutter(line: DiffPaintLine): string {
  if (line.kind === 'add' || line.kind === 'hunk' || line.kind === 'meta') return ''
  return line.oldNo === undefined ? '' : String(line.oldNo)
}

/** Right (modified) line-number gutter; adds carry a `+` like Cursor. */
export function newGutter(line: DiffPaintLine): string {
  if (line.kind === 'del' || line.kind === 'hunk' || line.kind === 'meta') return ''
  if (line.newNo === undefined) return ''
  return line.kind === 'add' ? `${line.newNo}+` : String(line.newNo)
}

function parseHunk(line: string): { oldStart: number; newStart: number } | undefined {
  const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? /.exec(line)
  if (match === null || match[1] === undefined || match[2] === undefined) return undefined
  return { oldStart: Number(match[1]), newStart: Number(match[2]) }
}
