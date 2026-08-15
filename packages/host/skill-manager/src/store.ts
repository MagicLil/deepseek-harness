/**
 * Host-local skill files. Writes only `~/.dsh/skills` and `<project>/.dsh/skills`.
 * Foreign roots are read-only and copied on import.
 */

import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { isListedSkillName, isSkillName, parseSkillMarkdown, serializeSkillMarkdown, setDisableModelInvocation } from './parse.ts'
import {
  findSkillFiles,
  isProjectOverride,
  isWritableSkillPath,
  originFromPath,
  originRank,
  type FoundSkillFile,
} from './scan.ts'
import type {
  DeleteOwnedRequest,
  ForeignSkillLocation,
  ForeignSkillSource,
  GetOwnedRequest,
  GetOwnedResult,
  ImportForeignRequest,
  ListForeignRequest,
  ListForeignResult,
  ListOwnedRequest,
  ListOwnedResult,
  ListProjectRequest,
  ManagedSkill,
  ManagedSkillSummary,
  SaveOwnedRequest,
  SetEnabledRequest,
  SkillJobResult,
  SkillManagerErrorCode,
  SkillScope,
} from './types.ts'

const FOREIGN_DIR: Record<ForeignSkillSource, string> = {
  claude: '.claude/skills',
  cursor: '.cursor/skills',
}

/** Fail a job with a stable code. */
export function fail(error: SkillManagerErrorCode): SkillJobResult {
  return { ok: false, error }
}

/** Succeed a job. */
export function ok(): SkillJobResult {
  return { ok: true }
}

/**
 * Resolve the owned skill root for a scope.
 * @param scope - personal or project.
 * @param dshHome - resolved harness home.
 * @param projectRoot - absolute project root when scope is project.
 * @returns absolute skill directory, or an error code.
 */
export function ownedRoot(
  scope: SkillScope,
  dshHome: string,
  projectRoot: string | undefined,
): { path: string } | { error: SkillManagerErrorCode } {
  if (scope === 'personal') return { path: join(dshHome, 'skills') }
  const project = resolveProject(projectRoot ?? '')
  if ('error' in project) return project
  return { path: join(project.path, '.dsh', 'skills') }
}

/**
 * List owned skills in one scope.
 * @param request - scope and optional project root.
 * @param dshHome - resolved harness home.
 * @returns sorted summaries.
 */
export async function listOwned(
  request: ListOwnedRequest,
  dshHome: string,
  userHome = join(dshHome, '.no-user'),
): Promise<ListOwnedResult> {
  if (request.scope === 'project') {
    const root = ownedRoot(request.scope, dshHome, request.projectRoot)
    if ('error' in root) return { items: [] }
    return { items: await listRoot(root.path, request.scope) }
  }
  return { items: await mergeByRank([
    await listRoot(join(dshHome, 'skills'), 'personal'),
    await listRoot(join(userHome, '.agents', 'skills'), 'agents'),
    await listRoot(join(userHome, '.cursor', 'skills'), 'cursor'),
    await listRoot(join(userHome, '.claude', 'skills'), 'claude'),
  ], personalRank) }
}

/**
 * List every recognizable skill in one project tree.
 * Same-name rows collapse by origin rank. Names already in personal
 * stay hidden unless the project has its own override copy.
 * @param request - absolute project root.
 * @returns sorted summaries. An invalid project returns an empty list.
 */
export async function listProject(
  request: ListProjectRequest,
  dshHome: string,
  userHome = join(dshHome, '.no-user'),
): Promise<ListOwnedResult> {
  const project = resolveProject(request.projectRoot)
  if ('error' in project) return { items: [] }
  const personal = new Set(
    (await listOwned({ scope: 'personal' }, dshHome, userHome)).items.map(item => item.name),
  )
  const found = await findSkillFiles(project.path)
  const scanned: ManagedSkillSummary[] = []
  for (const file of found) {
    scanned.push(await summarizeFound(file, originFromPath(file.path)))
  }
  const merged = mergeByRank([scanned], originRank)
  const items = merged.filter(item => !personal.has(item.name) || isProjectOverride(item.origin))
  return { items }
}

/**
 * Load one owned skill body.
 * @param request - scope, name, optional project root.
 * @param dshHome - resolved harness home.
 * @returns the skill or a job error.
 */
