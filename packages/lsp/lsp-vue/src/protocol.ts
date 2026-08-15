/**
 * Pure Vue LSP helpers: file URIs and the editor-facing diagnostic / completion
 * normalizers. No I/O.
 * @module @deepseek-ai/dsh-lsp-vue/protocol
 */

import { isAbsolute, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { VueLspCompletionItem, VueLspDiagnostic } from './types.ts'

/**
 * Resolve a source path against a workspace root, then encode it as a `file:` URI.
 * @param workspaceRoot - canonical workspace directory.
 * @param filePath - absolute source path or path relative to `workspaceRoot`.
 * @returns the `file:` URI the language server expects.
 */
export function fileUrlFor(workspaceRoot: string, filePath: string): string {
  const absolute = isAbsolute(filePath) ? filePath : join(workspaceRoot, filePath)
  return pathToFileURL(absolute).href
}

/**
 * Whether a host path is a Vue single-file component.
 * @param filePath - absolute or relative path.
 */
export function isVuePath(filePath: string): boolean {
  const slash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  const base = slash >= 0 ? filePath.slice(slash + 1) : filePath
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return false
  return base.slice(dot).toLowerCase() === '.vue'
}

/**
 * Normalize a `textDocument/completion` payload into editor cards.
 * @param payload - LSP `CompletionList` or `CompletionItem[]` or `null`.
 */
export function normalizeCompletions(payload: unknown): VueLspCompletionItem[] {
  if (payload === null || payload === undefined) return []
  const raw = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : []
  const items: VueLspCompletionItem[] = []
  for (const element of raw) {
    if (element === null || typeof element !== 'object') continue
    const record = element as Record<string, unknown>
    if (typeof record.label !== 'string' || record.label.length === 0) continue
    const item: VueLspCompletionItem = { label: record.label }
    if (typeof record.insertText === 'string') (item as { insertText: string }).insertText = record.insertText
    if (typeof record.detail === 'string') (item as { detail: string }).detail = record.detail
    if (typeof record.kind === 'number' && Number.isInteger(record.kind)) {
      (item as { kind: number }).kind = record.kind
    }
    items.push(item)
  }
  return items
}

/**
 * Normalize a `textDocument/publishDiagnostics` list into editor markers.
 * @param payload - LSP `Diagnostic[]`.
 */
export function normalizeDiagnostics(payload: unknown): VueLspDiagnostic[] {
  if (!Array.isArray(payload)) return []
  const items: VueLspDiagnostic[] = []
  for (const element of payload) {
    if (element === null || typeof element !== 'object') continue
    const record = element as Record<string, unknown>
    if (typeof record.message !== 'string' || record.message.length === 0) continue
    const range = record.range
    if (range === null || typeof range !== 'object') continue
    const start = (range as { start?: unknown }).start
    const end = (range as { end?: unknown }).end
    if (!isCoord(start) || !isCoord(end)) continue
    const item: VueLspDiagnostic = {
      message: record.message,
      severity: typeof record.severity === 'number' && Number.isInteger(record.severity) ? record.severity : 1,
      startLine: start.line,
      startCharacter: start.character,
      endLine: end.line,
      endCharacter: end.character,
    }
    if (typeof record.source === 'string') (item as { source: string }).source = record.source
    items.push(item)
  }
  return items
}

function isCoord(value: unknown): value is { line: number; character: number } {
  if (value === null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.line === 'number' && Number.isInteger(record.line) && record.line >= 0
    && typeof record.character === 'number' && Number.isInteger(record.character) && record.character >= 0
}
