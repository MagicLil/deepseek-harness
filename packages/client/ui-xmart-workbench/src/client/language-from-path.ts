/**
 * Monaco / Shiki language id from a host file path (exact name, then
 * longest extension). Unknown names stay plaintext.
 */
const NAME_TO_LANG = new Map<string, string>([
  ['dockerfile', 'docker'], ['.dockerignore', 'docker'],
  ['makefile', 'makefile'], ['gnumakefile', 'makefile'],
  ['gradlew', 'shellscript'], ['gradlew.bat', 'bat'],
  ['.gitignore', 'gitignore'], ['.prettierignore', 'gitignore'],
  ['.eslintignore', 'gitignore'], ['.npmignore', 'gitignore'],
  ['.stylelintignore', 'gitignore'],
  ['.npmrc', 'ini'], ['.yarnrc', 'ini'], ['.editorconfig', 'ini'],
  ['.prettierrc', 'json'], ['.eslintrc', 'json'], ['.babelrc', 'json'],
])

const EXT_TO_LANG = new Map<string, string>([
  ['ts', 'typescript'], ['tsx', 'typescript'], ['mts', 'typescript'], ['cts', 'typescript'],
  ['js', 'javascript'], ['jsx', 'javascript'], ['mjs', 'javascript'], ['cjs', 'javascript'],
  ['json', 'json'], ['jsonc', 'json'], ['json5', 'json'],
  ['md', 'markdown'], ['markdown', 'markdown'], ['mdx', 'markdown'], ['mdc', 'markdown'],
  ['py', 'python'], ['pyi', 'python'],
  ['css', 'css'], ['scss', 'scss'], ['less', 'less'],
  ['html', 'html'], ['htm', 'html'], ['vue', 'html'],
  ['yml', 'yaml'], ['yaml', 'yaml'],
  ['sh', 'shellscript'], ['bash', 'shellscript'], ['zsh', 'shellscript'],
  ['ps1', 'powershell'],
  ['bat', 'bat'], ['cmd', 'bat'],
  ['rs', 'rust'], ['go', 'go'], ['java', 'java'],
  ['c', 'c'], ['h', 'c'], ['cpp', 'cpp'], ['cc', 'cpp'], ['cxx', 'cpp'], ['hpp', 'cpp'],
  ['cs', 'csharp'], ['rb', 'ruby'], ['php', 'php'],
  ['xml', 'xml'], ['svg', 'xml'], ['sql', 'sql'],
  ['gradle', 'groovy'], ['groovy', 'groovy'],
  ['kt', 'kotlin'], ['kts', 'kotlin'],
  ['toml', 'toml'], ['ini', 'ini'], ['cfg', 'ini'], ['conf', 'ini'],
  ['properties', 'properties'],
  ['dockerfile', 'docker'],
])

/**
 * Monaco / Shiki language id for a host file path.
 * @param filePath - absolute host path.
 */
export function languageFromPath(filePath: string): string {
  const parts = filePath.replaceAll('\\', '/').split('/')
  const base = (parts[parts.length - 1] || '').toLowerCase()
  if (base === '') return 'plaintext'
  const byName = NAME_TO_LANG.get(base)
  if (byName !== undefined) return byName
  if (base.startsWith('.env')) return 'dotenv'
  const chunks = base.split('.')
  for (let i = 1; i < chunks.length; i++) {
    const ext = chunks.slice(i).join('.')
    const byExt = EXT_TO_LANG.get(ext)
    if (byExt !== undefined) return byExt
  }
  return 'plaintext'
}

/**
 * Whether the path is a Markdown document the preview pane can render.
 * @param filePath - absolute host path.
 */
export function isMarkdownPath(filePath: string): boolean {
  return languageFromPath(filePath) === 'markdown'
}
