/**
 * Electron main entry for `dsh desktop`: register the `dsh://` scheme, then
 * boot the desktop profile through the same profile-boot path as the CLI.
 * @module @deepseek-ai/dsh-desktop/electron-main
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'
import { loadLayeredEnv } from '@deepseek-ai/dsh-app-boot'
import { parseDshArgs } from '@deepseek-ai/dsh/args'
import { runProfile } from '@deepseek-ai/dsh/profile-boot'
import { desktopElectronUserArgv } from './launch-argv.ts'
import { markAppQuitting } from './lifecycle.ts'
import { focusDesktopWindow, registerDesktopSchemes } from './shell.ts'

registerDesktopSchemes()
app.setName('万物智汇')
if (process.platform === 'win32') app.setAppUserModelId('ai.deepseek.harness')

if (!app.requestSingleInstanceLock()) {
  app.exit(0)
} else {
  app.on('second-instance', () => {
    focusDesktopWindow()
  })
  app.on('activate', () => {
    focusDesktopWindow()
  })
  app.on('before-quit', () => {
    markAppQuitting()
  })
  void main().catch((error: unknown) => {
    console.error(error)
    app.exit(1)
  })
}

/**
 * Read this package's version for the launcher `--version` path.
 * @returns semver string from package.json.
 */
function readVersion(): string {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
  ) as { version?: unknown }
  return typeof manifest.version === 'string' ? manifest.version : '0.0.0'
}

/**
 * Parse argv and boot the profile. Scheme registration runs before any other
 * Electron work via the module-level {@link registerDesktopSchemes} call.
 */
async function main(): Promise<void> {
  // Unpackaged: Electron inserts the script at argv[1]. Packaged: the exe
  // is argv[0] and a double-click has no profile token — inject `desktop`.
  const invocation = parseDshArgs(desktopElectronUserArgv(process.argv, app.isPackaged), readVersion())
  if (invocation.mode !== 'profile' || invocation.profile !== 'desktop') {
    console.error('dsh desktop: electron-main only boots the desktop profile')
    app.exit(1)
    return
  }
  await app.whenReady()
  const { shutdown } = await runProfile({
    environment: loadLayeredEnv('dsh'),
    profile: invocation.profile,
    patchFiles: invocation.patches,
    args: invocation.args,
  })
  app.on('window-all-closed', () => {
    void shutdown.shutdown(0)
  })
}
