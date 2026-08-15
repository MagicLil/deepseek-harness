/**
 * Argv the packaged Electron exe and the unpackaged `dsh desktop` relaunch
 * both feed to {@link parseDshArgs}.
 * @module @deepseek-ai/dsh-desktop/launch-argv
 */

/**
 * User tokens after the Electron binary (and, when unpackaged, the main script).
 *
 * A double-clicked installer exe has no `desktop` / `--profile` token; inject
 * the desktop alias so `parseDshArgs` does not demand `--profile`.
 * @param processArgv - `process.argv`.
 * @param packaged - `app.isPackaged`.
 * @returns tokens for `parseDshArgs`.
 */
export function desktopElectronUserArgv(processArgv: readonly string[], packaged: boolean): string[] {
  const rest = [...(packaged ? processArgv.slice(1) : processArgv.slice(2))]
  if (hasDesktopProfile(rest)) return rest
  return ['desktop', ...rest]
}

/**
 * Whether the user tokens already name a profile (alias or `--profile`).
 * @param rest - tokens after the binary / main script.
 */
function hasDesktopProfile(rest: readonly string[]): boolean {
  if (rest[0] === 'desktop' || rest[0] === 'web') return true
  const index = rest.indexOf('--profile')
  return index !== -1 && rest[index + 1] !== undefined && rest[index + 1] !== ''
}
