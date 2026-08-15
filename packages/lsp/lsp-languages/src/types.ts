/** Shared editor LSP Remote payloads. JSON-only so they cross the Remote wire. */

import type { LspQueryResult } from '@deepseek-ai/dsh-lsp'

/** Open a buffer in the persistent language-server session. */
export interface EditorLspOpenRequest {
  /** Workspace root the server indexes. */
  readonly workspaceRoot: string
  /** Absolute or workspace-relative source path. */
  readonly path: string
  /** Current complete UTF-8 text (unsaved buffer is allowed). */
  readonly text: string
}

/** Replace the full text of an already-opened buffer. */
export interface EditorLspChangeRequest {
  /** Workspace root the server indexes. */
  readonly workspaceRoot: string
  /** Absolute or workspace-relative source path. */
  readonly path: string
  /** Current complete UTF-8 text. */
  readonly text: string
}

/** Close a buffer. */
export interface EditorLspCloseRequest {
  /** Workspace root the server indexes. */
  readonly workspaceRoot: string
  /** Absolute or workspace-relative source path. */
  readonly path: string
}

/** Start the language-server process for a workspace without opening a buffer. */
export interface EditorLspWarmupRequest {
  /** Workspace root the server should index. */
  readonly workspaceRoot: string
}

/** Request completions at a zero-based UTF-16 cursor. */
export interface EditorLspCompleteRequest {
  /** Workspace root the server indexes. */
  readonly workspaceRoot: string
  /** Absolute or workspace-relative source path. */
  readonly path: string
  /** Zero-based line. */
  readonly line: number
  /** Zero-based UTF-16 code-unit offset within the line. */
  readonly character: number
}

/** Read the latest published diagnostics for one buffer. */
export interface EditorLspDiagnosticsRequest {
  /** Workspace root the server indexes. */
  readonly workspaceRoot: string
  /** Absolute or workspace-relative source path. */
  readonly path: string
}

/** One completion card the editor can insert. */
export interface EditorLspCompletionItem {
  /** Label shown in the list. */
  readonly label: string
  /** Text inserted when chosen; defaults to `label`. */
  readonly insertText?: string
  /** Extra detail line. */
  readonly detail?: string
  /** LSP `CompletionItemKind` number when the server sent one. */
  readonly kind?: number
}

/** Completions at the requested cursor. */
export interface EditorLspCompleteResult {
  /** Normalized items (empty when the server has none). */
  readonly items: readonly EditorLspCompletionItem[]
}

/** One diagnostic the editor can paint as a marker. */
export interface EditorLspDiagnostic {
  /** Human-readable message. */
  readonly message: string
  /** LSP severity: 1 error, 2 warning, 3 info, 4 hint. */
  readonly severity: number
  /** Optional source label (`ts`, `java`, …). */
  readonly source?: string
  /** Zero-based start line. */
  readonly startLine: number
  /** Zero-based start character. */
  readonly startCharacter: number
  /** Zero-based end line. */
  readonly endLine: number
  /** Zero-based end character. */
  readonly endCharacter: number
}

/** Latest diagnostics for one buffer. */
export interface EditorLspDiagnosticsResult {
  /** Normalized items (empty when none have been published). */
  readonly items: readonly EditorLspDiagnostic[]
}

/** One navigation target the editor can open. */
export interface EditorLspLocation {
  /** Document URI from the language server (`file:` or otherwise). */
  readonly uri: string
  /** Zero-based start line. */
  readonly startLine: number
  /** Zero-based start character. */
  readonly startCharacter: number
  /** Zero-based end line. */
  readonly endLine: number
  /** Zero-based end character. */
  readonly endCharacter: number
}

/** Definition or reference locations. */
export interface EditorLspLocationsResult {
  /** Normalized items (empty when the server has none). */
  readonly items: readonly EditorLspLocation[]
}

/** Hover card, or empty when the server has no documentation. */
export interface EditorLspHoverResult {
  /** Markdown or plaintext body. */
  readonly contents?: string
  /** Zero-based start line of the hovered symbol. */
  readonly startLine?: number
  /** Zero-based start character of the hovered symbol. */
  readonly startCharacter?: number
  /** Zero-based end line of the hovered symbol. */
  readonly endLine?: number
  /** Zero-based end character of the hovered symbol. */
  readonly endCharacter?: number
}

/**
 * Map a seam locations result onto the editor Remote wire.
 * @param result - `session.navigate` / `pool.navigate` outcome.
 */
export function toEditorLocations(result: LspQueryResult): EditorLspLocationsResult {
  if (result.kind !== 'locations') return { items: [] }
  return {
    items: result.locations.map(location => ({
      uri: location.uri,
      startLine: location.range.start.line,
      startCharacter: location.range.start.character,
      endLine: location.range.end.line,
      endCharacter: location.range.end.character,
    })),
  }
}

/**
 * Map a seam hover result onto the editor Remote wire.
 * @param result - `session.navigate` / `pool.navigate` outcome.
 */
export function toEditorHover(result: LspQueryResult): EditorLspHoverResult {
  if (result.kind !== 'hover' || result.hover === null) return {}
  const range = result.hover.range
  return {
    contents: result.hover.contents,
    ...(range === undefined ? {} : {
      startLine: range.start.line,
      startCharacter: range.start.character,
      endLine: range.end.line,
      endCharacter: range.end.character,
    }),
  }
}
