/**
 * Shiki tokens on the AMD Monaco host (same TextMate path as ui-editor).
 * The JS regex engine keeps desktop `dsh://` off oniguruma WASM. Ignore
 * files use a small Monarch grammar because Shiki 4 has no gitignore pack.
 */
import { shikiToMonaco } from '@shikijs/monaco'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine, defaultJavaScriptRegexConstructor } from 'shiki/engine/javascript'
import type { HighlighterCore } from 'shiki/core'
import langCss from '@shikijs/langs/css'
import langDocker from '@shikijs/langs/docker'
import langDotenv from '@shikijs/langs/dotenv'
import langGroovy from '@shikijs/langs/groovy'
import langHtml from '@shikijs/langs/html'
import langIni from '@shikijs/langs/ini'
import langJava from '@shikijs/langs/java'
import langJs from '@shikijs/langs/javascript'
import langJson from '@shikijs/langs/json'
import langKotlin from '@shikijs/langs/kotlin'
import langMakefile from '@shikijs/langs/makefile'
import langMarkdown from '@shikijs/langs/markdown'
import langProperties from '@shikijs/langs/properties'
import langPython from '@shikijs/langs/python'
import langShell from '@shikijs/langs/shellscript'
import langToml from '@shikijs/langs/toml'
import langTs from '@shikijs/langs/typescript'
import langXml from '@shikijs/langs/xml'
import langYaml from '@shikijs/langs/yaml'
import langBat from '@shikijs/langs/bat'
import themeDark from '@shikijs/themes/one-dark-pro'
import themeLight from '@shikijs/themes/min-light'
import type { Monaco } from './monaco-loader.ts'
import type { DiffToken } from './diff-patch.ts'
import { languageFromPath } from './language-from-path.ts'
import { XMART_CANVAS_DARK, XMART_LAYER_1_DARK } from './brand-accent.ts'

/** Shiki / Monaco theme id used while the app is in dark appearance. */
export const EDITOR_DARK_THEME = 'one-dark-pro'
/** Shiki / Monaco theme id used while the app is in light appearance. */
export const EDITOR_LIGHT_THEME = 'min-light'

/** Surfaces One Dark Pro paints as `#282c34` / `#2c313c` (bluish). */
const CHARCOAL_EDITOR_COLORS = {
  'editor.background': XMART_CANVAS_DARK,
  'editor.lineHighlightBackground': XMART_LAYER_1_DARK,
  'editorGroup.background': XMART_CANVAS_DARK,
  'minimap.background': XMART_CANVAS_DARK,
  'peekViewEditor.background': XMART_CANVAS_DARK,
  'walkThrough.embeddedEditorBackground': XMART_LAYER_1_DARK,
  'settings.focusedRowBackground': XMART_CANVAS_DARK,
} as const

/**
 * Keep One Dark Pro token colors; retint the editor canvas to the workbench
 * charcoal so the largest pane matches `--dsw-alias-bg-base`.
 */
export function charcoalOneDarkPro<T extends { colors?: Record<string, string> }>(theme: T): T {
  return {
    ...theme,
    colors: {
      ...theme.colors,
      ...CHARCOAL_EDITOR_COLORS,
    },
  }
}

/**
 * Shiki JS-regex constructor: compile the whole pattern eagerly.
 * @param pattern - TextMate regex source.
 */
export function shikiRegexConstructor(pattern: string): RegExp {
  return defaultJavaScriptRegexConstructor(pattern, {
    lazyCompileLength: Number.POSITIVE_INFINITY,
  })
}

const regexEngine = createJavaScriptRegexEngine({
  forgiving: true,
  regexConstructor: shikiRegexConstructor,
})

const SHIKI_LANGS = [
  langTs, langJs, langJson, langMarkdown, langPython, langCss, langHtml, langYaml,
  langShell, langJava, langGroovy, langIni, langDocker, langProperties, langBat,
  langKotlin, langToml, langXml, langDotenv, langMakefile,
] as const

const SHIKI_IDS = new Set<string>([
  'typescript', 'javascript', 'json', 'markdown', 'python', 'css', 'html', 'yaml',
  'shellscript', 'java', 'groovy', 'ini', 'docker', 'properties', 'bat',
  'kotlin', 'toml', 'xml', 'dotenv', 'makefile',
])

let highlighter: HighlighterCore | undefined
let highlighterPending: Promise<HighlighterCore> | undefined
const registeredIds = new Set<string>()

/**
 * Ensure Shiki (or the ignore Monarch) tokens this path, then return the
 * language id to stamp on the model.
 * @param monaco - the AMD `window.monaco` namespace.
 * @param filePath - absolute host path.
 */
export async function prepareMonacoHighlight(monaco: Monaco, filePath: string): Promise<string> {
  const language = languageFromPath(filePath)
  const core = await ensureHighlighter()
  if (language === 'gitignore') {
    ensureIgnoreLanguage(monaco)
  } else if (SHIKI_IDS.has(language) && !registeredIds.has(language)) {
    monaco.languages.register({ id: language })
    registeredIds.add(language)
  }
  shikiToMonaco(core, monaco)
  return language
}

/**
 * Tokenize source with the same Shiki pack the editor uses.
 * Unknown languages stay plaintext so a missing grammar never blanks the diff.
 * @param code - old-side or new-side snippet (no `+`/`-` prefixes).
 * @param language - {@link languageFromPath} id.
 * @param dark - app appearance.
 */
export async function highlightSource(
  code: string,
  language: string,
  dark: boolean,
): Promise<DiffToken[][]> {
  if (code === '') return []
  if (!SHIKI_IDS.has(language)) {
    return code.split('\n').map(line => [{ text: line }])
  }
  try {
    const core = await ensureHighlighter()
    const result = core.codeToTokens(code, {
      lang: language,
      theme: dark ? EDITOR_DARK_THEME : EDITOR_LIGHT_THEME,
    })
    return result.tokens.map(row => row.map(token => ({
      text: token.content,
      ...token.color ? { color: token.color } : {},
    })))
  }
  catch {
    return code.split('\n').map(line => [{ text: line }])
  }
}

/**
 * Test-only: drop the highlighter so the next prepare rebuilds it.
 */
export function resetMonacoHighlight(): void {
  highlighter = undefined
  highlighterPending = undefined
  registeredIds.clear()
}

async function ensureHighlighter(): Promise<HighlighterCore> {
  if (highlighter !== undefined) return highlighter
  highlighterPending ??= createHighlighterCore({
    themes: [charcoalOneDarkPro(themeDark), themeLight],
    langs: [...SHIKI_LANGS],
    engine: regexEngine,
  }).then((created) => {
    highlighter = created
    return created
  })
  return highlighterPending
}

function ensureIgnoreLanguage(monaco: Monaco): void {
  if (registeredIds.has('gitignore')) return
  monaco.languages.register({ id: 'gitignore' })
  monaco.languages.setMonarchTokensProvider('gitignore', {
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/^!/, 'keyword'],
        [/\*\*?/, 'operator'],
        [/[?*]/, 'operator'],
      ],
    },
  })
  registeredIds.add('gitignore')
}
