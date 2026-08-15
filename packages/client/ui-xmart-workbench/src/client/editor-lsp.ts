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

/** One navigation target from `*.definition` / `*.references` / `*.implementation`. */
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
  implementation: (path: string, line: number, character: number) => Promise<readonly EditorLocation[]>
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
  implementation: (req: {
    workspaceRoot: string
    path: string
    line: number
    character: number
  }) => Promise<RemoteResult<{ items: readonly EditorLocation[] }>>
  /** Optional: start the server for a workspace before any buffer is opened. */
  warmup?: (req: { workspaceRoot: string }) => Promise<RemoteResult<void>>
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

const warmedLanguages = new Set<string>()
const warmingLanguages = new Set<string>()

/**
 * Language bucket that shares one persistent server (java / ts / vue).
 * @param filePath - open buffer path.
 */
export function languageWarmKey(filePath: string): string {
  if (isJavaPath(filePath)) return 'java'
  if (isVuePath(filePath)) return 'vue'
  if (isTsPath(filePath)) return 'ts'
  return 'other'
}

/**
 * True after this window has already started that language server.
 * @param filePath - open buffer path.
 */
export function isLanguageWarmed(filePath: string): boolean {
  return warmedLanguages.has(languageWarmKey(filePath))
}

/**
 * True while a project-open warmup is in flight for this language.
 * @param filePath - open buffer path.
 */
export function isLanguageWarming(filePath: string): boolean {
  return warmingLanguages.has(languageWarmKey(filePath))
}

/**
 * Hide the editor "starting" banner: already warm, or warming in the background.
 * @param filePath - open buffer path.
 */
export function shouldSuppressLspStarting(filePath: string): boolean {
  const key = languageWarmKey(filePath)
  return key !== 'other' && (warmedLanguages.has(key) || warmingLanguages.has(key))
}

/**
 * Remember that this language server answered at least one `open`.
 * @param filePath - open buffer path.
 */
export function markLanguageWarmed(filePath: string): void {
  markLanguageWarmedKey(languageWarmKey(filePath))
}

/**
 * Mark a language bucket warm (project preload, no open file).
 * @param key - `java` / `ts` / `vue`.
 */
export function markLanguageWarmedKey(key: string): void {
  if (key === 'other' || key === '') return
  warmedLanguages.add(key)
  warmingLanguages.delete(key)
}

/**
 * Remember that a project-open warmup has started for this language.
 * @param key - `java` / `ts` / `vue`.
 */
export function markLanguageWarmingKey(key: string): void {
  if (key === 'other' || key === '' || warmedLanguages.has(key)) return
  warmingLanguages.add(key)
}

/**
 * Forget an in-flight warmup so the next file can show a start/fail banner.
 * @param key - `java` / `ts` / `vue`.
 */
export function clearLanguageWarmingKey(key: string): void {
  warmingLanguages.delete(key)
}

const hoverCache = new Map<string, { at: number; card: EditorHover }>()

/** How long Monaco may wait on hover before dropping the Loading… widget. */
export const HOVER_WAIT_MS = 2_500

/** Test hook: forget warmed languages so specs do not leak across cases. */
export function resetLanguageWarmth(): void {
  warmedLanguages.clear()
  warmingLanguages.clear()
  hoverCache.clear()
}

/**
 * Hover that does not leave Monaco on "Loading…": skip while the server is
 * still preloading, reuse a recent card, and give up after {@link HOVER_WAIT_MS}.
 * @param client - bound language client.
 * @param filePath - open buffer.
 * @param line - zero-based line.
 * @param character - zero-based UTF-16 offset.
 */
