/**
 * Monaco language id from a host file path (extension only).
 */
const EXT_TO_LANG = new Map<string, string>([
  ['ts', 'typescript'], ['tsx', 'typescript'], ['mts', 'typescript'], ['cts', 'typescript'],
  ['js', 'javascript'], ['jsx', 'javascript'], ['mjs', 'javascript'], ['cjs', 'javascript'],
  ['json', 'json'], ['jsonc', 'json'], ['json5', 'json'],
  ['md', 'markdown'], ['markdown', 'markdown'], ['mdx', 'markdown'],
  ['py', 'python'], ['pyi', 'python'],
  ['css', 'css'], ['scss', 'scss'], ['less', 'less'],
  ['html', 'html'], ['htm', 'html'], ['vue', 'html'],
  ['yml', 'yaml'], ['yaml', 'yaml'],
  ['sh', 'shell'], ['bash', 'shell'], ['zsh', 'shell'], ['ps1', 'powershell'],
  ['rs', 'rust'], ['go', 'go'], ['java', 'java'],
  ['c', 'c'], ['h', 'c'], ['cpp', 'cpp'], ['cc', 'cpp'], ['cxx', 'cpp'], ['hpp', 'cpp'],
  ['cs', 'csharp'], ['rb', 'ruby'], ['php', 'php'],
  ['xml', 'xml'], ['svg', 'xml'], ['sql', 'sql'],
])

/**
 * Monaco language id for a host file path. Unknown extensions are plaintext.
 * @param filePath - absolute host path.
 */
export function languageFromPath(filePath: string): string {
  const parts = filePath.replaceAll('\\', '/').split('/')
  const base = parts[parts.length - 1] || ''
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return 'plaintext'
  return EXT_TO_LANG.get(base.slice(dot + 1).toLowerCase()) ?? 'plaintext'
}

/**
 * Whether the path is a Markdown document the preview pane can render.
 * @param filePath - absolute host path.
 */
export function isMarkdownPath(filePath: string): boolean {
  return languageFromPath(filePath) === 'markdown'
}
