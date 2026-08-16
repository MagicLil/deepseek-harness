/**
 * Collect Monaco model markers into ProblemItem rows (open buffers only).
 */
import type { ProblemItem, ProblemSeverity } from './problem-model.ts'
import { loadMonaco } from './monaco-loader.ts'

/** Monaco MarkerSeverity ordinals (Error=8, Warning=4, Info=2, Hint=1). */
function severityFromMonaco(value: number): ProblemSeverity {
  if (value >= 8) return 'error'
  if (value >= 4) return 'warning'
  if (value >= 2) return 'info'
  return 'hint'
}

/**
 * Snapshot current editor markers as problems.
 * @returns rows (empty when Monaco is not loaded yet).
 */
export async function collectMonacoProblems(): Promise<readonly ProblemItem[]> {
  try {
    const monaco = await loadMonaco()
    const markers = monaco.editor.getModelMarkers({})
    return markers.map((m, i) => ({
      id: `lsp-${String(i)}-${m.resource.toString()}-${String(m.startLineNumber)}-${String(m.startColumn)}`,
      source: 'lsp' as const,
      severity: severityFromMonaco(m.severity),
      message: m.message,
      path: uriToPath(m.resource.toString()),
      line: Math.max(0, m.startLineNumber - 1),
      character: Math.max(0, m.startColumn - 1),
      endLine: Math.max(0, m.endLineNumber - 1),
      endCharacter: Math.max(0, m.endColumn - 1),
    }))
  } catch {
    return []
  }
}

function uriToPath(uri: string): string {
  if (uri.startsWith('file:///')) {
    const rest = decodeURIComponent(uri.slice('file:///'.length))
    // Windows file:///c:/... → c:/...
    const first = rest[0]
    if (rest.length >= 2 && rest[1] === ':' && first !== undefined) {
      const lower = first.toLowerCase()
      const code = lower.charCodeAt(0)
      if (code >= 97 && code <= 122) {
        return `${lower}${rest.slice(1)}`.replaceAll('\\', '/')
      }
    }
    return `/${rest}`
  }
  if (uri.startsWith('file://')) return decodeURIComponent(uri.slice('file://'.length))
  return uri
}
