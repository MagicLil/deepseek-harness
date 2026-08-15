/**
 * System-git status for the in-app editor SCM panel. Same source Cursor and
 * VS Code use: `git rev-parse` + `git status --porcelain=v1 -b`. Parsing is
 * isolated so the porcelain table can be tested without spawning git.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitChange, GitFileStatus, GitStatus } from './api/host.ts'

const execFileAsync = promisify(execFile)
const GIT_TIMEOUT_MS = 15_000
const GIT_MAX_BUFFER = 2 * 1024 * 1024

/** Result of walking porcelain output, or a classified spawn failure. */
export type GitStatusResult =
  | { ok: true; value: GitStatus }
  | { ok: false; code: 'git-unavailable' | 'git-failed'; message: string }

/**
 * Read the repository containing `path`.
 * @param path - workspace directory or any file inside it.
 * @param signal - aborts both git child processes.
 */
export async function collectGitStatus(path: string, signal?: AbortSignal): Promise<GitStatusResult> {
  const toplevel = await resolveGitRoot(path, signal)
  if (!toplevel.ok) return toplevel
  const { root } = toplevel
  const porcelain = await runGit(['-C', root, 'status', '--porcelain=v1', '-b', '--untracked-files=normal'], signal)
  if (!porcelain.ok) return porcelain
  return { ok: true, value: parseGitPorcelain(root, porcelain.stdout) }
}

/**
 * Parse `git status --porcelain=v1 -b` stdout into the editor SCM snapshot.
 * @param root - absolute repository root.
 * @param stdout - porcelain text (LF or CRLF).
 */
export function parseGitPorcelain(root: string, stdout: string): GitStatus {
  const lines = stdout.split(/\r?\n/).filter(line => line.length > 0)
  const header = lines[0] ?? ''
  const { branch, ahead, behind, detached } = parseBranchHeader(header)
  const changes: GitChange[] = []
  for (const line of lines.slice(header.startsWith('##') ? 1 : 0)) {
    const change = parseChangeLine(line)
    if (change !== undefined) changes.push(change)
  }
  return { root, branch, ahead, behind, detached, changes }
}

function parseBranchHeader(header: string): Pick<GitStatus, 'branch' | 'ahead' | 'behind' | 'detached'> {
  if (!header.startsWith('## ')) {
    return { branch: 'HEAD', ahead: 0, behind: 0, detached: true }
  }
  const body = header.slice(3)
  if (body.startsWith('HEAD (no branch)') || body === 'HEAD') {
    return { branch: 'HEAD', ahead: 0, behind: 0, detached: true }
  }
  const ahead = Number(/ahead (\d+)/.exec(body)?.[1] ?? 0)
  const behind = Number(/behind (\d+)/.exec(body)?.[1] ?? 0)
  const name = body.split('...')[0]?.trim() || 'HEAD'
  return { branch: name, ahead, behind, detached: false }
}

function parseChangeLine(line: string): GitChange | undefined {
  if (line.length < 4) return undefined
  const index = line[0] ?? ' '
  const worktree = line[1] ?? ' '
  const rest = line.slice(3)
  const path = renameTarget(rest)
  if (path === '') return undefined
  return { path, status: collapseStatus(index, worktree) }
}

function renameTarget(rest: string): string {
  const arrow = rest.indexOf(' -> ')
  const raw = arrow >= 0 ? rest.slice(arrow + 4) : rest
  return unquote(raw.trim())
}

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replaceAll('\\"', '"')
  }
  return value
}

function collapseStatus(index: string, worktree: string): GitFileStatus {
  const pair = `${index}${worktree}`
  if (pair.includes('U') || pair === 'AA' || pair === 'DD') return 'conflict'
  if (pair === '??') return 'untracked'
  if (index === 'R' || worktree === 'R') return 'renamed'
  if (index === 'A' || worktree === 'A') return 'added'
  if (index === 'D' || worktree === 'D') return 'deleted'
  return 'modified'
}

/** Classified result of one `git` child process. */
export type GitRunResult =
  | { ok: true; stdout: string }
  | { ok: false; code: 'git-unavailable' | 'git-failed'; message: string }

/**
 * Resolve the repository root that contains `path`.
 * @param path - workspace directory or any file inside it.
 * @param signal - aborts the git child process.
 */
export async function resolveGitRoot(path: string, signal?: AbortSignal): Promise<
  | { ok: true; root: string }
  | { ok: false; code: 'git-unavailable' | 'git-failed'; message: string }
> {
  const toplevel = await runGit(['-C', path, 'rev-parse', '--show-toplevel'], signal)
  if (!toplevel.ok) return toplevel
  const root = toplevel.stdout.trim()
  if (root === '') {
    return { ok: false, code: 'git-unavailable', message: `${path} is not inside a git work tree` }
  }
  return { ok: true, root }
}

/**
 * Spawn `git` with the given args. Callers own the `-C` root.
 * @param args - argv after `git`.
 * @param signal - aborts the child process.
 */
export async function runGit(args: string[], signal?: AbortSignal): Promise<GitRunResult> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: GIT_MAX_BUFFER,
      windowsHide: true,
      signal,
    })
    return { ok: true, stdout }
  } catch (error: unknown) {
    if (signal?.aborted) {
      return { ok: false, code: 'git-failed', message: 'git was aborted' }
    }
    const err = error as { code?: string | number; stderr?: string; message?: string }
    if (err.code === 'ENOENT') {
      return { ok: false, code: 'git-unavailable', message: 'git is not installed on this host' }
    }
    const detail = (err.stderr ?? err.message ?? String(error)).toString().trim()
    if (err.code === 128 || /not a git repository/i.test(detail)) {
      return { ok: false, code: 'git-unavailable', message: detail || 'not a git repository' }
    }
    return { ok: false, code: 'git-failed', message: detail || 'git status failed' }
  }
}
