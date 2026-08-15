/**
 * Install / uninstall a DSH plugin into a profile directory (CLI `plugin.ts` semantics).
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Minimal spawn used by tests. */
export type SpawnFn = typeof spawn

/** Profile `package.json` slice we mutate. */
export interface ProfilePackageJson {
  dependencies?: Record<string, string>
  dsh?: { profile?: { bundles?: string[] } }
}

/**
 * Read a profile package.json. Missing file → empty object.
 * @param profileDir - profile directory.
 * @param read - readFile.
 */
export async function readProfilePackage(
  profileDir: string,
  read: typeof readFile = readFile,
): Promise<ProfilePackageJson> {
  try {
    const raw = await read(join(profileDir, 'package.json'), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return {}
    return parsed as ProfilePackageJson
  }
  catch {
    return {}
  }
}

/**
 * Package names currently listed as profile dependencies.
 * @param pkg - package.json.
 */
export function installedPackageNames(pkg: ProfilePackageJson): Set<string> {
  return new Set(Object.keys(pkg.dependencies ?? {}))
}

/**
 * Keep `dsh.profile.bundles` in sync with `dependencies` (same as CLI plugin.ts).
 * @param pkg - package.json.
 */
export function reconcileBundles(pkg: ProfilePackageJson): ProfilePackageJson {
  const deps = Object.keys(pkg.dependencies ?? {})
  const existing = pkg.dsh?.profile?.bundles ?? []
  const kept = existing.filter(name => deps.includes(name))
  const added = deps.filter(name => !kept.includes(name))
  return {
    ...pkg,
    dsh: {
      ...pkg.dsh,
      profile: {
        ...pkg.dsh?.profile,
        bundles: [...kept, ...added],
      },
    },
  }
}

/**
 * Write a reconciled package.json.
 * @param profileDir - profile directory.
 * @param pkg - next document.
 * @param write - writeFile.
 */
export async function writeProfilePackage(
  profileDir: string,
  pkg: ProfilePackageJson,
  write: typeof writeFile = writeFile,
): Promise<void> {
  await write(join(profileDir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
}

export interface PnpmRunResult {
  readonly code: number
  readonly logs: string
}

/**
 * Run `pnpm` in the profile directory with piped stdio (never inherit).
 * `allowBuilds` is the caller's job: pass `--ignore-scripts` when builds are refused.
 * @param profileDir - cwd.
 * @param args - pnpm args after the binary.
 * @param spawnImpl - spawn.
 */
export async function runPnpm(
  profileDir: string,
  args: readonly string[],
  spawnImpl: SpawnFn = spawn,
): Promise<PnpmRunResult> {
  const child: ChildProcess = spawnImpl('pnpm', [...args], {
    cwd: profileDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    env: process.env,
  })
  let logs = ''
  child.stdout?.on('data', (chunk) => {
    logs += String(chunk)
  })
  child.stderr?.on('data', (chunk) => {
    logs += String(chunk)
  })
  const code = await new Promise<number>((resolve) => {
    child.on('error', (error) => {
      logs += `\n${error.message}`
      resolve(1)
    })
    child.on('close', (exit) => {
      resolve(exit ?? 1)
    })
  })
  return { code, logs }
}

/**
 * `pnpm add` then reconcile bundles.
 * @param profileDir - profile directory.
 * @param spec - package spec.
 * @param allowBuilds - when false, pass `--ignore-scripts`.
 * @param spawnImpl - spawn.
 * @param read - readFile.
 * @param write - writeFile.
 */
export async function addPlugin(
  profileDir: string,
  spec: string,
  allowBuilds: boolean,
  spawnImpl: SpawnFn = spawn,
  read: typeof readFile = readFile,
  write: typeof writeFile = writeFile,
): Promise<PnpmRunResult> {
  const args = allowBuilds ? ['add', spec] : ['add', spec, '--ignore-scripts']
  const result = await runPnpm(profileDir, args, spawnImpl)
  if (result.code !== 0) return result
  const pkg = reconcileBundles(await readProfilePackage(profileDir, read))
  await writeProfilePackage(profileDir, pkg, write)
  return result
}

/**
 * `pnpm remove` then reconcile bundles.
 * @param profileDir - profile directory.
 * @param name - package name.
 * @param spawnImpl - spawn.
 * @param read - readFile.
 * @param write - writeFile.
 */
export async function removePlugin(
  profileDir: string,
  name: string,
  spawnImpl: SpawnFn = spawn,
  read: typeof readFile = readFile,
  write: typeof writeFile = writeFile,
): Promise<PnpmRunResult> {
  const result = await runPnpm(profileDir, ['remove', name], spawnImpl)
  if (result.code !== 0) return result
  const pkg = reconcileBundles(await readProfilePackage(profileDir, read))
  await writeProfilePackage(profileDir, pkg, write)
  return result
}
