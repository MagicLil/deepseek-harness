/**
 * Best-effort parsers for TypeScript / ESLint-stylish / Vitest failure lines.
 */
import type { CheckKind } from './discover-scripts.ts'
import type { ProblemItem, ProblemSeverity } from './problem-model.ts'

/** Map a check kind to a problem source id. */
export function sourceForKind(kind: CheckKind): ProblemItem['source'] {
  return kind
}

/**
 * Parse tool stdout/stderr into problem rows.
 * @param text - combined log.
 * @param kind - which check produced the log.
 * @param workspaceRoot - absolute root for resolving relative paths.
 */
export function parseCheckOutput(
  text: string,
  kind: CheckKind,
  workspaceRoot: string,
): readonly ProblemItem[] {
  const lines = text.split(/\r?\n/)
  const out: ProblemItem[] = []
  let seq = 0
  for (const line of lines) {
    const ts = parseTsLine(line, workspaceRoot)
    if (ts !== undefined) {
      out.push({ ...ts, id: `${kind}-ts-${String(seq)}`, source: sourceForKind(kind) })
      seq += 1
      continue
    }
    const stylish = parseStylishLine(line, workspaceRoot)
    if (stylish !== undefined) {
      out.push({ ...stylish, id: `${kind}-lint-${String(seq)}`, source: sourceForKind(kind) })
      seq += 1
      continue
    }
    const vitest = parseVitestFail(line, workspaceRoot)
    if (vitest !== undefined) {
      out.push({ ...vitest, id: `${kind}-test-${String(seq)}`, source: sourceForKind(kind) })
      seq += 1
    }
  }
  return out
}

function parseTsLine(line: string, workspaceRoot: string): Omit<ProblemItem, 'id' | 'source'> | undefined {
  const m = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning|info)\s+TS\d+:\s*(.+)$/i)
    ?? line.match(/^(.+?):(\d+):(\d+)\s+-\s+(error|warning|info)\s+TS\d+:\s*(.+)$/i)
  if (m === null) return undefined
  return {
    severity: severityOf(m[4] ?? ''),
    message: (m[5] ?? '').trim(),
    path: resolvePath(workspaceRoot, (m[1] ?? '').trim()),
    line: Math.max(0, Number(m[2]) - 1),
    character: Math.max(0, Number(m[3]) - 1),
  }
}

function parseStylishLine(line: string, workspaceRoot: string): Omit<ProblemItem, 'id' | 'source'> | undefined {
  const m = line.match(/^(.+?):(\d+):(\d+):\s+(error|warning|info|hint)\s+(.+)$/i)
  if (m === null) return undefined
  if (/\sTS\d+:/.test(line)) return undefined
  return {
    severity: severityOf(m[4] ?? ''),
    message: (m[5] ?? '').trim(),
    path: resolvePath(workspaceRoot, (m[1] ?? '').trim()),
    line: Math.max(0, Number(m[2]) - 1),
    character: Math.max(0, Number(m[3]) - 1),
  }
}

function parseVitestFail(line: string, workspaceRoot: string): Omit<ProblemItem, 'id' | 'source'> | undefined {
  const fail = line.match(/^\s*(?:FAIL|×|✕)\s+(.+\.(?:test|spec)\.[cm]?[jt]sx?)\s*$/i)
  if (fail !== null) {
    return {
      severity: 'error',
      message: 'Test failed',
      path: resolvePath(workspaceRoot, (fail[1] ?? '').trim()),
      line: 0,
      character: 0,
    }
  }
  const at = line.match(/^\s*(?:❯|>)?\s*(.+\.(?:test|spec)\.[cm]?[jt]sx?):(\d+):(\d+)/)
  if (at !== null) {
    return {
      severity: 'error',
      message: 'Assertion failed',
      path: resolvePath(workspaceRoot, (at[1] ?? '').trim()),
      line: Math.max(0, Number(at[2]) - 1),
      character: Math.max(0, Number(at[3]) - 1),
    }
  }
  return undefined
}

function severityOf(raw: string): ProblemSeverity {
  const s = raw.toLowerCase()
  if (s === 'error') return 'error'
  if (s === 'warning') return 'warning'
  if (s === 'hint') return 'hint'
  return 'info'
}

function resolvePath(workspaceRoot: string, path: string): string {
  if (/^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('/') || path.startsWith('\\')) {
    return path.replace(/\\/g, '/')
  }
  const root = workspaceRoot.replace(/\\/g, '/').replace(/\/$/, '')
  return `${root}/${path.replace(/\\/g, '/')}`
}
