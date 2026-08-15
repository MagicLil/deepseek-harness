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
import { registerDesktopSchemes } from './shell.ts'

registerDesktopSchemes()

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
  // Electron inserts the script path at argv[1]; dsh flags follow.
  const invocation = parseDshArgs(process.argv.slice(2), readVersion())
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

void main().catch((error: unknown) => {
  console.error(error)
  app.exit(1)
})
