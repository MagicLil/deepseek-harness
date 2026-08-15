/**
 * Editor-facing language-client types. Components never see `ctx`.
 * One Remote shape is shared by Vue / TypeScript / Java hosts.
 */

/** One completion card from `*.complete`. */
export interface EditorCompletionItem {
  readonly label: string
  readonly insertText?: string
  readonly detail?: string
  readonly kind?: number
}

/** One navigation target from `*.definition` / `*.references`. */
export interface EditorLocation {
  /** Document URI from the language server. */
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

/** Hover card from `*.hover`. */
export interface EditorHover {
  /** Markdown or plaintext body. */
  readonly contents: string
  /** Zero-based start line of the hovered symbol. */
  readonly startLine?: number
  /** Zero-based start character of the hovered symbol. */
  readonly startCharacter?: number
  /** Zero-based end line of the hovered symbol. */
  readonly endLine?: number
  /** Zero-based end character of the hovered symbol. */
  readonly endCharacter?: number
}

/** One diagnostic from `*.diagnostics`. */
export interface EditorDiagnostic {
  readonly message: string
  readonly severity: number
  readonly source?: string
  readonly startLine: number
  readonly startCharacter: number
  readonly endLine: number
  readonly endCharacter: number
}

/** Callbacks Monaco uses; apply closes them over the Remote. */
export interface EditorLanguageClient {
  open: (path: string, text: string) => Promise<void>
  change: (path: string, text: string) => Promise<void>
  close: (path: string) => Promise<void>
  complete: (path: string, line: number, character: number) => Promise<readonly EditorCompletionItem[]>
  diagnostics: (path: string) => Promise<readonly EditorDiagnostic[]>
  definition: (path: string, line: number, character: number) => Promise<readonly EditorLocation[]>
  hover: (path: string, line: number, character: number) => Promise<EditorHover | undefined>
  references: (path: string, line: number, character: number) => Promise<readonly EditorLocation[]>
}

export type RemoteResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

/** Host editor-LSP Remote face (generated Typert methods wrap in RemoteResult). */
export interface EditorLspRemote {
  open: (req: { workspaceRoot: string; path: string; text: string }) => Promise<RemoteResult<void>>
  change: (req: { workspaceRoot: string; path: string; text: string }) => Promise<RemoteResult<void>>
  close: (req: { workspaceRoot: string; path: string }) => Promise<RemoteResult<void>>
  complete: (req: {
    workspaceRoot: string
    path: string
    line: number
    character: number
  }) => Promise<RemoteResult<{ items: readonly EditorCompletionItem[] }>>
  diagnostics: (req: {
    workspaceRoot: string
    path: string
  }) => Promise<RemoteResult<{ items: readonly EditorDiagnostic[] }>>
  definition: (req: {
    workspaceRoot: string
    path: string
    line: number
    character: number
  }) => Promise<RemoteResult<{ items: readonly EditorLocation[] }>>
  hover: (req: {
    workspaceRoot: string
    path: string
    line: number
    character: number
  }) => Promise<RemoteResult<EditorHover | Record<string, never>>>
  references: (req: {
    workspaceRoot: string
    path: string
    line: number
    character: number
  }) => Promise<RemoteResult<{ items: readonly EditorLocation[] }>>
}

/** Vue aliases kept so existing imports keep compiling. */
export type VueCompletionItem = EditorCompletionItem
export type VueDiagnostic = EditorDiagnostic
export type VueLanguageClient = EditorLanguageClient
export type VueLspRemote = EditorLspRemote

/**
 * Final `.<ext>` of a host path, lowercased, or empty.
 * @param filePath - absolute or relative path.
 */
export function extensionOf(filePath: string): string {
  const slash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  const base = slash >= 0 ? filePath.slice(slash + 1) : filePath
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot).toLowerCase()
}

/**
 * Whether a host path is a Vue single-file component.
 * @param filePath - absolute or relative path.
 */
export function isVuePath(filePath: string): boolean {
  return extensionOf(filePath) === '.vue'
}

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'])

/**
 * Whether the path is TypeScript or JavaScript this host owns (not `.vue`).
 * @param filePath - absolute or relative path.
 */
export function isTsPath(filePath: string): boolean {
  return TS_EXTENSIONS.has(extensionOf(filePath))
}

/**
 * Whether the path is a Java source.
 * @param filePath - absolute or relative path.
 */
