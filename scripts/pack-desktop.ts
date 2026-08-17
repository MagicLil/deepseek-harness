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
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { desktopIconFilePath, desktopIconIcoPath, writeDesktopIconIco, writeDesktopIconPng } from '../apps/desktop/src/icon.ts'
import { isEntry } from './release/process.ts'

/** Packages the packed tree must be able to resolve. */
export const PACK_REQUIRED_PACKAGES = [
  '@deepseek-ai/dsh',
  '@deepseek-ai/dsh-desktop',
  '@deepseek-ai/dsh-desktop-app',
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-frontend',
  '@deepseek-ai/cordis-plugin-group',
] as const

/** Default electron-builder output directory (repo-relative). */
export const DEFAULT_DESKTOP_DIST = 'dist-desktop'

/** Directory under the deploy tree that holds the shipped Node binary. */
export const BUNDLED_NODE_DIRNAME = 'bundled-node'

/**
 * File name of the Node binary we copy into the installer.
 * @param platform - pack host (Windows installers need `node.exe`).
 */
export function bundledNodeFileName(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? 'node.exe' : 'node'
}

/**
 * Copy the packer's real Node into the deploy tree for electron-builder
 * `extraResources`. Packaged Electron must not spawn `electron.exe` as Node
 * (koffi ABI, sandbox runner, community `dsh` shim).
 * @param packRoot - `.desktop-pack`.
 * @param nodePath - binary to copy (defaults to the packer `process.execPath`).
 * @param platform - selects `node.exe` vs `node`.
 * @returns destination path.
 */
export function copyBundledNode(
  packRoot: string,
  nodePath: string = process.execPath,
  platform: NodeJS.Platform = process.platform,
): string {
  const destDir = join(packRoot, BUNDLED_NODE_DIRNAME)
  mkdirSync(destDir, { recursive: true })
  const dest = join(destDir, bundledNodeFileName(platform))
  cpSync(nodePath, dest)
  return dest
}

/**
 * Copy the bundled Node into unpacked `resources/node` when extraResources
 * did not land it (same belt-and-suspenders as scoped workspace sync).
 * @param sourcePack - `.desktop-pack`.
 * @param destResources - `win-unpacked/resources`.
 * @returns destination path when a copy happened.
 */
export function syncBundledNode(sourcePack: string, destResources: string): string | undefined {
  const name = bundledNodeFileName()
  const from = join(sourcePack, BUNDLED_NODE_DIRNAME, name)
  if (!existsSync(from)) return undefined
  const destDir = join(destResources, 'node')
  const to = join(destDir, name)
  if (existsSync(to)) return undefined
  mkdirSync(destDir, { recursive: true })
  cpSync(from, to)
  return to
}

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
    productName: 'xmart',
    version,
    main: 'lib/electron-main.js',
    type: 'module',
    description: 'xmart desktop',
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
  const bundledNode = `${BUNDLED_NODE_DIRNAME}/${bundledNodeFileName()}`
  if (!existsSync(join(packRoot, BUNDLED_NODE_DIRNAME, bundledNodeFileName()))) missing.push(bundledNode)
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

const WORKSPACE_IMPORT = /(?:from|import)\s*\(?\s*['"](@deepseek-ai\/[^'"]+)['"]/g

const WORKSPACE_PACKAGE_WALKS: ReadonlyArray<{ dir: string; depth: number }> = [
  { dir: 'vendor', depth: 1 },
  { dir: 'packages', depth: 2 },
  { dir: 'native', depth: 1 },
  { dir: 'native/landlock-run/packages', depth: 1 },
  { dir: 'apps', depth: 1 },
]

/**
 * Map workspace package names to their source directories.
 * @param repoRoot - repository root.
 */
export function workspacePackageIndex(repoRoot: string): Map<string, string> {
  const index = new Map<string, string>()
  for (const { dir, depth } of WORKSPACE_PACKAGE_WALKS) {
    collectWorkspacePackageDirs(join(repoRoot, dir), depth, index)
  }
  return index
}

function collectWorkspacePackageDirs(dir: string, depth: number, index: Map<string, string>): void {
  if (!existsSync(dir)) return
  if (depth === 0) {
    const manifest = join(dir, 'package.json')
    if (!existsSync(manifest)) return
    const name = (JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string }).name
    if (name !== undefined) index.set(name, dir)
    return
  }
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name.startsWith('.')) continue
    collectWorkspacePackageDirs(join(dir, ent.name), depth - 1, index)
  }
}

