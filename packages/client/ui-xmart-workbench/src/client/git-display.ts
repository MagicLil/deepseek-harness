/** Cursor SCM filename and directory display helpers. */

/** Filename and parent directory of a repository-relative path. */
export type GitPathParts = {
  name: string
  dir: string
}

/**
 * Split `src/foo/a.ts` into `{ name: 'a.ts', dir: 'src/foo' }`.
 * @param path - repository-relative path (`/` or `\\`).
 */
export function gitPathParts(path: string): GitPathParts {
  const norm = path.replace(/\\/g, '/')
  const idx = norm.lastIndexOf('/')
  if (idx < 0) return { name: norm, dir: '' }
  return { name: norm.slice(idx + 1), dir: norm.slice(0, idx) }
}