export function hoverWhenReady(
  client: EditorLanguageClient,
  filePath: string,
  line: number,
  character: number,
): Promise<EditorHover | undefined> {
  if (isLanguageWarming(filePath) && !isLanguageWarmed(filePath)) return Promise.resolve(undefined)
  const key = `${filePath}:${line}:${character}`
  const hit = hoverCache.get(key)
  if (hit !== undefined && Date.now() - hit.at < 20_000) return Promise.resolve(hit.card)
  let timer!: ReturnType<typeof setTimeout>
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), HOVER_WAIT_MS)
  })
  return Promise.race([
    client.hover(filePath, line, character).then((card) => {
      if (card !== undefined) hoverCache.set(key, { at: Date.now(), card })
      return card
    }),
    timeout,
  ]).finally(() => { clearTimeout(timer) })
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
    implementation: async (path, line, character) => unwrap(
      `${label}.implementation`,
      await remote.implementation({ workspaceRoot, path, line, character }),
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
 * True when `value` looks like an editor-LSP Remote face.
 * @param value - a namespace bag entry or a Cordis `remote.<ns>` service.
 */
function asEditorRemote(value: unknown): EditorLspRemote | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const face = value as EditorLspRemote
  if (typeof face.open !== 'function') return undefined
  return face
}

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
    return asEditorRemote((remote as Record<string, unknown>)[key])
  }
  catch {
    return undefined
  }
}

/**
 * Resolve one editor-LSP namespace. Production installs each namespace as a
 * Cordis service at `remote.<key>` — that is not a field on `ctx.get('remote')`.
 * Tests still hang the face on the bag; both shapes are accepted.
 * @param remote - `ctx.get('remote')` bag, when the face is copied there.
 * @param key - namespace id.
 * @param lookup - `ctx.get`, used for `remote.<key>`.
 */
export function peekEditorRemote(
  remote: unknown,
  key: (typeof REMOTE_KEYS)[number],
  lookup?: (serviceKey: string) => unknown,
): EditorLspRemote | undefined {
  const fromBag = peekRemote(remote, key)
  if (fromBag !== undefined) return fromBag
  if (lookup === undefined) return undefined
  try {
    return asEditorRemote(lookup(`remote.${key}`))
  }
  catch {
    return undefined
  }
}

/**
 * Collect every editor-LSP namespace that is actually mounted.
 * @param remote - `ctx.get('remote')`.
 * @param lookup - `ctx.get`.
 */
export function peekEditorRemotes(
  remote: unknown,
  lookup?: (serviceKey: string) => unknown,
): EditorLspRemotes {
  const remotes: { vueLsp?: EditorLspRemote; tsLsp?: EditorLspRemote; javaLsp?: EditorLspRemote } = {}
  for (const key of REMOTE_KEYS) {
    const value = peekEditorRemote(remote, key, lookup)
    if (value !== undefined) remotes[key] = value
  }
  return remotes
}

/** Banner key when the editor cannot bind a language client. */
export type EditorLspOffKey = 'editor.lspUnsupported' | 'editor.lspNoWorkspace' | 'editor.lspNoRemote'

/**
 * True when this path has an LSP and that Remote is still missing.
 * @param remotes - mounted Host namespaces.
 * @param filePath - open buffer path.
 */
export function missingLanguageRemote(remotes: EditorLspRemotes, filePath: string): boolean {
  if (isVuePath(filePath)) return remotes.vueLsp === undefined
  if (isTsPath(filePath)) return remotes.tsLsp === undefined
  if (isJavaPath(filePath)) return remotes.javaLsp === undefined
  return false
}

/**
 * Why go-to-definition is dark. Distinguishes "opened a folder" from "no LSP".
 * @param remotes - mounted Host namespaces.
 * @param workspaceRoot - resolved editor root.
 * @param filePath - open buffer path.
 */
export function editorLspOffKey(
  remotes: EditorLspRemotes,
  workspaceRoot: string | undefined,
  filePath: string,
): EditorLspOffKey | undefined {
  if (languageClientFor(remotes, workspaceRoot, filePath) !== undefined) return undefined
  if (!isVuePath(filePath) && !isTsPath(filePath) && !isJavaPath(filePath)) return 'editor.lspUnsupported'
  if (workspaceRoot === undefined || workspaceRoot === '') return 'editor.lspNoWorkspace'
  return 'editor.lspNoRemote'
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
