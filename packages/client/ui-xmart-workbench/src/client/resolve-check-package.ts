/**
 * Resolve which package.json owns typecheck/lint/test/build scripts.
 * Session cwd may be a parent folder (e.g. workspace shell) without those scripts.
 */
import { discoverCheckScripts } from './discover-scripts.ts'

/** One directory listing entry needed for discovery. */
export type CheckFsEntry = {
  name: string
  kind: 'file' | 'directory'
}

/** Resolved package that owns runnable check scripts. */
export type ResolvedCheckPackage = {
  packageRoot: string
  scripts: Readonly<Record<string, string>>
  entries: readonly string[]
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'lib', 'coverage', 'out', 'build', '.git'])

/**
 * Find a nearby package.json that exposes check scripts.
 * Order: cwd → parents (≤6) → immediate children of cwd.
 */
export async function resolveCheckPackage(opts: {
  workspaceRoot: string
  listEntries: (dir: string) => Promise<readonly CheckFsEntry[]>
  readFile: (path: string) => Promise<string | undefined>
}): Promise<ResolvedCheckPackage | undefined> {
  const root = trimSlash(opts.workspaceRoot)
  if (root === '') return undefined
  const tried = new Set<string>()
  const tryDir = async (dir: string): Promise<ResolvedCheckPackage | undefined> => {
    const key = normalizeKey(dir)
    if (tried.has(key)) return undefined
    tried.add(key)
    return readPackageAt(dir, opts.listEntries, opts.readFile)
  }
  const atCwd = await tryDir(root)
  if (hasChecks(atCwd)) return atCwd
  let parent = parentDir(root)
  for (let i = 0; i < 6 && parent !== undefined; i += 1) {
    const hit = await tryDir(parent)
    if (hasChecks(hit)) return hit
    parent = parentDir(parent)
  }
  let children: readonly CheckFsEntry[] = []
  try {
    children = await opts.listEntries(root)
  } catch {
    children = []
  }
  const dirs = children
    .filter(e => e.kind === 'directory' && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.'))
    .map(e => joinPath(root, e.name))
  let best: ResolvedCheckPackage | undefined
  let bestScore = 0
  for (const dir of dirs) {
    const hit = await tryDir(dir)
    if (!hasChecks(hit)) continue
    const score = discoverCheckScripts(hit.scripts).length
    if (score > bestScore) {
      best = hit
      bestScore = score
    }
  }
  if (best !== undefined) return best
  return atCwd
}

async function readPackageAt(
  dir: string,
  listEntries: (dir: string) => Promise<readonly CheckFsEntry[]>,
  readFile: (path: string) => Promise<string | undefined>,
): Promise<ResolvedCheckPackage | undefined> {
  let entries: string[] = []
  try {
    entries = (await listEntries(dir)).map(e => e.name)
  } catch {
    return undefined
  }
  if (!entries.includes('package.json')) return undefined
  const raw = await readFile(joinPath(dir, 'package.json'))
  if (raw === undefined) {
    return { packageRoot: dir, scripts: {}, entries }
  }
  try {
    const parsed = JSON.parse(raw) as { scripts?: Record<string, string> }
    return {
      packageRoot: dir,
      scripts: parsed.scripts ?? {},
      entries,
    }
  } catch {
    return { packageRoot: dir, scripts: {}, entries }
  }
}

function hasChecks(pkg: ResolvedCheckPackage | undefined): pkg is ResolvedCheckPackage {
  return pkg !== undefined && discoverCheckScripts(pkg.scripts).length > 0
}

function trimSlash(path: string): string {
  return path.replace(/[/\\]+$/, '')
}

function toPosix(path: string): string {
  return path.replace(/\\/g, '/')
}

function normalizeKey(path: string): string {
  return toPosix(path).toLowerCase()
}

function parentDir(path: string): string | undefined {
  const norm = toPosix(trimSlash(path))
  const i = norm.lastIndexOf('/')
  if (i <= 0) return undefined
  const parent = norm.slice(0, i)
  if (/^[a-zA-Z]:$/.test(parent)) return undefined
  return parent
}

function joinPath(dir: string, name: string): string {
  return `${toPosix(trimSlash(dir))}/${name}`
}
