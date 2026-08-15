/**
 * Cursor SCM row chrome: filename vs directory, and a coarse file-kind
 * used only for the colored glyph (not a real icon theme).
 */

/** Filename and parent directory of a repository-relative path. */
export type GitPathParts = {
  name: string
  dir: string
}

/** Coarse glyph kind for the SCM file chip. */
export type GitFileKind = 'ts' | 'tsx' | 'js' | 'css' | 'md' | 'json' | 'other'

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

/**
 * Map a filename to the SCM glyph kind.
 * @param name - basename, possibly empty.
 */
export function gitFileKind(name: string): GitFileKind {
  const dot = name.lastIndexOf('.')
  if (dot < 0 || dot === name.length - 1) return 'other'
  const ext = name.slice(dot + 1).toLowerCase()
  if (ext === 'ts') return 'ts'
  if (ext === 'tsx') return 'tsx'
  if (ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs') return 'js'
  if (ext === 'css' || ext === 'scss' || ext === 'less') return 'css'
  if (ext === 'md' || ext === 'markdown' || ext === 'mdx') return 'md'
  if (ext === 'json' || ext === 'jsonc') return 'json'
  return 'other'
}
