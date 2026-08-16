/**
 * Electron main entry for `dsh desktop`: register the `dsh://` scheme, then
 * boot the desktop profile through the same profile-boot path as the CLI.
 * @module @deepseek-ai/dsh-desktop/electron-main
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { app, net, session } from 'electron'
import { loadLayeredEnv } from '@deepseek-ai/dsh-app-boot'
import { parseDshArgs } from '@deepseek-ai/dsh/args'
import { runProfile } from '@deepseek-ai/dsh/profile-boot'
import { desktopElectronUserArgv } from './launch-argv.ts'
import { markAppQuitting } from './lifecycle.ts'
import { installElectronEvalSpawn } from './node-eval-spawn.ts'
import { desktopSplitProxyPacScript, resolveDesktopProxyServer } from './proxy-env.ts'
import { desktopSecondInstanceAction } from './title-bar.ts'
import { focusDesktopWindow, registerDesktopSchemes } from './shell.ts'

// dsh-market's one-click restart does `spawn(process.execPath, ['-e', helper])`.
// Under Electron that is `electron.exe -e <source>`, which becomes
// "Error launching app". Relaunch this process instead; other `-e` helpers
// run as Node via DSH_NODE_EXEC_PATH / ELECTRON_RUN_AS_NODE.
installElectronEvalSpawn({
  execPath: process.execPath,
  nodePath: process.env.DSH_NODE_EXEC_PATH,
  onRelaunch: () => {
    markAppQuitting()
    app.relaunch()
  },
})

registerDesktopSchemes()
app.setName('xmart')
if (process.platform === 'win32') app.setAppUserModelId('ai.deepseek.harness')

if (!app.requestSingleInstanceLock()) {
  app.exit(0)
} else {
  app.on('second-instance', () => {
    if (desktopSecondInstanceAction(app.isPackaged) === 'relaunch') {
      markAppQuitting()
      app.relaunch()
      app.exit(0)
      return
    }
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
  // Rewrite process.argv so community plugins that scan `--profile` (dsh-market)
  // see the desktop profile, not the `desktop` alias (which they treat as `web`).
  const tokens = desktopElectronUserArgv(process.argv, app.isPackaged)
  const prefix = app.isPackaged ? process.argv.slice(0, 1) : process.argv.slice(0, 2)
  process.argv = [...prefix, ...tokens]
  const invocation = parseDshArgs(tokens, readVersion())
  if (invocation.mode !== 'profile' || invocation.profile !== 'desktop') {
    console.error('dsh desktop: electron-main only boots the desktop profile')
    app.exit(1)
    return
  }
  await app.whenReady()
  const desktopProxy = resolveDesktopProxyServer(process.env)
  await session.defaultSession.setProxy({
    pacScript: desktopSplitProxyPacScript(desktopProxy),
  })
  // Host plugins (Codex Connect) call global `fetch`. Electron's Node does
  // not honour NODE_USE_ENV_PROXY; Chromium `net.fetch` honours the PAC.
  globalThis.fetch = net.fetch.bind(net) as typeof fetch
  console.log(`dsh desktop: split proxy ${desktopProxy} (OpenAI via proxy, domestic DIRECT)`)
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