export function isJavaPath(filePath: string): boolean {
  return extensionOf(filePath) === '.java'
}

function unwrap<T>(label: string, result: RemoteResult<T>): T {
  if (!result.ok) throw new Error(`${label} failed: ${result.error.code}: ${result.error.message}`)
  return result.value
}

/**
 * Bind a workspace root onto one Host Remote so Monaco never sees `ctx`.
 * @param remote - `vueLsp` / `tsLsp` / `javaLsp` namespace.
 * @param workspaceRoot - session cwd.
 * @param label - remote name used in error messages.
 */
export function bindEditorLsp(
  remote: EditorLspRemote,
  workspaceRoot: string,
  label: string,
): EditorLanguageClient {
  return {
    open: async (path, text) => {
      unwrap(`${label}.open`, await remote.open({ workspaceRoot, path, text }))
    },
    change: async (path, text) => {
      unwrap(`${label}.change`, await remote.change({ workspaceRoot, path, text }))
    },
    close: async (path) => {
      unwrap(`${label}.close`, await remote.close({ workspaceRoot, path }))
    },
    complete: async (path, line, character) => unwrap(
      `${label}.complete`,
      await remote.complete({ workspaceRoot, path, line, character }),
    ).items,
    diagnostics: async path => unwrap(
      `${label}.diagnostics`,
      await remote.diagnostics({ workspaceRoot, path }),
    ).items,
    definition: async (path, line, character) => unwrap(
      `${label}.definition`,
      await remote.definition({ workspaceRoot, path, line, character }),
    ).items,
    hover: async (path, line, character): Promise<EditorHover | undefined> => {
      const result = unwrap(
        `${label}.hover`,
        await remote.hover({ workspaceRoot, path, line, character }),
      )
      const contents = (result as { contents?: string }).contents
      if (typeof contents !== 'string') return undefined
      return { ...result, contents }
    },
    references: async (path, line, character) => unwrap(
      `${label}.references`,
      await remote.references({ workspaceRoot, path, line, character }),
    ).items,
  }
}

/**
 * Bind a workspace root onto the Vue Host Remote.
 * @param remote - `vueLsp` namespace.
 * @param workspaceRoot - session cwd.
 */
export function bindVueLsp(remote: VueLspRemote, workspaceRoot: string): VueLanguageClient {
  return bindEditorLsp(remote, workspaceRoot, 'vueLsp')
}

/** Remotes the editor tab can close over. */
export interface EditorLspRemotes {
  readonly vueLsp?: EditorLspRemote
  readonly tsLsp?: EditorLspRemote
  readonly javaLsp?: EditorLspRemote
}

const REMOTE_KEYS = ['vueLsp', 'tsLsp', 'javaLsp'] as const

/**
 * Read one editor-LSP namespace off `ctx.remote` without throwing.
 * A missing, unfinished, or accessor-throwing Remote must not blank the file.
 * @param remote - `ctx.remote` or a test double.
 * @param key - namespace id.
 */
export function peekRemote(
  remote: unknown,
  key: (typeof REMOTE_KEYS)[number],
): EditorLspRemote | undefined {
  if (remote === null || typeof remote !== 'object') return undefined
  try {
    const value = (remote as Record<string, unknown>)[key]
    if (value === null || typeof value !== 'object') return undefined
    const face = value as EditorLspRemote
    if (typeof face.open !== 'function') return undefined
    return face
  }
  catch {
    return undefined
  }
}

/**
 * Pick the language Remote for this path. `.vue` stays on vueLsp.
 * @param remotes - available Host namespaces.
 * @param workspaceRoot - session cwd.
 * @param filePath - open buffer path.
 */
export function languageClientFor(
  remotes: EditorLspRemotes,
  workspaceRoot: string | undefined,
  filePath: string,
): EditorLanguageClient | undefined {
  if (workspaceRoot === undefined || workspaceRoot === '') return undefined
  if (isVuePath(filePath) && remotes.vueLsp !== undefined) {
    return bindEditorLsp(remotes.vueLsp, workspaceRoot, 'vueLsp')
  }
  if (isTsPath(filePath) && remotes.tsLsp !== undefined) {
    return bindEditorLsp(remotes.tsLsp, workspaceRoot, 'tsLsp')
  }
  if (isJavaPath(filePath) && remotes.javaLsp !== undefined) {
    return bindEditorLsp(remotes.javaLsp, workspaceRoot, 'javaLsp')
  }
  return undefined
}
