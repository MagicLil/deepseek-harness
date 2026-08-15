/**
 * Flatten the desktop workspace graph and run electron-builder.
 *
 * `pnpm deploy` copies `@deepseek-ai/dsh-desktop` plus its production
 * closure (the CLI, every in-box bundle, the web frontend dist) into
 * `apps/desktop/.pack`. electron-builder then wraps that tree in an NSIS
 * installer and a portable exe. Auto-update metadata (`latest.yml`) is
 * written when `--publish` is set (needs `GH_TOKEN`).
 *
 * Usage: `pnpm desktop:pack` or `tsx scripts/pack-desktop.ts [--skip-build] [--publish] [--out dir]`
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { desktopIconFilePath, desktopIconIcoPath, ensureDesktopIconFile, writeDesktopIconIco } from '../apps/desktop/src/icon.ts'
import { isEntry } from './release/process.ts'

/** Packages the packed tree must be able to resolve. */
export const PACK_REQUIRED_PACKAGES = [
  '@deepseek-ai/dsh',
  '@deepseek-ai/dsh-desktop',
  '@deepseek-ai/dsh-desktop-app',
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-frontend',
] as const

/** Default electron-builder output directory (repo-relative). */
export const DEFAULT_DESKTOP_DIST = 'dist-desktop'

/** Flags the pack command accepts. */
export interface PackDesktopArgs {
  skipBuild: boolean
  skipDeploy: boolean
  publish: boolean
  out: string
}

/**
 * Parse `tsx scripts/pack-desktop.ts` flags.
 * @param argv - tokens after the script path.
 */
export function parsePackDesktopArgs(argv: readonly string[]): PackDesktopArgs {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      'skip-build': { type: 'boolean', default: false },
      'skip-deploy': { type: 'boolean', default: false },
      publish: { type: 'boolean', default: false },
      out: { type: 'string' },
    },
    allowPositionals: false,
  })
  return {
    skipBuild: values['skip-build'] === true,
    skipDeploy: values['skip-deploy'] === true,
    publish: values.publish === true,
    out: values.out ?? DEFAULT_DESKTOP_DIST,
  }
}

/** Slice of package.json the pack rewrite touches. */
export interface PackManifest {
  name?: string
  version?: string
  main?: string
  type?: string
  description?: string
  author?: string
  dependencies?: Record<string, string>
  [key: string]: unknown
}

/**
 * Make the deployed desktop package look like an Electron app root.
 * Drops the `electron` dependency so electron-builder supplies the runtime.
 * @param manifest - `pnpm deploy` output package.json.
 * @param version - repository version.
 */
export function rewritePackManifest(manifest: PackManifest, version: string): PackManifest {
  const dependencies = { ...manifest.dependencies }
  delete dependencies.electron
  return {
    ...manifest,
    name: 'deepseek-harness',
    productName: '万物智汇',
    version,
    main: 'lib/electron-main.js',
    type: 'module',
    description: '万物智汇 desktop',
    author: 'xmart',
    dependencies,
  }
}

/**
 * Confirm the deployed tree can resolve the desktop profile's anchors.
 * @param packRoot - `apps/desktop/.pack`.
 * @returns missing package names (empty when the tree is complete).
 */
