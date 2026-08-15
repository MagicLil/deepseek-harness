/**
 * Detect which language servers a project folder needs, then start them
 * before the user opens a source file.
 */

import type { FileListing } from '@deepseek-ai/dsh-client-runtime/client'
import type { EditorLspRemote, EditorLspRemotes } from './editor-lsp.ts'
import { absPath, dirname, joinPath } from './route-file.ts'

/** Language buckets that share one persistent server. */
export type WarmLanguage = 'java' | 'ts' | 'vue'

const JAVA_MARKERS = new Set([
  'pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts', '.classpath',
])
const TS_MARKERS = new Set(['tsconfig.json', 'jsconfig.json', 'package.json'])
const TS_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'])
const MARKER_FILES = [...JAVA_MARKERS, ...TS_MARKERS]
const MAX_CLIMB = 8
const MAX_WARM_PROJECTS = 6
const MAX_NEST_CHILDREN = 8
const NEST_DIRS = new Set(['apps', 'packages', 'frontend', 'web', 'client'])
const SEED_DIRS: Record<WarmLanguage, readonly string[]> = {
  java: ['src/main/java', 'src', ''],
  ts: ['src', ''],
  vue: ['src', ''],
}
const SEED_EXTS: Record<WarmLanguage, readonly string[]> = {
  java: ['.java'],
  ts: ['.ts', '.tsx', '.js', '.jsx'],
  vue: ['.vue'],
}

/** One workspace the editor should preload. */
export type WarmProject = {
  readonly root: string
  readonly languages: readonly WarmLanguage[]
}

/**
 * Compare workspace roots across POSIX / Windows separators.
 * @param path - absolute folder.
 */
export function rootKey(path: string): string {
  return path.replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase()
}

/**
 * Deduplicate cwd + explorer roots.
 * @param paths - candidate folders.
 */
export function uniqueWarmRoots(paths: readonly (string | undefined)[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const path of paths) {
    if (typeof path !== 'string' || path === '') continue
    const key = rootKey(path)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(path)
  }
  return out
}

/**
 * Which language servers a directory listing implies.
 * @param names - file and folder names in one directory.
 */
export function languagesFromNames(names: readonly string[]): WarmLanguage[] {
  const found = new Set<WarmLanguage>()
  for (const raw of names) {
    const name = raw.toLowerCase()
    const dot = name.lastIndexOf('.')
    const ext = dot <= 0 ? '' : name.slice(dot)
    if (JAVA_MARKERS.has(name) || ext === '.java') found.add('java')
    if (TS_MARKERS.has(name) || TS_EXTS.has(ext)) found.add('ts')
    if (ext === '.vue') found.add('vue')
  }
  return [...found]
}

/**
 * True when package.json lists Vue as a dependency or plugin.
 * @param text - package.json contents.
 */
export function packageJsonLooksLikeVue(text: string): boolean {
  return /"vue"\s*:/.test(text)
}

/**
 * Pair detected languages with the remotes that are actually mounted.
 * @param languages - project markers.
 * @param remotes - host namespaces.
 */
export function remotesForLanguages(
  languages: readonly WarmLanguage[],
  remotes: EditorLspRemotes,
): Array<{ language: WarmLanguage; remote: EditorLspRemote }> {
  const out: Array<{ language: WarmLanguage; remote: EditorLspRemote }> = []
  for (const language of languages) {
    const remote = language === 'java'
      ? remotes.javaLsp
      : language === 'ts'
        ? remotes.tsLsp
        : remotes.vueLsp
    if (remote !== undefined) out.push({ language, remote })
  }
  return out
}

type ListEntries = (path: string, signal?: AbortSignal) => Promise<FileListing>
type ReadFile = (path: string, signal?: AbortSignal) => Promise<string>

/**
 * Walk from a session/explorer folder up to the Maven / npm / Gradle root.
 * @param start - cwd or explorer root.
 * @param listEntries - one-directory listing, when the host has it.
 * @param readFile - marker-file probe when listing fails.
 * @param signal - abort when the workspace changes.
 */
