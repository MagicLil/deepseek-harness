/** Spawn git to snapshot porcelain paths for opaque mutators. */

import { execFile } from 'node:child_process'
import { dirname, relative, resolve as resolvePath } from 'node:path'
import { promisify } from 'node:util'
import { contentHash } from './hash.ts'
import type { OpaqueCode, OpaqueFileSnap } from './opaque-scan.ts'
import { parseOpaquePorcelain } from './opaque-scan.ts'
import type { ReviewDisk } from './review.ts'

const execFileAsync = promisify(execFile)
const GIT_TIMEOUT_MS = 15_000
const GIT_MAX_BUFFER = 32 * 1024 * 1024

/** Classified result of one `git` child process. */
export type GitRunResult =
  | { ok: true; stdout: string }
  | { ok: false; code: 'git-unavailable' | 'git-failed'; message: string }

/** Spawn function used by the snapshot collector (injectable in tests). */
export type GitRunner = (args: string[]) => Promise<GitRunResult>

/** Successful workspace snapshot. */
export interface OpaqueSnap {
  /** Absolute repository root. */
  readonly root: string
  /** Absolute path → snap row. */
  readonly files: Map<string, OpaqueFileSnap>
}

/**
 * Classify a thrown `execFile` failure.
 * @param error - caught value.
 * @param aborted - whether the caller signal aborted.
 */
export function classifyGitError(error: unknown, aborted: boolean): GitRunResult {
  if (aborted) return { ok: false, code: 'git-failed', message: 'git was aborted' }
  const err = error as { code?: string | number; stderr?: string; message?: string }
  if (err.code === 'ENOENT') {
    return { ok: false, code: 'git-unavailable', message: 'git is not installed on this host' }
  }
  const detail = String(err.stderr ?? err.message ?? '').trim()
  if (err.code === 128 || /not a git repository/i.test(detail)) {
    return { ok: false, code: 'git-unavailable', message: detail || 'not a git repository' }
  }
  return { ok: false, code: 'git-failed', message: detail || 'git status failed' }
}

/**
 * Spawn `git` with the given args. Callers own the `-C` root.
 * @param args - argv after `git`.
 */
export async function defaultRunGit(args: string[]): Promise<GitRunResult> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: GIT_MAX_BUFFER,
      windowsHide: true,
    })
    return { ok: true, stdout }
  } catch (error: unknown) {
    return classifyGitError(error, false)
  }
}

/**
 * `git show HEAD:<relPath>` text, or null when missing.
 * @param root - repository root.
 * @param relPath - path relative to root.
 * @param run - git runner.
 */
export async function readHeadText(
  root: string,
  relPath: string,
  run: GitRunner = defaultRunGit,
): Promise<string | null> {
  const shown = await run(['-C', root, 'show', `HEAD:${toGitPath(relPath)}`])
  return shown.ok ? shown.stdout : null
}

/**
 * `git show HEAD:<path>` using the repo that contains `absPath`.
 * @param absPath - absolute workspace path.
 * @param run - git runner.
 */
export async function readHeadTextForAbs(
  absPath: string,
  run: GitRunner = defaultRunGit,
): Promise<string | null> {
  const toplevel = await run(['-C', dirname(absPath), 'rev-parse', '--show-toplevel'])
  if (!toplevel.ok) return null
  const root = toplevel.stdout.trim()
  if (root === '') return null
  const relPath = relative(root, absPath)
  if (relPath === '' || relPath.startsWith('..')) return null
  return readHeadText(root, relPath, run)
}

/**
 * Porcelain snapshot of `cwd`'s repository, with readable file bodies.
 * @param cwd - session working directory.
 * @param disk - workspace reader.
 * @param maxBytes - skip bodies larger than this.
 * @param run - git runner.
 */
export async function collectOpaqueSnap(
  cwd: string,
  disk: ReviewDisk,
  maxBytes: number,
  run: GitRunner = defaultRunGit,
): Promise<OpaqueSnap | null> {
  const toplevel = await run(['-C', cwd, 'rev-parse', '--show-toplevel'])
  if (!toplevel.ok) return null
  const root = toplevel.stdout.trim()
  if (root === '') return null
  const porcelain = await run(['-C', root, 'status', '--porcelain=v1', '--untracked-files=normal'])
  if (!porcelain.ok) return null
  const files = new Map<string, OpaqueFileSnap>()
  for (const row of parseOpaquePorcelain(porcelain.stdout).values()) {
    const absPath = resolvePath(root, row.relPath)
    files.set(absPath, await snapFile(absPath, row.relPath, row.code, disk, maxBytes))
  }
  return { root, files }
}

async function snapFile(
  absPath: string,
  relPath: string,
  code: OpaqueCode,
  disk: ReviewDisk,
  maxBytes: number,
): Promise<OpaqueFileSnap> {
  const size = await disk.sizeOf(absPath)
  if (size === null) {
    return { relPath, absPath, code, hash: null, text: null }
  }
  if (size > maxBytes) {
    return { relPath, absPath, code, hash: 'oversize', text: null }
  }
  const text = await disk.readText(absPath)
  if (text === null) {
    return { relPath, absPath, code, hash: null, text: null }
  }
  return { relPath, absPath, code, hash: contentHash(text), text }
}

function toGitPath(relPath: string): string {
  return relPath.replaceAll('\\', '/')
}