function packageNameOfSpecifier(spec: string): string {
  const parts = spec.split('/')
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : spec
}

function walkPackJsFiles(dir: string, files: string[], depth: number): void {
  if (depth > 8 || !existsSync(dir)) return
  let ents
  try {
    ents = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const ent of ents) {
    if (ent.name === 'node_modules' || ent.name === 'src' || ent.name === 'tests') continue
    const path = join(dir, ent.name)
    if (ent.isDirectory()) walkPackJsFiles(path, files, depth + 1)
    else if (ent.name.endsWith('.js')) files.push(path)
  }
}

function collectPackJsFiles(packRoot: string): string[] {
  const files: string[] = []
  walkPackJsFiles(join(packRoot, 'lib'), files, 0)
  const scoped = join(packRoot, 'node_modules', '@deepseek-ai')
  if (existsSync(scoped)) {
    for (const name of readdirSync(scoped)) {
      if (name === '.pnpm') continue
      walkPackJsFiles(join(scoped, name, 'lib'), files, 0)
    }
  }
  const pnpm = join(packRoot, 'node_modules', '.pnpm')
  if (existsSync(pnpm)) {
    for (const entry of readdirSync(pnpm)) {
      const nested = join(pnpm, entry, 'node_modules', '@deepseek-ai')
      if (!existsSync(nested)) continue
      for (const name of readdirSync(nested)) {
        walkPackJsFiles(join(nested, name, 'lib'), files, 0)
      }
    }
  }
  return files
}

/**
 * Workspace packages that packed JS imports but Node cannot resolve.
 * Peer-only packages fall out of `pnpm deploy --prod` and crash Electron.
 * @param packRoot - deployed desktop tree.
 */
export function unresolvedWorkspaceImports(packRoot: string): string[] {
  const missing = new Set<string>()
  for (const file of collectPackJsFiles(packRoot)) {
    const text = readFileSync(file, 'utf8')
    const require = createRequire(file)
    WORKSPACE_IMPORT.lastIndex = 0
    let match = WORKSPACE_IMPORT.exec(text)
    while (match !== null) {
      const name = packageNameOfSpecifier(match[1] ?? '')
      try {
        require.resolve(`${name}/package.json`)
      } catch {
        missing.add(name)
      }
      match = WORKSPACE_IMPORT.exec(text)
    }
  }
  return [...missing].sort()
}

/**
 * Copy unresolved workspace packages to the pack-root node_modules so
 * ESM walks from `.pnpm` importers can find them.
 * @param packRoot - deployed desktop tree.
 * @param repoRoot - repository root.
 * @returns names that were copied.
 */
export function hoistMissingWorkspacePackages(packRoot: string, repoRoot: string): string[] {
  const index = workspacePackageIndex(repoRoot)
  const hoisted: string[] = []
  for (let round = 0; round < 8; round++) {
    let copied = 0
    for (const name of unresolvedWorkspaceImports(packRoot)) {
      const source = index.get(name)
      if (source === undefined) continue
      const dest = join(packRoot, 'node_modules', ...name.split('/'))
      if (existsSync(join(dest, 'package.json'))) continue
      mkdirSync(dirname(dest), { recursive: true })
      cpSync(source, dest, {
        recursive: true,
        dereference: true,
        filter: src => !src.split(/[\\/]/u).includes('node_modules'),
      })
      hoisted.push(name)
      copied += 1
    }
    if (copied === 0) break
  }
  return hoisted
}

function enqueueWorkspaceDeps(manifestPath: string, seen: Set<string>, queue: string[]): void {
  if (!existsSync(manifestPath)) return
  const deps = (JSON.parse(readFileSync(manifestPath, 'utf8')) as PackManifest).dependencies ?? {}
  for (const name of Object.keys(deps)) {
    if (!name.startsWith('@deepseek-ai/') || seen.has(name)) continue
    seen.add(name)
    queue.push(name)
  }
}

