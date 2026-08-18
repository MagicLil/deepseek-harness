/**
 * MIME type for an in-column image preview. Unknown extensions fall
 * through to octet-stream so the tab can still build a blob URL.
 */

/** Preview cap for host.readFileBytes (larger than the UTF-8 editor bound). */
export const IMAGE_FILE_MAX_BYTES = 8 * 1024 * 1024

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
}

/**
 * Guess an image MIME type from the path's last extension.
 * @param path - absolute or relative file path (POSIX or Windows).
 */
export function imageMimeType(path: string): string {
  const base = path.replace(/\\/g, '/').split('/').pop() ?? ''
  const dot = base.lastIndexOf('.')
  if (dot < 0 || dot === base.length - 1) return 'application/octet-stream'
  const ext = base.slice(dot + 1).toLowerCase()
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}
