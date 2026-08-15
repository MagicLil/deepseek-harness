/**
 * Injectable Host I/O for the marketplace gateway (tests replace this).
 */
import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { profileDirOf, resolveRunningProfile } from './profile-name.ts'
import type { SpawnFn } from './profile-install.ts'
import type { VsixFs } from './vsix-store.ts'

/** Mutable I/O bag the gateway methods close over. */
export interface MarketplaceRuntime {
  fetch: typeof fetch
  spawn: SpawnFn
  home: string
  profile: string
  vsixFs: VsixFs
  readFile: typeof readFile
  writeFile: typeof writeFile
}

/**
 * Default runtime bound to the real process.
 * @param env - process env.
 * @param versions - `process.versions`.
 */
export function createRuntime(
  env: Record<string, string | undefined> = process.env,
  electron: string | undefined = process.versions.electron,
): MarketplaceRuntime {
  return {
    fetch: globalThis.fetch.bind(globalThis),
    spawn,
    home: resolveDshHome(undefined, env),
    profile: resolveRunningProfile(env, electron),
    vsixFs: { mkdir, readFile, writeFile, rm },
    readFile,
    writeFile,
  }
}

/**
 * Absolute profile directory for the runtime.
 * @param runtime - I/O bag.
 */
export function runtimeProfileDir(runtime: MarketplaceRuntime): string {
  return profileDirOf(runtime.profile, runtime.home)
}
