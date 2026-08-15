/**
 * Map a matched viewer id to the hidden tab type `openFile` should open.
 * Unknown or missing viewers fall through to the text editor.
 * @param viewerId - `matchFileViewer` winner, when any.
 */
export function tabTypeForViewer(viewerId: string | undefined): 'editor' | 'image' | 'binary' {
  if (viewerId === 'image') return 'image'
  if (viewerId === 'binary-download') return 'binary'
  return 'editor'
}

/**
 * Whether the leading bytes contain a NUL (binary sniff used by the
 * `binary-download` viewer).
 * @param head - first bytes of the file.
 */
export function hasNulByte(head: Uint8Array): boolean {
  return head.includes(0)
}

/** Image extensions claimed by the built-in `image` viewer. */
export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'] as const

/** Markdown extensions claimed by the built-in `markdown` viewer. */
export const MARKDOWN_EXTS = ['md', 'markdown', 'mdx'] as const

/**
 * Last path segment (POSIX or Windows).
 * @param path - file path.
 * @returns the basename, or the original path when empty.
 */
export function basename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path
}

/**
 * Parent directory (POSIX or Windows). A root path is returned unchanged.
 * @param path - file or folder path.
 */
export function dirname(path: string): string {
  const norm = path.replace(/[/\\]+$/, '')
  const idx = Math.max(norm.lastIndexOf('/'), norm.lastIndexOf('\\'))
  if (idx < 0) return path
  if (idx === 0) return norm.slice(0, 1)
  return norm.slice(0, idx)
}

/**
 * Join a directory and a single segment using the parent's separator.
 * @param dir - absolute parent.
 * @param name - one path segment (no separators).
 */
export function joinPath(dir: string, name: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'
  return `${dir.replace(/[/\\]+$/, '')}${sep}${name}`
}

/**
 * Join a repo root and a git-relative path (`/` separators).
 * @param root - absolute repository root.
 * @param relative - git path using `/`.
 */
export function absPath(root: string, relative: string): string {
  const sep = root.includes('\\') ? '\\' : '/'
  return `${root.replace(/[/\\]+$/, '')}${sep}${relative.replaceAll('/', sep)}`
}

/**
 * Path relative to a workspace root, or the original path when it is outside.
 * @param root - workspace cwd.
 * @param abs - absolute path.
 */
/**
 * Whether `path` sits at or below `root`.
 * @param path - candidate path.
 * @param root - workspace or directory root.
 */
export function isUnder(path: string, root: string): boolean {
  return path === root
    || path.startsWith(`${root}/`)
    || path.startsWith(`${root}\\`)
}

export function relativeTo(root: string, abs: string): string {
  const norm = root.replace(/[/\\]+$/, '')
  if (abs === norm) return ''
  if (abs.startsWith(`${norm}/`) || abs.startsWith(`${norm}\\`)) return abs.slice(norm.length + 1)
  return abs
}

/**
 * Whether `name` is a single path segment (no empty, no separators).
 * @param name - user-entered file or folder name.
 */
export function isSingleSegment(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length > 0 && !trimmed.includes('/') && !trimmed.includes('\\')
}
