/**
 * Disk verbs behind host.renameEntry / host.deleteEntry. The gateway maps
 * these results onto the RPC error vocabulary; tests inject the fs face.
 */
import { rename, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** Closed failure codes the explorer mutate RPCs report. */
export type EntryOpCode = 'file-unreadable' | 'file-exists' | 'file-rename-failed' | 'file-delete-failed'

/** One failed mutate, with the path the error details should name. */
export type EntryOpFailure = { ok: false; code: EntryOpCode; message: string; path: string }

/** Successful rename/delete, carrying the affected absolute path. */
export type EntryOpSuccess = { ok: true; path: string }

/** Result of one explorer mutate. */
export type EntryOpResult = EntryOpSuccess | EntryOpFailure

/** Filesystem face used by the mutate verbs (real disk by default). */
export type EntryFs = {
  stat(path: string): Promise<unknown>
  rename(from: string, to: string): Promise<void>
  rm(path: string, opts: { recursive: boolean }): Promise<void>
  /** When set, overrides {@link pathsAreSameEntry}. */
  sameEntry?(left: string, right: string): boolean
}

const defaultFs: EntryFs = {
  stat,
  rename,
  rm,
}

/**
 * Whether `name` is one path segment the explorer may write.
 * @param name - user-entered basename.
 */
export function isPlainSegment(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length > 0 && trimmed !== '.' && trimmed !== '..' && !/[/\\]/.test(trimmed)
}

/**
 * Rename `path` to `name` in the same parent directory.
 * @param path - existing absolute file or directory.
 * @param name - single destination segment.
 * @param io - filesystem face.
 */
export async function renameEntryOnDisk(
  path: string,
  name: string,
  io: EntryFs = defaultFs,
): Promise<EntryOpResult> {
  if (!isPlainSegment(name)) {
    return { ok: false, code: 'file-rename-failed', message: `${path}: name must be one path segment`, path }
  }
  try {
    await io.stat(path)
  } catch (error: unknown) {
    return { ok: false, code: 'file-unreadable', message: fileMessage(path, error), path }
  }
  const dest = join(dirname(path), name.trim())
  if (dest === path) return { ok: true, path }
  try {
    await io.stat(dest)
    if (!sameEntry(path, dest, io)) {
      return { ok: false, code: 'file-exists', message: `${dest} already exists`, path: dest }
    }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      return { ok: false, code: 'file-rename-failed', message: fileMessage(dest, error), path: dest }
    }
  }
  try {
    await io.rename(path, dest)
  } catch (error: unknown) {
    return { ok: false, code: 'file-rename-failed', message: fileMessage(path, error), path }
  }
  return { ok: true, path: dest }
}

/**
 * Delete a file or a directory tree at `path`.
 * @param path - existing absolute file or directory.
 * @param io - filesystem face.
 */
export async function deleteEntryOnDisk(
  path: string,
  io: EntryFs = defaultFs,
): Promise<EntryOpResult> {
  try {
    await io.stat(path)
  } catch (error: unknown) {
    return { ok: false, code: 'file-unreadable', message: fileMessage(path, error), path }
  }
  try {
    await io.rm(path, { recursive: true })
  } catch (error: unknown) {
    return { ok: false, code: 'file-delete-failed', message: fileMessage(path, error), path }
  }
  return { ok: true, path }
}

function fileMessage(path: string, error: unknown): string {
  return `${path}: ${error instanceof Error ? error.message : String(error)}`
}

/**
 * Whether two absolute paths name the same directory entry.
 * Windows is case-insensitive; other platforms compare exactly.
 * @param left - first path.
 * @param right - second path.
 * @param platform - `process.platform` override for tests.
 */
export function pathsAreSameEntry(left: string, right: string, platform = process.platform): boolean {
  if (left === right) return true
  return platform === 'win32' && left.toLowerCase() === right.toLowerCase()
}

function sameEntry(left: string, right: string, io: EntryFs): boolean {
  return io.sameEntry?.(left, right) ?? pathsAreSameEntry(left, right)
}