export async function resolveWarmProject(
  start: string,
  listEntries: ListEntries | undefined,
  readFile: ReadFile | undefined,
  signal?: AbortSignal,
): Promise<WarmProject | undefined> {
  let current = start
  for (let step = 0; step < MAX_CLIMB; step++) {
    if (signal?.aborted) return undefined
    const names = await namesAt(current, listEntries, readFile, signal)
    const languages = await withVueFromPackage(
      current,
      languagesFromNames(names),
      names,
      readFile,
      signal,
    )
    if (languages.length > 0) return { root: current, languages }
    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
  return undefined
}

/**
 * Session folder plus one level of `apps` / `packages` children.
 * A pnpm monorepo root is not the Vue app Volar should index.
 * @param starts - cwd and explorer roots.
 * @param listEntries - one-directory listing.
 * @param readFile - marker-file probe.
 * @param signal - abort.
 */
export async function collectWarmProjects(
  starts: readonly string[],
  listEntries: ListEntries | undefined,
  readFile: ReadFile | undefined,
  signal?: AbortSignal,
): Promise<WarmProject[]> {
  const out: WarmProject[] = []
  const seen = new Set<string>()
  const add = (project: WarmProject): void => {
    const key = rootKey(project.root)
    if (seen.has(key) || out.length >= MAX_WARM_PROJECTS) return
    seen.add(key)
    out.push(project)
  }
  for (const start of starts) {
    if (signal?.aborted || out.length >= MAX_WARM_PROJECTS) break
    const project = await resolveWarmProject(start, listEntries, readFile, signal)
    if (project !== undefined) add(project)
    if (listEntries === undefined) continue
    let names: string[]
    try {
      names = (await listEntries(start, signal)).entries.map(entry => entry.name)
    }
    catch {
      continue
    }
    for (const name of names) {
      if (!NEST_DIRS.has(name.toLowerCase())) continue
      let children: FileListing
      try {
        children = await listEntries(joinPath(start, name), signal)
      }
      catch {
        continue
      }
      const dirs = children.entries.filter(entry => entry.kind === 'directory').slice(0, MAX_NEST_CHILDREN)
      for (const dir of dirs) {
        if (signal?.aborted || out.length >= MAX_WARM_PROJECTS) break
        const child = await resolveWarmProject(
          dir.path !== '' ? dir.path : joinPath(joinPath(start, name), dir.name),
          listEntries,
          readFile,
          signal,
        )
        if (child !== undefined) add(child)
      }
    }
  }
  return out
}

/**
 * A small source file whose `didOpen` starts tsserver / JDT import.
 * @param root - project folder.
 * @param language - which seed to look for.
 * @param listEntries - one-directory listing.
 * @param signal - abort.
 */
export async function findSeedFile(
  root: string,
  language: WarmLanguage,
  listEntries: ListEntries | undefined,
  signal?: AbortSignal,
): Promise<string | undefined> {
  if (listEntries === undefined) return undefined
  const exts = SEED_EXTS[language]
  for (const rel of SEED_DIRS[language]) {
    if (signal?.aborted) return undefined
    const dir = rel === '' ? root : absPath(root, rel)
    let listing: FileListing
    try {
      listing = await listEntries(dir, signal)
    }
    catch {
      continue
    }
    const files = listing.entries.filter(entry =>
      entry.kind !== 'directory' && exts.some(ext => entry.name.toLowerCase().endsWith(ext)),
    )
    const preferred = files.find(entry => /^(app\.vue|main\.(ts|tsx|js)|application\.java)$/i.test(entry.name))
    const picked = preferred ?? files[0]
    if (picked !== undefined) return picked.path !== '' ? picked.path : joinPath(dir, picked.name)
  }
  return undefined
}

/**
 * `didOpen` a seed file so tsserver / JDT starts before the first hover.
 * @param project - resolved package.
 * @param language - which remote.
 * @param remote - editor LSP face.
 * @param listEntries - directory listing.
 * @param readFile - file text.
 * @param signal - abort.
 */
export async function seedLanguageServer(
  project: WarmProject,
  language: WarmLanguage,
  remote: EditorLspRemote,
  listEntries: ListEntries | undefined,
  readFile: ReadFile | undefined,
  signal?: AbortSignal,
): Promise<boolean> {
  if (readFile === undefined || typeof remote.open !== 'function') return false
  const seed = await findSeedFile(project.root, language, listEntries, signal)
  if (seed === undefined || signal?.aborted) return false
  try {
    const text = await readFile(seed, signal)
    const result = await remote.open({ workspaceRoot: project.root, path: seed, text })
    if (!result.ok) return false
    try {
      await remote.hover({
        workspaceRoot: project.root,
        path: seed,
        line: 0,
        character: 0,
      })
    }
    catch {
      // First hover pays tsserver; a timeout still leaves the server running.
    }
    return true
  }
  catch {
    return false
  }
}

async function namesAt(
  root: string,
  listEntries: ListEntries | undefined,
  readFile: ReadFile | undefined,
  signal?: AbortSignal,
): Promise<string[]> {
  if (listEntries !== undefined) {
    try {
      const listing = await listEntries(root, signal)
      return listing.entries.map(entry => entry.name)
    }
    catch {
      // listing is optional; marker probes still work
    }
  }
  if (readFile === undefined) return []
  const names: string[] = []
  for (const marker of MARKER_FILES) {
    if (signal?.aborted) return names
    try {
      await readFile(joinPath(root, marker), signal)
      names.push(marker)
    }
    catch {
      // missing
    }
  }
  return names
}

async function withVueFromPackage(
  root: string,
  languages: WarmLanguage[],
  names: readonly string[],
  readFile: ReadFile | undefined,
  signal?: AbortSignal,
): Promise<WarmLanguage[]> {
  if (languages.includes('vue') || readFile === undefined) return languages
  if (!names.some(name => name.toLowerCase() === 'package.json')) return languages
  try {
    const text = await readFile(joinPath(root, 'package.json'), signal)
    if (packageJsonLooksLikeVue(text)) return [...languages, 'vue']
  }
  catch {
    // ignore
  }
  return languages
}
