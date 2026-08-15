/**
 * Cursor-grade highlighting for the AMD Monaco host: official
 * `@shikijs/monaco` (https://github.com/shikijs/shiki) tokens the model with
 * the same TextMate grammars VS Code / Cursor use. The JS regex engine keeps
 * the desktop `dsh://` surface off oniguruma WASM. Languages beyond the boot
 * set load on first open of that extension.
 */
import { shikiToMonaco } from '@shikijs/monaco'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine, defaultJavaScriptRegexConstructor } from 'shiki/engine/javascript'
import type { HighlighterCore } from 'shiki/core'
import langCss from '@shikijs/langs/css'
import langHtml from '@shikijs/langs/html'
import langJs from '@shikijs/langs/javascript'
import langJson from '@shikijs/langs/json'
import langMarkdown from '@shikijs/langs/markdown'
import langPython from '@shikijs/langs/python'
import langShell from '@shikijs/langs/shellscript'
import langTs from '@shikijs/langs/typescript'
import langYaml from '@shikijs/langs/yaml'
import themeDark from '@shikijs/themes/one-dark-pro'
import themeLight from '@shikijs/themes/min-light'
import type { Monaco } from './monaco-loader.ts'

/** Shiki / Monaco theme id used while the app is in dark appearance. */
export const EDITOR_DARK_THEME = 'one-dark-pro'
/** Shiki / Monaco theme id used while the app is in light appearance. */
export const EDITOR_LIGHT_THEME = 'min-light'

type LangModule = { default: typeof langTs }

const LAZY_GRAMMARS = new Map<string, () => Promise<LangModule>>([
  ['rust', () => import('@shikijs/langs/rust')],
  ['go', () => import('@shikijs/langs/go')],
  ['java', () => import('@shikijs/langs/java')],
  ['c', () => import('@shikijs/langs/c')],
  ['cpp', () => import('@shikijs/langs/cpp')],
  ['csharp', () => import('@shikijs/langs/csharp')],
  ['ruby', () => import('@shikijs/langs/ruby')],
  ['php', () => import('@shikijs/langs/php')],
  ['kotlin', () => import('@shikijs/langs/kotlin')],
  ['swift', () => import('@shikijs/langs/swift')],
  ['toml', () => import('@shikijs/langs/toml')],
  ['ini', () => import('@shikijs/langs/ini')],
  ['scss', () => import('@shikijs/langs/scss')],
  ['less', () => import('@shikijs/langs/less')],
  ['sql', () => import('@shikijs/langs/sql')],
  ['xml', () => import('@shikijs/langs/xml')],
  ['lua', () => import('@shikijs/langs/lua')],
  ['mdx', () => import('@shikijs/langs/mdx')],
])

const EXT_TO_LANG = new Map<string, string>([
  ['ts', 'typescript'], ['tsx', 'typescript'], ['mts', 'typescript'], ['cts', 'typescript'],
  ['js', 'javascript'], ['jsx', 'javascript'], ['mjs', 'javascript'], ['cjs', 'javascript'],
  ['json', 'json'], ['jsonc', 'json'], ['json5', 'json'],
  ['md', 'markdown'], ['markdown', 'markdown'], ['mdx', 'mdx'],
  ['py', 'python'], ['pyi', 'python'],
  ['css', 'css'], ['scss', 'scss'], ['less', 'less'],
  ['html', 'html'], ['htm', 'html'],
  ['yml', 'yaml'], ['yaml', 'yaml'],
  ['sh', 'shellscript'], ['bash', 'shellscript'], ['zsh', 'shellscript'], ['ps1', 'shellscript'],
  ['rs', 'rust'], ['go', 'go'], ['java', 'java'],
  ['c', 'c'], ['h', 'c'], ['cpp', 'cpp'], ['cc', 'cpp'], ['cxx', 'cpp'], ['hpp', 'cpp'],
  ['cs', 'csharp'], ['rb', 'ruby'], ['php', 'php'],
  ['kt', 'kotlin'], ['kts', 'kotlin'], ['swift', 'swift'],
  ['toml', 'toml'], ['ini', 'ini'], ['cfg', 'ini'],
  ['sql', 'sql'], ['xml', 'xml'], ['svg', 'xml'], ['lua', 'lua'],
])

const regexEngine = createJavaScriptRegexEngine({
  forgiving: true,
  regexConstructor: pattern => defaultJavaScriptRegexConstructor(pattern, {
    lazyCompileLength: Number.POSITIVE_INFINITY,
  }),
})

let highlighter: HighlighterCore | undefined
let highlighterPending: Promise<HighlighterCore> | undefined
const registeredIds = new Set<string>()

/**
 * Monaco language id for a host file path (extension only; unknown → plaintext).
 * @param filePath - absolute host path.
 */
export function languageFromPath(filePath: string): string {
  const base = filePath.replaceAll('\\', '/').split('/').pop() ?? ''
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return 'plaintext'
  return EXT_TO_LANG.get(base.slice(dot + 1).toLowerCase()) ?? 'plaintext'
}

/** Whether the path is a Markdown document the preview pane can render. */
export function isMarkdownPath(filePath: string): boolean {
  const lang = languageFromPath(filePath)
  return lang === 'markdown' || lang === 'mdx'
}

/**
 * Ensure Shiki tokens the given language on this Monaco namespace, then
 * return the language id to stamp on the model.
 * @param monaco - the AMD `window.monaco` namespace.
 * @param filePath - absolute host path (grammar selection).
 */
export async function prepareMonacoHighlight(monaco: Monaco, filePath: string): Promise<string> {
  const language = languageFromPath(filePath)
  const core = await ensureHighlighter()
  if (language !== 'plaintext') {
    await ensureLanguage(core, language)
    if (!registeredIds.has(language)) {
      monaco.languages.register({ id: language })
      registeredIds.add(language)
    }
  }
  shikiToMonaco(core, monaco)
  return language
}

async function ensureHighlighter(): Promise<HighlighterCore> {
  if (highlighter !== undefined) return highlighter
  highlighterPending ??= createHighlighterCore({
    themes: [themeDark, themeLight],
    langs: [langTs, langJs, langJson, langMarkdown, langPython, langCss, langHtml, langYaml, langShell],
    engine: regexEngine,
  }).then((created) => {
    highlighter = created
    return created
  })
  return highlighterPending
}

async function ensureLanguage(core: HighlighterCore, language: string): Promise<void> {
  if (core.getLoadedLanguages().includes(language)) return
  const load = LAZY_GRAMMARS.get(language)
  if (load === undefined) return
  const mod = await load()
  await core.loadLanguage(mod.default)
}
