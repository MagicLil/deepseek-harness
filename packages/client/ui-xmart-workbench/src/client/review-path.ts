/**
 * Cursor-style path label for the composer review list.
 * Last two segments; deeper paths get a leading `.../`.
 *
 * @param path - absolute or relative workspace path.
 */
export function ellipsizeReviewPath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(part => part.length > 0)
  if (parts.length === 0) return path
  if (parts.length === 1) return parts[0] as string
  if (parts.length === 2) return `${parts[0]}/${parts[1]}`
  return `.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`
}
