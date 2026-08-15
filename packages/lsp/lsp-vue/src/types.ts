/** Shared Vue LSP Remote payloads. JSON-only so they cross the Remote wire. */

import type { LspQueryResult } from '@deepseek-ai/dsh-lsp'

/** Open a `.vue` buffer in the persistent language-server session. */
export interface VueLspOpenRequest {
  /** Workspace root the server indexes. */
  readonly workspaceRoot: string
  /** Absolute or workspace-relative source path. */
  readonly path: string
  /** Current complete UTF-8 text (unsaved buffer is allowed). */
  readonly text: string
}

/** Replace the full text of an already-opened `.vue` buffer. */
export interface VueLspChangeRequest {
  /** Workspace root the server indexes. */
  readonly workspaceRoot: string
  /** Absolute or workspace-relative source path. */
  readonly path: string
  /** Current complete UTF-8 text. */
  readonly text: string
}

/** Close a `.vue` buffer. */
export interface VueLspCloseRequest {
  /** Workspace root the server indexes. */
  readonly workspaceRoot: string
  /** Absolute or workspace-relative source path. */
  readonly path: string
}

/** Start the Vue language-server process for a workspace without opening a buffer. */
export interface VueLspWarmupRequest {
  /** Workspace root the server should index. */
  readonly workspaceRoot: string
}

/** Request completions at a zero-based UTF-16 cursor. */
export interface VueLspCompleteRequest {
  /** Workspace root the server indexes. */
  readonly workspaceRoot: string
  /** Absolute or workspace-relative source path. */
  readonly path: string
  /** Zero-based line. */
  readonly line: number
  /** Zero-based UTF-16 code-unit offset within the line. */
  readonly character: number
}

/** Read the latest published diagnostics for one `.vue` buffer. */
export interface VueLspDiagnosticsRequest {
  /** Workspace root the server indexes. */
  readonly workspaceRoot: string
  /** Absolute or workspace-relative source path. */
  readonly path: string
}

/** One completion card the editor can insert. */
export interface VueLspCompletionItem {
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
export interface VueLspCompleteResult {
  /** Normalized items (empty when the server has none). */
  readonly items: readonly VueLspCompletionItem[]
}

/** One diagnostic the editor can paint as a marker. */
export interface VueLspDiagnostic {
  /** Human-readable message. */
  readonly message: string
  /** LSP severity: 1 error, 2 warning, 3 info, 4 hint. */
  readonly severity: number
  /** Optional source label (`vue`, `ts`, …). */
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
export interface VueLspDiagnosticsResult {
  /** Normalized items (empty when none have been published). */
  readonly items: readonly VueLspDiagnostic[]
}

/** One navigation target the editor can open. */
export interface VueLspLocation {
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
export interface VueLspLocationsResult {
  /** Normalized items (empty when the server has none). */
  readonly items: readonly VueLspLocation[]
}

/** Hover card, or empty when the server has no documentation. */
export interface VueLspHoverResult {
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
export function toEditorLocations(result: LspQueryResult): VueLspLocationsResult {
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
export function toEditorHover(result: LspQueryResult): VueLspHoverResult {
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