export async function getOwned(request: GetOwnedRequest, dshHome: string): Promise<GetOwnedResult> {
  if (!isSkillName(request.name)) return { ...fail('invalid-name') }
  const root = ownedRoot(request.scope, dshHome, request.projectRoot)
  if ('error' in root) return { ...fail(root.error) }
  const found = await readNamed(root.path, request.name, request.scope)
  return found === undefined ? { ...fail('not-found') } : { ok: true, skill: found }
}

/**
 * Create or replace an owned skill as `<name>/SKILL.md`.
 * @param request - fields to persist.
 * @param dshHome - resolved harness home.
 * @returns job result.
 */
export async function saveOwned(request: SaveOwnedRequest, dshHome: string): Promise<SkillJobResult> {
  if (!isSkillName(request.name)) return fail('invalid-name')
  if (request.description.trim().length === 0) return fail('invalid-description')
  const root = ownedRoot(request.scope, dshHome, request.projectRoot)
  if ('error' in root) return fail(root.error)
  const destDir = join(root.path, request.name)
  const destFile = join(destDir, 'SKILL.md')
  await mkdir(destDir, { recursive: true })
  await writeFile(destFile, serializeSkillMarkdown(request), 'utf8')
  return ok()
}

/**
 * Delete an owned directory bundle or flat markdown file.
 * @param request - scope and name.
 * @param dshHome - resolved harness home.
 * @returns job result.
 */
export async function deleteOwned(request: DeleteOwnedRequest, dshHome: string): Promise<SkillJobResult> {
  if (!isSkillName(request.name)) return fail('invalid-name')
  const root = ownedRoot(request.scope, dshHome, request.projectRoot)
  if ('error' in root) return fail(root.error)
  const dir = join(root.path, request.name)
  const flat = join(root.path, `${request.name}.md`)
  const removedDir = await removeIfExists(dir)
  const removedFlat = await removeIfExists(flat)
  return removedDir || removedFlat ? ok() : fail('not-found')
}

/**
 * List Claude and Cursor skills from the user home and, when given, the
 * project. Home Cursor wins over a same-name Claude junction; a project
 * skill wins over the home copy. Already-owned names are marked imported.
 * @param request - optional project root.
 * @param dshHome - resolved harness home.
 * @param userHome - user home used for `~/.claude` / `~/.cursor`.
 * @returns sorted foreign summaries.
 */
export async function listForeign(
  request: ListForeignRequest,
  dshHome: string,
  userHome: string,
): Promise<ListForeignResult> {
  const owned = new Set([
    ...(await listRoot(join(dshHome, 'skills'), 'personal')).map(item => item.name),
    ...await projectOwnedNames(request.projectRoot),
  ])
  const byName = new Map<string, ManagedSkillSummary>()
  const scans: { source: ForeignSkillSource; location: ForeignSkillLocation; root: string }[] = [
    { source: 'claude', location: 'home', root: join(userHome, FOREIGN_DIR.claude) },
    { source: 'cursor', location: 'home', root: join(userHome, FOREIGN_DIR.cursor) },
  ]
  const project = request.projectRoot === undefined ? undefined : resolveProject(request.projectRoot)
  if (project !== undefined && !('error' in project)) {
    scans.push(
      { source: 'claude', location: 'project', root: join(project.path, FOREIGN_DIR.claude) },
      { source: 'cursor', location: 'project', root: join(project.path, FOREIGN_DIR.cursor) },
    )
  }
  for (const scan of scans) {
    for (const item of await listRoot(scan.root, scan.source, scan.location)) {
      byName.set(item.name, owned.has(item.name) ? { ...item, imported: true } : item)
    }
  }
  const items = [...byName.values()]
  items.sort((a, b) => a.name.localeCompare(b.name))
  return { items }
}

/**
 * Copy a foreign skill into an owned root. The source files stay untouched.
 * @param request - source, name, and destination scope.
 * @param dshHome - resolved harness home.
 * @returns job result.
 */
export async function importForeign(
  request: ImportForeignRequest,
  dshHome: string,
  userHome: string,
): Promise<SkillJobResult> {
  if (!isSkillName(request.name)) return fail('invalid-name')
  const from = foreignRoot(request, userHome)
  if ('error' in from) return fail(from.error)
  const dest = ownedRoot(request.targetScope, dshHome, request.projectRoot)
  if ('error' in dest) return fail(dest.error)
  const source = await locateEntry(from.path, request.name)
  if (source === undefined) return fail('foreign-not-found')
  const destDir = join(dest.path, request.name)
  if (await exists(destDir) || await exists(join(dest.path, `${request.name}.md`))) {
    return fail('name-taken')
  }
  await mkdir(dest.path, { recursive: true })
  if (source.kind === 'directory') {
    await copyTree(source.path, destDir)
  } else {
    await mkdir(destDir, { recursive: true })
    await copyFile(source.path, join(destDir, 'SKILL.md'))
  }
  return ok()
}

