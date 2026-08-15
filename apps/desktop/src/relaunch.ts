/**
 * Re-exec the current dsh argv under the Electron binary so Cordis runs in
 * Electron's main process (required for BrowserWindow + IPC).
 *
 * Electron cannot load TypeScript through `tsx` — tsx's native esbuild binary
 * is built for Node's ABI and crashes under Electron. The desktop package must
 * therefore ship a compiled `lib/electron-main.js` (see `pnpm run build:lib`).
 * @module @deepseek-ai/dsh-desktop/relaunch
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

/**
 * Resolve the compiled Electron main entry next to this module or under lib/.
 * @returns absolute path to `electron-main.js`, or `undefined` if missing.
 */
function resolveElectronMainEntry(): string | undefined {
  // Loaded from lib/relaunch.js → sibling; from src/relaunch.ts → ../lib/.
  const beside = fileURLToPath(new URL('./electron-main.js', import.meta.url))
  if (existsSync(beside)) return beside
  const fromSrc = fileURLToPath(new URL('../lib/electron-main.js', import.meta.url))
  if (existsSync(fromSrc)) return fromSrc
  return undefined
}

/**
 * Strip loader hooks that crash under Electron (tsx / esbuild native ABI).
 * @param raw - current `NODE_OPTIONS`, if any.
 * @returns sanitized value, or `undefined` when empty.
 */
function sanitizeNodeOptions(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === '') return undefined
  const cleaned = raw
    .replace(/(^|\s)--import(=|\s+)\S+/g, ' ')
    .replace(/(^|\s)\S*tsx\S*/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
  return cleaned.length > 0 ? cleaned : undefined
}

/**
 * Spawn Electron with this package's compiled main entry and the original dsh argv.
 * @param dshArgv - arguments after the Node binary and CLI script (`process.argv.slice(2)`).
 * @returns the Electron process exit code.
 */
export async function relaunchDesktopUnderElectron(dshArgv: readonly string[]): Promise<number> {
  const require = createRequire(import.meta.url)
  let electronBinary: string
  try {
    // The `electron` package's default export is the absolute path to the binary
    // when required from plain Node (not when running inside Electron itself).
    electronBinary = require('electron') as string
  } catch (cause) {
    throw new Error(
      'dsh desktop: the electron package is not installed; run pnpm install from the repository root',
      { cause },
    )
  }

  const entry = resolveElectronMainEntry()
  if (entry === undefined) {
    throw new Error(
      'dsh desktop: missing compiled Electron main (lib/electron-main.js); run pnpm run build:lib from the repository root',
    )
  }

  return await new Promise<number>((resolve, reject) => {
    const env: NodeJS.ProcessEnv = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    const cleaned = sanitizeNodeOptions(env.NODE_OPTIONS)
    if (cleaned === undefined) delete env.NODE_OPTIONS
    else env.NODE_OPTIONS = cleaned
    const child = spawn(electronBinary, [entry, ...dshArgv], {
      stdio: 'inherit',
      env,
      windowsHide: false,
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (signal !== null) {
        resolve(signal === 'SIGINT' ? 130 : 1)
        return
      }
      resolve(code ?? 1)
    })
  })
}
