/**
 * Resolve check argv for `ctx.subprocess.spawn` (Windows batch shims need cmd.exe).
 */
import { extname } from 'node:path'

/** Env key carrying a quoted Windows `.cmd`/`.bat` path for one spawn. */
export const WINDOWS_CHECK_EXECUTABLE_ENV = 'DSH_WORKSPACE_CHECKS_EXECUTABLE'

/** Result of resolving a client-supplied check argv into a spawnable argv. */
export type ResolvedCheckArgv = {
  /** Final argv for `subprocess.spawn`. */
  readonly argv: readonly string[]
  /** Optional per-spawn env overlay (Windows batch shim). */
  readonly env?: Readonly<Record<string, string>>
}

/**
 * Rewrite a program so Windows can spawn package-manager shims.
 * - Absolute `.cmd`/`.bat`: cmd.exe + quoted env path (paths with metacharacters stay data).
 * - Bare name (`pnpm`): cmd.exe looks it up on PATH (same as Codex app-server).
 * - `.exe` / POSIX: unchanged.
 * @param program - absolute path from `resolveExecutable`, or a bare PATH name.
 * @param args - remaining argv after the program.
 * @param platform - host platform.
 */
export function wrapResolvedCheckArgv(
  program: string,
  args: readonly string[],
  platform: NodeJS.Platform = process.platform,
): ResolvedCheckArgv {
  if (platform !== 'win32') {
    return { argv: [program, ...args] }
  }
  const extension = extname(program).toLowerCase()
  const isBatch = extension === '.cmd' || extension === '.bat'
  const isBare = extension === '' && !program.includes('/') && !program.includes('\\')
  if (isBatch) {
    return {
      argv: [
        'cmd.exe',
        '/d',
        '/v:off',
        '/s',
        '/c',
        `%${WINDOWS_CHECK_EXECUTABLE_ENV}%`,
        ...args,
      ],
      env: { [WINDOWS_CHECK_EXECUTABLE_ENV]: `"${program}"` },
    }
  }
  if (isBare) {
    return {
      argv: ['cmd.exe', '/d', '/v:off', '/s', '/c', program, ...args],
    }
  }
  return { argv: [program, ...args] }
}
