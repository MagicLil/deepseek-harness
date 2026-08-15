/**
 * Process-wide quit flag for the desktop shell.
 *
 * `electron-main` and `shell` are separate tsdown entries, so a module-local
 * boolean would not be shared. `globalThis` is the one object both copies see.
 * Close-to-tray reads this: hide unless a real quit is in progress.
 * @module @deepseek-ai/dsh-desktop/lifecycle
 */

const QUIT_KEY = '__dshDesktopQuitting'

/**
 * Whether the process is leaving (tray Quit, app.quit, or auto-update install).
 * @returns true after {@link markAppQuitting}.
 */
export function isAppQuitting(): boolean {
  return (globalThis as Record<string, unknown>)[QUIT_KEY] === true
}

/** Mark the process as quitting so the window close handler does not hide to tray. */
export function markAppQuitting(): void {
  (globalThis as Record<string, unknown>)[QUIT_KEY] = true
}

/** Clear the flag (tests, or a future relaunch-in-process path). */
export function resetAppQuitting(): void {
  (globalThis as Record<string, unknown>)[QUIT_KEY] = false
}
