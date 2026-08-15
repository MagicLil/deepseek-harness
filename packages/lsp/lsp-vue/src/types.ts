/** Shared Vue LSP Remote payloads. JSON-only so they cross the Remote wire. */

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
