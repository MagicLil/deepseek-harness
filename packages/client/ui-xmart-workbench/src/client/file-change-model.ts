/**
 * Pure derivation of the conversation file-change card from a frozen
 * write/edit call slice. The chat row shows a Cursor-style header
 * (`path` + `+N -M`) and a short unified snippet; Keep/Undo stay on
 * the composer Review dock.
 */
import type { ToolCallBlock, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import { contentLines, type FileChangeHunk } from './file-change-diff.ts'

export type { DiffMark, FileChangeHunk, FileChangeLine } from './file-change-diff.ts'
export { flattenFileChangeLines } from './file-change-diff.ts'

/** Chat-row height cap before the middle collapses. Matches the shipped diff card. */
export const FILE_CHANGE_MAX_LINES = 8

export type FileChangeState = 'running' | 'ok' | 'error' | 'stopped'

/** Visible card when the call carried a well-formed diff. */
export interface FileChangeCardModel {
  kind: 'card'
  path: string
  displayPath: string
  added: number
  removed: number
  hunks: FileChangeHunk[]
  state: 'running' | 'ok'
}

/** Compact one-line row when there is no usable diff (running, error, generic). */
export interface FileChangeFallbackModel {
  kind: 'fallback'
  path: string | undefined
  displayPath: string
  summary: string
  state: FileChangeState
}

export type FileChangeModel = FileChangeCardModel | FileChangeFallbackModel

/**
 * Strip the workspace root from a workspace-rooted absolute path (display only).
 * @param text - the path to shorten.
 * @param cwd - session workspace root; absent or empty leaves the path unchanged.
 */
export function relativizeToCwd(text: string, cwd: string | undefined): string {
  if (cwd === undefined || cwd === '') return text
  const root = cwd.replace(/[/\\]+$/, '')
  if (text.startsWith(`${root}/`) || text.startsWith(`${root}\\`)) return text.slice(root.length + 1)
  return text
}

/**
 * Resolve a tool path against the session cwd for host reads.
 * Absolute POSIX / Windows paths pass through.
 * @param cwd - session workspace root.
 * @param path - tool argument or hunk path.
 */
export function resolveWorkspacePath(cwd: string | undefined, path: string): string {
  if (/^[A-Za-z]:[\\/]/.test(path) || path.startsWith('/') || path.startsWith('\\')) return path
  if (cwd === undefined || cwd === '') return path
  const sep = cwd.includes('\\') ? '\\' : '/'
  const rel = path.replace(/^[\\/]+/, '').replace(/[/\\]/g, sep)
  return `${cwd.replace(/[/\\]+$/, '')}${sep}${rel}`
}

function parseArgs(argsRaw: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(argsRaw)
    if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, unknown>
    return undefined
  }
  catch {
    return undefined
  }
}

function firstLine(text: string): string {
  const nl = text.indexOf('\n')
  return nl === -1 ? text : text.slice(0, nl)
}

function pickPath(args: Record<string, unknown> | undefined): string | undefined {
  if (args === undefined) return undefined
  for (const key of ['path', 'file_path'] as const) {
    const value = args[key]
    if (typeof value === 'string' && value !== '') return firstLine(value)
  }
  return undefined
}

function argsRawOf(block: ToolCallBlock): string {
  return ('kind' in block ? block.call?.argsRaw : block.argsRaw) ?? ''
}

function resultText(node: ToolResultNode): string {
  const parts: string[] = []
  for (const item of node.content) {
    if (item.type === 'text') parts.push(item.text)
    else parts.push(JSON.stringify(item, null, 2))
  }
  if (parts.length === 0 && node.error !== undefined) {
    parts.push(`${node.error.name}: ${node.error.code}`)
  }
  return parts.join('\n')
}

function callState(block: ToolCallBlock): FileChangeState {
  if (!('kind' in block)) return 'running'
  if (block.error?.code === 'interrupted') return 'stopped'
  return block.isError ? 'error' : 'ok'
}

function narrowHunks(diffs: unknown): FileChangeHunk[] | null {
  if (!Array.isArray(diffs) || diffs.length === 0) return null
  const out: FileChangeHunk[] = []
  for (const hunk of diffs) {
    if (typeof hunk !== 'object' || hunk === null) return null
    const { path, oldText, newText } = hunk as Record<string, unknown>
    if (typeof path !== 'string') return null
    if (oldText !== null && typeof oldText !== 'string') return null
    if (typeof newText !== 'string') return null
    out.push({ path, oldText, newText })
  }
  return out
}

function viewHunks(view: unknown): FileChangeHunk[] | null {
  if (typeof view !== 'object' || view === null) return null
  if ((view as { card?: unknown }).card !== 'diff') return null
  return narrowHunks((view as { diffs?: unknown }).diffs)
}

function lineStats(hunks: FileChangeHunk[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const hunk of hunks) {
    if (hunk.oldText !== null) removed += contentLines(hunk.oldText).length
    added += contentLines(hunk.newText).length
  }
  return { added, removed }
}

/**
 * Derive the file-change card (or the compact fallback) from a frozen call.
 * @param toolName - wire tool name (survives a windowless result).
 * @param block - running call or settled result.
 * @param cwd - session workspace root for display-only path shortening.
 */
export function fileChangeModel(
  toolName: string,
  block: ToolCallBlock,
  cwd?: string,
): FileChangeModel {
  const state = callState(block)
  const argsPath = pickPath(parseArgs(argsRawOf(block)))
  const hunks = 'kind' in block
    ? (viewHunks(block.resultView) ?? viewHunks(block.callView))
    : viewHunks(block.callView)
  const first = hunks?.[0]
  const path = first?.path ?? argsPath
  const displayPath = path === undefined ? toolName : relativizeToCwd(path, cwd)
  if (hunks !== null && first !== undefined && (state === 'running' || state === 'ok')) {
    const stats = lineStats(hunks)
    return {
      kind: 'card',
      path: first.path,
      displayPath,
      added: stats.added,
      removed: stats.removed,
      hunks,
      state,
    }
  }
  const output = 'kind' in block ? resultText(block) : ''
  const summary = state === 'error' && output !== '' ? firstLine(output) : displayPath
  return {
    kind: 'fallback',
    path: argsPath,
    displayPath,
    summary,
    state,
  }
}
