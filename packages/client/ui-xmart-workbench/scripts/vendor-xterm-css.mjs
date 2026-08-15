import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const scriptsDir = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(scriptsDir, '..')
const xtermRoot = dirname(require.resolve('@xterm/xterm/package.json'))
const css = readFileSync(join(xtermRoot, 'css', 'xterm.css'), 'utf8')
const out = join(pkgRoot, 'src', 'client', 'ensure-xterm-css.ts')
const body = [
  '/** Injects vendored @xterm/xterm CSS once (client ModuleLoader has no style.css route). */',
  `const XTERM_CSS = ${JSON.stringify(css)};`,
  'const STYLE_ID = "xmart-xterm-vendor";',
  'export function ensureXtermCss(): void {',
  '  if (typeof document === "undefined") return;',
  '  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_ID) + "]") !== null) return;',
  '  const tag = document.createElement("style");',
  '  tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-xmart-workbench";',
  '  tag.dataset.pluginCss = STYLE_ID;',
  '  tag.textContent = XTERM_CSS;',
  '  document.head.appendChild(tag);',
  '}',
  '',
].join('\n')
writeFileSync(out, body)
const dead = join(pkgRoot, 'src', 'client', 'xterm-vendor.module.css')
if (existsSync(dead)) unlinkSync(dead)
console.log(`wrote ${out} (${body.length} chars)`)
