/**
 * Editor navigation helpers: `file:` URI → path, and an ephemeral reveal
 * so `openFile` can land on a line after Monaco boots.
 */

/** Zero-based cursor the newly opened (or already open) editor should reveal. */
export interface EditorReveal {
  /** Zero-based line. */
  readonly line: number
  /** Zero-based UTF-16 column. */
  readonly character: number
  /** Exclusive end column; when set, the editor selects `[character, end)`. */
  readonly end?: number
}

const pending = new Map<string, EditorReveal>()
const listeners = new Set<() => void>()

/**
 * Compare paths across Windows/POSIX slash and drive-letter case.
 * @param path - absolute or workspace-relative path.
 */
export function normalizeEditorPath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^([a-zA-Z]):/, (_, drive: string) => `${drive.toUpperCase()}:`)
}

/**
 * Convert a language-server URI to a filesystem path the workbench can open.
 * Non-`file:` URIs (jars, `jdt://`, `.class`) return undefined.
 * @param uri - document URI from definition / references.
 */
export function fileUrlToPath(uri: string): string | undefined {
  let parsed: URL
  try {
    parsed = new URL(uri)
  }
  catch {
    return undefined
  }
  if (parsed.protocol !== 'file:') return undefined
  let path = decodeURIComponent(parsed.pathname)
  if (parsed.hostname !== '' && parsed.hostname !== 'localhost') {
    path = `//${parsed.hostname}${path}`
  }
  if (/^\/[A-Za-z]:\//.test(path)) path = path.slice(1)
  if (/^[A-Za-z]:\//.test(path)) return path.replaceAll('/', '\\')
  return path
}

/**
 * Remember a reveal for `path` and notify mounted Monaco hosts.
 * @param path - target file path.
 * @param reveal - zero-based cursor.
 */
export function requestReveal(path: string, reveal: EditorReveal): void {
  pending.set(normalizeEditorPath(path), reveal)
  for (const listener of listeners) listener()
}

/**
 * Consume a pending reveal for `path`, if any.
 * @param path - open editor path.
 */
export function takeReveal(path: string): EditorReveal | undefined {
  const key = normalizeEditorPath(path)
  const value = pending.get(key)
  if (value !== undefined) pending.delete(key)
  return value
}

/**
 * Subscribe to reveal requests (same-file jumps while the host is already up).
 * @param listener - called after {@link requestReveal}.
 */
export function subscribeReveal(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
