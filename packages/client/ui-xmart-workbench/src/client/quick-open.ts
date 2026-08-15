/**
 * Ctrl+P file walk and filter. Skips build/VCS trees and caps the walk so a
 * Maven multi-module workspace cannot hang the palette.
 */
import type { FileListing } from '@deepseek-ai/dsh-client-runtime/client'
import type { ExplorerRoot } from './explorer-roots.ts'

/** One file the palette can open. */
export interface QuickOpenFile {
  /** Absolute host path. */
  readonly path: string
  /** Base name shown as the primary label. */
  readonly name: string
  /** Root-relative path using `/`. */
  readonly rel: string
}

/** Directory names the walk never enters. */
export const QUICK_OPEN_SKIP_DIRS = new Set([
  'node_modules', '.git', 'target', 'dist', 'build', 'out', 'coverage',
  '.idea', '.dsh', '__pycache__',
])

/** Hard cap on collected files. */
export const QUICK_OPEN_FILE_CAP = 5000

/** Rows shown in the palette after filtering. */
export const QUICK_OPEN_VISIBLE_CAP = 80

/**
 * Collect files under the explorer roots.
 * @param roots - session explorer roots.
 * @param listEntries - host directory listing.
 * @param signal - abort when the palette closes.
 */
export async function collectQuickOpenFiles(
  roots: readonly ExplorerRoot[],
  listEntries: (path: string, signal?: AbortSignal) => Promise<FileListing>,
  signal?: AbortSignal,
): Promise<QuickOpenFile[]> {
  const files: QuickOpenFile[] = []
  for (const root of roots) {
    if (root.path === '') continue
    await walk(root.path, root.path, listEntries, files, signal)
    if (files.length >= QUICK_OPEN_FILE_CAP) break
  }
  return files
}

/**
 * Rank files for a query. Empty query keeps walk order.
 * @param files - collected files.
 * @param query - palette input.
 */
export function filterQuickOpenFiles(
  files: readonly QuickOpenFile[],
  query: string,
): QuickOpenFile[] {
  const q = query.trim().toLowerCase()
  if (q === '') return files.slice(0, QUICK_OPEN_VISIBLE_CAP)
  const ranked: Array<{ file: QuickOpenFile; rank: number }> = []
  for (const file of files) {
    const rank = rankQuickOpen(file, q)
    if (rank < 0) continue
    ranked.push({ file, rank })
  }
  ranked.sort((a, b) => a.rank - b.rank || a.file.rel.localeCompare(b.file.rel))
  return ranked.slice(0, QUICK_OPEN_VISIBLE_CAP).map(row => row.file)
}

/**
 * Root-relative display path using `/`.
 * @param root - explorer root.
 * @param path - absolute file path.
 */
export function relativeQuickOpenPath(root: string, path: string): string {
  const normRoot = root.replace(/[/\\]+$/, '')
  if (path.startsWith(`${normRoot}/`) || path.startsWith(`${normRoot}\\`)) {
    return path.slice(normRoot.length + 1).replaceAll('\\', '/')
  }
  return path.replaceAll('\\', '/')
}

function rankQuickOpen(file: QuickOpenFile, query: string): number {
  const name = file.name.toLowerCase()
  const rel = file.rel.toLowerCase()
  if (name === query) return 0
  if (name.startsWith(query)) return 1
  if (name.includes(query)) return 2
  if (rel.includes(query)) return 3
  return -1
}

function skipDir(name: string): boolean {
  return name.startsWith('.') || QUICK_OPEN_SKIP_DIRS.has(name)
}

async function walk(
  root: string,
  dir: string,
  listEntries: (path: string, signal?: AbortSignal) => Promise<FileListing>,
  files: QuickOpenFile[],
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted === true || files.length >= QUICK_OPEN_FILE_CAP) return
  let listing: FileListing
  try {
    listing = await listEntries(dir, signal)
  }
  catch {
    return
  }
  const dirs: string[] = []
  for (const entry of listing.entries) {
    if (entry.kind === 'directory') {
      if (!skipDir(entry.name)) dirs.push(entry.path)
      continue
    }
    files.push({
      path: entry.path,
      name: entry.name,
      rel: relativeQuickOpenPath(root, entry.path),
    })
    if (files.length >= QUICK_OPEN_FILE_CAP) return
  }
  for (const next of dirs) {
    await walk(root, next, listEntries, files, signal)
    if (files.length >= QUICK_OPEN_FILE_CAP) return
  }
}