export function missingPackPackages(packRoot: string): string[] {
  const missing: string[] = []
  if (!existsSync(join(packRoot, 'lib', 'electron-main.js'))) missing.push('lib/electron-main.js')
  if (!existsSync(join(packRoot, 'preload.mjs'))) missing.push('preload.mjs')
  const cliManifest = join(packRoot, 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
  if (!existsSync(cliManifest)) {
    missing.push('@deepseek-ai/dsh')
    return missing
  }
  // pnpm's virtual store is only visible after realpath; the top-level
  // `@deepseek-ai/dsh` entry is a junction.
  const require = createRequire(realpathSync(cliManifest))
  for (const name of PACK_REQUIRED_PACKAGES) {
    if (name === '@deepseek-ai/dsh') continue
    try {
      const resolved = require.resolve(`${name}/package.json`)
      if (name === '@deepseek-ai/dsh-web-frontend'
        && !existsSync(join(dirname(resolved), 'dist', 'index.html'))) {
        missing.push('@deepseek-ai/dsh-web-frontend/dist/index.html')
      }
    } catch {
      missing.push(name)
    }
  }
  return missing
}

/**
 * Directory that already contains `electron.exe` / `Electron.app` from the
 * workspace install — electron-builder 26.15 crashes downloading Electron
 * (`ElectronDownloadCacheMode` missing from the resolved `@electron/get`).
 * @param requireFrom - a package.json path that can resolve `electron`.
 */
export function resolveElectronDist(requireFrom: string): string {
  return join(dirname(createRequire(requireFrom).resolve('electron/package.json')), 'dist')
}

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const desktopDir = join(repoRoot, 'apps', 'desktop')
/** Outside `apps/*` so pnpm does not treat the deploy tree as a workspace member. */
const packRoot = join(repoRoot, '.desktop-pack')

/**
 * Recursive delete that survives Windows MAX_PATH junctions from `pnpm deploy`.
 * @param path - directory to remove.
 */
export function removeDir(path: string): void {
  const target = process.platform === 'win32' && !path.startsWith('\\\\?\\')
    ? `\\\\?\\${path}`
    : path
  rmSync(target, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 })
}

/**
 * Run a command with inherited stdio. Windows needs `shell` so `.cmd` shims resolve.
 * @param command - executable name.
 * @param args - arguments.
 * @param cwd - working directory.
 */
export function runPackCommand(command: string, args: readonly string[], cwd = repoRoot): void {
  const result = spawnSync(command, [...args], {
    cwd,
    env: {
      ...process.env,
      CI: process.env.CI ?? 'true',
      CSC_IDENTITY_AUTO_DISCOVERY: process.env.CSC_IDENTITY_AUTO_DISCOVERY ?? 'false',
      ELECTRON_MIRROR: process.env.ELECTRON_MIRROR ?? 'https://npmmirror.com/mirrors/electron/',
      ELECTRON_BUILDER_BINARIES_MIRROR:
        process.env.ELECTRON_BUILDER_BINARIES_MIRROR
        ?? 'https://npmmirror.com/mirrors/electron-builder-binaries/',
    },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with ${String(result.status)}`)
  }
}

function main(): void {
  const args = parsePackDesktopArgs(process.argv.slice(2))
  const version = (JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { version: string }).version
  if (!args.skipBuild) {
    runPackCommand('pnpm', ['run', 'build'])
  }
  if (!args.skipDeploy) {
    removeDir(packRoot)
    mkdirSync(packRoot, { recursive: true })
    runPackCommand('pnpm', [
      '--filter',
      '@deepseek-ai/dsh-desktop',
      'deploy',
      '--prod',
      '--legacy',
      packRoot,
    ])
    const manifestPath = join(packRoot, 'package.json')
    const rewritten = rewritePackManifest(
      JSON.parse(readFileSync(manifestPath, 'utf8')) as PackManifest,
      version,
    )
    writeFileSync(manifestPath, `${JSON.stringify(rewritten, undefined, 2)}\n`)
    removeDir(join(packRoot, 'node_modules', 'electron'))
  }
  const iconPath = desktopIconFilePath(packRoot)
  ensureDesktopIconFile(iconPath, false)
  ensureDesktopIconFile(desktopIconFilePath(desktopDir), false)
  writeDesktopIconIco(desktopIconIcoPath(packRoot))
  writeDesktopIconIco(desktopIconIcoPath(desktopDir))
  const missing = missingPackPackages(packRoot)
  if (missing.length > 0) {
    throw new Error(`desktop pack: deployed tree is incomplete: ${missing.join(', ')}`)
  }
  const out = resolve(repoRoot, args.out)
  mkdirSync(out, { recursive: true })
  const publish = args.publish ? 'always' : 'never'
  const electronDist = resolveElectronDist(join(desktopDir, 'package.json'))
  runPackCommand('pnpm', [
    'exec',
    'electron-builder',
    '--config',
    'electron-builder.yml',
    `--config.directories.app=${packRoot}`,
    `--config.directories.output=${out}`,
    `--config.electronDist=${electronDist}`,
    '--publish',
    publish,
  ], desktopDir)
  console.log(`desktop pack: installer artifacts in ${out}`)
}

if (isEntry(import.meta.url)) main()
