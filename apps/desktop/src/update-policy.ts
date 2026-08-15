/**
 * Electron-free rules for when the desktop shell may auto-update.
 * @module @deepseek-ai/dsh-desktop/update-policy
 */

/** Why a packaged or unpackaged launch should skip electron-updater. */
export type AutoUpdateSkip = 'unpackaged' | 'portable'

/** Outcome of {@link resolveAutoUpdateGate}. */
export type AutoUpdateGate = { ok: true } | { ok: false; reason: AutoUpdateSkip }

/**
 * electron-builder's portable wrapper sets `PORTABLE_EXECUTABLE_DIR`.
 * NSIS installs do not.
 * @param env - process environment.
 */
export function isPortableInstall(env: Record<string, string | undefined>): boolean {
  return (env.PORTABLE_EXECUTABLE_DIR?.trim() ?? '') !== ''
}

/**
 * Whether background update checks should run.
 * @param input - packaged bit plus portable detection.
 */
export function resolveAutoUpdateGate(input: {
  isPackaged: boolean
  portable: boolean
}): AutoUpdateGate {
  if (!input.isPackaged) return { ok: false, reason: 'unpackaged' }
  if (input.portable) return { ok: false, reason: 'portable' }
  return { ok: true }
}

/**
 * Dialog on a visible window; toast when the user only has the tray icon.
 * @param windowVisible - `BrowserWindow.isVisible()` after destroy-guard.
 */
export function updatePromptSurface(windowVisible: boolean): 'dialog' | 'notification' {
  return windowVisible ? 'dialog' : 'notification'
}