/**
 * Copy `@deepseek-ai/*` production dependencies that `package.json` names
 * but `pnpm deploy --prod` omitted (electron-builder's walker fails closed).
 * @param packRoot - deployed desktop tree.
 * @param repoRoot - repository root.
 * @returns names that were copied.
 */
export function hoistDeclaredWorkspaceDependencies(packRoot: string, repoRoot: string): string[] {
  const index = workspacePackageIndex(repoRoot)
  const seen = new Set<string>()
  const queue: string[] = []
  enqueueWorkspaceDeps(join(packRoot, 'package.json'), seen, queue)
  const scoped = join(packRoot, 'node_modules', '@deepseek-ai')
  if (existsSync(scoped)) {
    for (const name of readdirSync(scoped)) {
      enqueueWorkspaceDeps(join(scoped, name, 'package.json'), seen, queue)
    }
  }
  const pnpm = join(packRoot, 'node_modules', '.pnpm')
  if (existsSync(pnpm)) {
    for (const entry of readdirSync(pnpm)) {
      const nested = join(pnpm, entry, 'node_modules', '@deepseek-ai')
      if (!existsSync(nested)) continue
      for (const name of readdirSync(nested)) {
        enqueueWorkspaceDeps(join(nested, name, 'package.json'), seen, queue)
      }
    }
  }
  const hoisted: string[] = []
  while (queue.length > 0) {
    const name = queue.shift()
    if (name === undefined) break
    const dest = join(packRoot, 'node_modules', ...name.split('/'))
    if (existsSync(join(dest, 'package.json'))) {
      enqueueWorkspaceDeps(join(dest, 'package.json'), seen, queue)
      continue
    }
    const source = index.get(name)
    if (source === undefined) continue
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(source, dest, {
      recursive: true,
      dereference: true,
      filter: src => !src.split(/[\\/]/u).includes('node_modules'),
    })
    hoisted.push(name)
    enqueueWorkspaceDeps(join(dest, 'package.json'), seen, queue)
  }
  return hoisted
}

/**
 * Declare every visible `@deepseek-ai/*` folder as a production dependency.
 * electron-builder walks `package.json` and otherwise drops hoisted peers.
 * @param packRoot - deployed desktop tree.
 * @returns package names newly pinned.
 */
export function pinVisibleWorkspaceDependencies(packRoot: string): string[] {
  const scoped = join(packRoot, 'node_modules', '@deepseek-ai')
  if (!existsSync(scoped)) return []
  const manifestPath = join(packRoot, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as PackManifest
  const dependencies = { ...manifest.dependencies }
  const added: string[] = []
  for (const name of readdirSync(scoped)) {
    if (name.startsWith('.')) continue
    const pkg = `@deepseek-ai/${name}`
    if (dependencies[pkg] !== undefined) continue
    if (!existsSync(join(scoped, name, 'package.json'))) continue
    dependencies[pkg] = '*'
    added.push(pkg)
  }
  added.sort()
  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, dependencies }, undefined, 2)}\n`)
  return added
}

/**
 * Drop `*` pins so electron-builder does not walk hoisted peers as a hard graph.
 * @param packRoot - deployed desktop tree.
 * @returns names that were removed.
 */
export function stripStarDependencies(packRoot: string): string[] {
  const manifestPath = join(packRoot, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as PackManifest
  const current = manifest.dependencies ?? {}
  const dependencies: Record<string, string> = {}
  const removed: string[] = []
  for (const [name, version] of Object.entries(current)) {
    if (version === '*') {
      removed.push(name)
      continue
    }
    dependencies[name] = version
  }
  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, dependencies }, undefined, 2)}\n`)
  return removed
}

/**
 * Copy `@deepseek-ai/*` packages that exist in the deploy tree but not in
 * the unpacked Electron app (electron-builder's dep walker drops peer-only
 * packages).
 * @param sourcePack - `.desktop-pack`.
 * @param destApp - `win-unpacked/resources/app`.
 * @returns copied package names.
 */
