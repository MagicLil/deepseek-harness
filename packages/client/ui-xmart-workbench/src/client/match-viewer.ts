/**
 * File-viewer matching: one pass, priority descending, stable registration
 * order. Detect beats extensions on the same descriptor; a catch-all with
 * detect never claims a file when head bytes are missing.
 */
import type { FileViewerDescriptor } from './types.ts'

/**
 * Lowercase extension token of a path (no leading dot). Empty when the
 * basename has no extension.
 * @param path - file path (POSIX or Windows separators).
 * @returns the extension token, or `''`.
 */
function extOf(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  const base = parts[parts.length - 1] || ''
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot + 1).toLowerCase()
}

/**
 * Pick the first enabled viewer that claims `path`.
 * @param viewers - descriptors in registration order.
 * @param enabled - settings enable check (absent key = enabled).
 * @param path - file path to match.
 * @param head - optional leading bytes for `detect`.
 * @returns the winning descriptor, or undefined when nothing claims the file.
 */
export function matchFileViewer(
  viewers: readonly FileViewerDescriptor[],
  enabled: (id: string) => boolean,
  path: string,
  head?: Uint8Array,
): FileViewerDescriptor | undefined {
  const ranked = viewers.map((descriptor, index) => ({
    descriptor, index, priority: descriptor.priority ?? 0,
  }))
  ranked.sort((a, b) => b.priority - a.priority || a.index - b.index)
  const ext = extOf(path)
  for (const { descriptor } of ranked) {
    if (!enabled(descriptor.id)) continue
    if (head !== undefined && descriptor.detect !== undefined) {
      if (descriptor.detect(path, head)) return descriptor
      if (descriptor.exts.length === 0) continue
    }
    if (descriptor.exts.length === 0) {
      if (descriptor.detect !== undefined) continue
      return descriptor
    }
    if (descriptor.exts.includes(ext)) return descriptor
  }
  return undefined
}
