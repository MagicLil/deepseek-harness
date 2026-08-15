/**
 * Which profile the desktop/web process is currently running.
 */
import { join } from 'node:path'

/**
 * Resolve the running profile name.
 * `DSH_PROFILE` wins; Electron defaults to `desktop`; otherwise `web`.
 * @param env - process env.
 * @param versions - `process.versions`.
 */
export function resolveRunningProfile(
  env: Record<string, string | undefined> = process.env,
  electron: string | undefined = process.versions.electron,
): string {
  const named = env.DSH_PROFILE
  if (typeof named === 'string' && named.trim().length > 0) return named.trim()
  if (electron !== undefined) return 'desktop'
  return 'web'
}

/**
 * Profile directory under a Harness home (`<home>/profiles/<name>`).
 * @param name - profile name.
 * @param home - Harness home (`~/.dsh`).
 */
export function profileDirOf(name: string, home: string): string {
  if (name === '' || name.includes('/') || name.includes('\\') || name === '.' || name === '..'
    || name === 'node_modules') {
    throw new Error(`invalid profile name ${JSON.stringify(name)}`)
  }
  return join(home, 'profiles', name)
}