/**
 * Turn a listed skill on or off. Writable `.dsh` / `.agents` files are
 * patched in place. Other files are copied into an owned root first.
 * @param request - name, enabled flag, and optional source path.
 * @param dshHome - resolved harness home.
 * @returns job result.
 */
export async function setEnabled(
  request: SetEnabledRequest,
  dshHome: string,
): Promise<SkillJobResult> {
  if (!isListedSkillName(request.name)) return fail('invalid-name')
  const target = await resolveEnabledTarget(request, dshHome)
  if (target === undefined) return fail('not-found')
  const raw = await readFile(target, 'utf8').catch(() => undefined)
  if (raw === undefined) return fail('not-found')
  const next = setDisableModelInvocation(raw, request.enabled)
  if (next === undefined) return fail('not-found')
  await writeFile(target, next, 'utf8')
  return ok()
}

/**
 * Resolve harness home for this plugin instance.
 * @param configured - optional Config.dshHome.
 * @returns absolute home.
 */
export function resolveManagerHome(configured?: string): string {
  return resolveDshHome(configured)
}

/**
 * Resolve the user home used for Claude / Cursor skill directories.
 * @param configured - optional Config.userHome.
 * @returns absolute home.
 */
export function resolveUserHome(configured?: string): string {
  return configured === undefined ? homedir() : resolve(configured)
}

function foreignRoot(
  request: ImportForeignRequest,
  userHome: string,
): { path: string } | { error: SkillManagerErrorCode } {
  if (request.location === 'home') {
    return { path: join(userHome, FOREIGN_DIR[request.source]) }
  }
  const project = resolveProject(request.projectRoot ?? '')
  if ('error' in project) return project
  return { path: join(project.path, FOREIGN_DIR[request.source]) }
}

async function projectOwnedNames(projectRoot: string | undefined): Promise<readonly string[]> {
  if (projectRoot === undefined) return []
  const project = resolveProject(projectRoot)
  if ('error' in project) return []
  return (await listRoot(join(project.path, '.dsh', 'skills'), 'project')).map(item => item.name)
}

function resolveProject(projectRoot: string): { path: string } | { error: SkillManagerErrorCode } {
  if (projectRoot.trim().length === 0) return { error: 'no-project' }
  if (!isAbsolute(projectRoot)) return { error: 'invalid-project' }
  return { path: resolve(projectRoot) }
}

async function listRoot(
  root: string,
  origin: ManagedSkillSummary['origin'],
  location?: ForeignSkillLocation,
): Promise<ManagedSkillSummary[]> {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return []
  }
  const items: ManagedSkillSummary[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const dirPath = join(root, entry.name)
    if (entry.isDirectory() || (entry.isSymbolicLink() && await isDirectory(dirPath))) {
      if (!isListedSkillName(entry.name)) continue
      const sourcePath = join(dirPath, 'SKILL.md')
      if (!(await isFile(sourcePath))) continue
      items.push(await summarizeFound({ path: sourcePath, kind: 'bundle', name: entry.name }, origin, location))
      continue
    }
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const name = entry.name.slice(0, -3)
    if (!isListedSkillName(name)) continue
    items.push(await summarizeFound({ path: join(root, entry.name), kind: 'flat', name }, origin, location))
  }
  items.sort((a, b) => a.name.localeCompare(b.name))
  return items
}

async function readNamed(
  root: string,
  name: string,
  origin: ManagedSkillSummary['origin'],
): Promise<ManagedSkill | undefined> {
  const bundled = await readFileIfPresent(join(root, name, 'SKILL.md'))
  if (bundled !== undefined && bundled.name === name) return { ...bundled, origin }
  const flat = await readFileIfPresent(join(root, `${name}.md`))
  if (flat !== undefined && flat.name === name) return { ...flat, origin }
  return undefined
}

async function locateEntry(
  root: string,
  name: string,
): Promise<{ kind: 'directory' | 'file'; path: string } | undefined> {
  const dir = join(root, name)
  const file = join(root, `${name}.md`)
  if (await isDirectory(dir) && await exists(join(dir, 'SKILL.md'))) return { kind: 'directory', path: dir }
  if (await isFile(file)) return { kind: 'file', path: file }
  return undefined
}