export function syncScopedWorkspacePackages(sourcePack: string, destApp: string): string[] {
  const source = join(sourcePack, 'node_modules', '@deepseek-ai')
  const dest = join(destApp, 'node_modules', '@deepseek-ai')
  if (!existsSync(source)) return []
  mkdirSync(dest, { recursive: true })
  const copied: string[] = []
  for (const name of readdirSync(source)) {
    if (name.startsWith('.')) continue
    const from = join(source, name)
    const to = join(dest, name)
    if (!existsSync(join(from, 'package.json'))) continue
    if (existsSync(join(to, 'package.json'))) continue
    cpSync(from, to, { recursive: true, dereference: true })
    copied.push(`@deepseek-ai/${name}`)
  }
  return copied.sort()
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

/**
 * `electron-builder` CLI entry. Invoked with `node` so pack does not run
 * `pnpm exec` from `apps/desktop` (that reinstalls the workspace `--production`
 * and drops electron-builder itself).
 * @param requireFrom - a package.json path that can resolve `electron-builder`.
 */
export function resolveElectronBuilderCli(requireFrom: string): string {
  return join(dirname(createRequire(requireFrom).resolve('electron-builder/package.json')), 'cli.js')
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
      DSH_DESKTOP_PACK_ROOT: packRoot,
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
  writeDesktopIconPng(iconPath)
  writeDesktopIconPng(desktopIconFilePath(desktopDir))
  writeDesktopIconIco(desktopIconIcoPath(packRoot))
  writeDesktopIconIco(desktopIconIcoPath(desktopDir))
  const hoisted = hoistMissingWorkspacePackages(packRoot, repoRoot)
  if (hoisted.length > 0) {
    console.log(`desktop pack: hoisted peer packages: ${hoisted.join(', ')}`)
  }
  const declared = hoistDeclaredWorkspaceDependencies(packRoot, repoRoot)
  if (declared.length > 0) {
    console.log(`desktop pack: hoisted declared packages: ${declared.join(', ')}`)
  }
  const unresolved = unresolvedWorkspaceImports(packRoot)
  if (unresolved.length > 0) {
    throw new Error(`desktop pack: unresolved workspace imports: ${unresolved.join(', ')}`)
  }
  const stripped = stripStarDependencies(packRoot)
  if (stripped.length > 0) {
    console.log(`desktop pack: stripped electron-builder pins: ${stripped.join(', ')}`)
  }
  const bundledNode = copyBundledNode(packRoot)
  console.log(`desktop pack: bundled Node ${bundledNode}`)
  const missing = missingPackPackages(packRoot)
  if (missing.length > 0) {
    throw new Error(`desktop pack: deployed tree is incomplete: ${missing.join(', ')}`)
  }
  const out = resolve(repoRoot, args.out)
  mkdirSync(out, { recursive: true })
  const publish = args.publish ? 'always' : 'never'
  const electronDist = resolveElectronDist(join(desktopDir, 'package.json'))
  runPackCommand(process.execPath, [
    resolveElectronBuilderCli(join(desktopDir, 'package.json')),
    '--config',
    'electron-builder.yml',
    `--config.directories.app=${packRoot}`,
    `--config.directories.output=${out}`,
    `--config.electronDist=${electronDist}`,
    '--publish',
    publish,
  ], desktopDir)
  const unpackedResources = join(out, 'win-unpacked', 'resources')
  const unpackedApp = join(unpackedResources, 'app')
  const synced = syncScopedWorkspacePackages(packRoot, unpackedApp)
  if (synced.length > 0) {
    console.log(`desktop pack: synced peer packages into unpacked app: ${synced.join(', ')}`)
  }
  const syncedNode = syncBundledNode(packRoot, unpackedResources)
  if (syncedNode !== undefined) {
    console.log(`desktop pack: synced bundled Node into unpacked resources: ${syncedNode}`)
  }
  console.log(`desktop pack: installer artifacts in ${out}`)
}

if (isEntry(import.meta.url)) main()
