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

function parseHunk(line: string): { oldStart: number; newStart: number } | undefined {
  const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? /.exec(line)
  if (match === null || match[1] === undefined || match[2] === undefined) return undefined
  return { oldStart: Number(match[1]), newStart: Number(match[2]) }
}