async function readFileIfPresent(path: string): Promise<Omit<ManagedSkill, 'origin'> | undefined> {
  try {
    return parseSkillMarkdown(await readFile(path, 'utf8'))
  } catch {
    return undefined
  }
}

function summaryOf(
  skill: Omit<ManagedSkill, 'origin'>,
  origin: ManagedSkillSummary['origin'],
  sourcePath: string,
  location?: ForeignSkillLocation,
): ManagedSkillSummary {
  return {
    name: skill.name,
    description: skill.description,
    ...skill.whenToUse === undefined ? {} : { whenToUse: skill.whenToUse },
    ...location === undefined ? {} : { location },
    sourcePath,
    modelInvocable: skill.modelInvocable,
    userInvocable: skill.userInvocable,
    origin,
  }
}

function personalRank(origin: ManagedSkillSummary['origin']): number {
  if (origin === 'personal') return 4
  if (origin === 'agents') return 3
  if (origin === 'cursor') return 2
  return 1
}

function mergeByRank(
  groups: readonly (readonly ManagedSkillSummary[])[],
  rankOf: (origin: ManagedSkillSummary['origin']) => number,
): ManagedSkillSummary[] {
  const byName = new Map<string, ManagedSkillSummary>()
  for (const group of groups) {
    for (const item of group) {
      const previous = byName.get(item.name)
      if (previous === undefined || rankOf(item.origin) >= rankOf(previous.origin)) {
        byName.set(item.name, item)
      }
    }
  }
  const items = [...byName.values()]
  items.sort((a, b) => a.name.localeCompare(b.name))
  return items
}

async function summarizeFound(
  file: FoundSkillFile,
  origin: ManagedSkillSummary['origin'],
  location?: ForeignSkillLocation,
): Promise<ManagedSkillSummary> {
  let raw: string | undefined
  try {
    raw = await readFile(file.path, 'utf8')
  } catch {
    raw = undefined
  }
  const parsed = raw === undefined ? undefined : parseSkillMarkdown(raw)
  if (parsed !== undefined) {
    return summaryOf({ ...parsed, name: file.name }, origin, file.path, location)
  }
  return {
    name: file.name,
    description: file.name,
    modelInvocable: true,
    userInvocable: true,
    origin,
    sourcePath: file.path,
    ...location === undefined ? {} : { location },
  }
}

async function resolveEnabledTarget(
  request: SetEnabledRequest,
  dshHome: string,
): Promise<string | undefined> {
  if (request.sourcePath !== undefined && isWritableSkillPath(request.sourcePath) && await isFile(request.sourcePath)) {
    return request.sourcePath
  }
  const owned = await readNamed(join(dshHome, 'skills'), request.name, 'personal')
  if (owned !== undefined) {
    const bundled = join(dshHome, 'skills', request.name, 'SKILL.md')
    if (await isFile(bundled)) return bundled
    return join(dshHome, 'skills', `${request.name}.md`)
  }
  if (request.projectRoot !== undefined) {
    const project = resolveProject(request.projectRoot)
    if (!('error' in project)) {
      const bundled = join(project.path, '.dsh', 'skills', request.name, 'SKILL.md')
      if (await isFile(bundled)) return bundled
    }
  }
  if (request.sourcePath === undefined || !await exists(request.sourcePath)) return undefined
  const destRoot = request.projectRoot !== undefined && isAbsolute(request.projectRoot)
    ? join(resolve(request.projectRoot), '.dsh', 'skills')
    : join(dshHome, 'skills')
  const destDir = join(destRoot, request.name)
  const destFile = join(destDir, 'SKILL.md')
  await mkdir(destDir, { recursive: true })
  if (basename(request.sourcePath).toLowerCase() === 'skill.md') {
    await copyTree(dirname(request.sourcePath), destDir)
  } else {
    await copyFile(request.sourcePath, destFile)
  }
  return destFile
}

async function copyTree(from: string, to: string): Promise<void> {
  await mkdir(to, { recursive: true })
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const src = join(from, entry.name)
    const dest = join(to, entry.name)
    if (entry.isDirectory()) await copyTree(src, dest)
    else await copyFile(src, dest)
  }
}

async function removeIfExists(path: string): Promise<boolean> {
  try {
    await rm(path, { recursive: true, force: false })
    return true
  } catch {
    return false
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}
