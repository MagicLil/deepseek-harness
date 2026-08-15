/**
 * Mutating git verbs for the workbench SCM panel. Every call goes through
 * {@link runGit}; this module never writes `user.name` / `user.email` and
 * never runs push / pull / fetch.
 */
import { resolveGitRoot, runGit } from './git-status.ts'
import type { GitCommitResult, GitDiff, GitDiffSide, GitLogEntry } from './api/host.ts'

/** Classified git-ops failure (same codes as status). */
export type GitOpsResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: 'git-unavailable' | 'git-failed'; message: string }

const LOG_FORMAT = '%H%x1f%s%x1f%an%x1f%at'
const DEFAULT_LOG_LIMIT = 20

/**
 * Unified diff for one path (or the whole tree) against the index or HEAD.
 * @param path - any path inside the work tree.
 * @param side - `worktree` = unstaged (`git diff`); `staged` = index (`git diff --cached`).
 * @param file - optional repository-relative path.
 * @param signal - aborts the git child process.
 */
export async function collectGitDiff(
  path: string,
  side: GitDiffSide,
  file: string | undefined,
  signal?: AbortSignal,
): Promise<GitOpsResult<GitDiff>> {
  const root = await resolveGitRoot(path, signal)
  if (!root.ok) return root
  const args = diffArgs(root.root, side, file)
  const ran = await runGit(args, signal)
  if (!ran.ok) return ran
  return {
    ok: true,
    value: file === undefined
      ? { root: root.root, side, text: ran.stdout }
      : { root: root.root, side, path: file, text: ran.stdout },
  }
}

/**
 * `git add` the given repository-relative paths.
 * @param path - any path inside the work tree.
 * @param files - repository-relative paths.
 * @param signal - aborts the git child process.
 */
export async function collectGitStage(
  path: string,
  files: readonly string[],
  signal?: AbortSignal,
): Promise<GitOpsResult<{ root: string }>> {
  return runAtRoot(path, ['add', '--', ...files], signal)
}

/**
 * `git restore --staged` the given repository-relative paths.
 * @param path - any path inside the work tree.
 * @param files - repository-relative paths.
 * @param signal - aborts the git child process.
 */
export async function collectGitUnstage(
  path: string,
  files: readonly string[],
  signal?: AbortSignal,
): Promise<GitOpsResult<{ root: string }>> {
  return runAtRoot(path, ['restore', '--staged', '--', ...files], signal)
}

/**
 * `git commit --no-gpg-sign -m` without touching identity config.
 * @param path - any path inside the work tree.
 * @param message - commit message (already trimmed by the schema).
 * @param signal - aborts the git child process.
 */
export async function collectGitCommit(
  path: string,
  message: string,
  signal?: AbortSignal,
): Promise<GitOpsResult<GitCommitResult>> {
  const root = await resolveGitRoot(path, signal)
  if (!root.ok) return root
  const committed = await runGit(['-C', root.root, 'commit', '--no-gpg-sign', '-m', message], signal)
  if (!committed.ok) return committed
  const head = await runGit(['-C', root.root, 'rev-parse', 'HEAD'], signal)
  if (!head.ok) return head
  return { ok: true, value: { root: root.root, hash: head.stdout.trim() } }
}

/**
 * Discard worktree changes: restore tracked files from HEAD, then `git clean -f`
 * so untracked paths disappear. Never runs `clean -d` (directories stay).
 * @param path - any path inside the work tree.
 * @param files - repository-relative paths.
 * @param signal - aborts the git child process.
 */
export async function collectGitDiscard(
  path: string,
  files: readonly string[],
  signal?: AbortSignal,
): Promise<GitOpsResult<{ root: string }>> {
  const root = await resolveGitRoot(path, signal)
  if (!root.ok) return root
  const restored = await runGit(['-C', root.root, 'restore', '--worktree', '--source=HEAD', '--', ...files], signal)
  if (!restored.ok && !isUntrackedRestoreFailure(restored.message)) return restored
  const cleaned = await runGit(['-C', root.root, 'clean', '-f', '--', ...files], signal)
  if (!cleaned.ok) return cleaned
  return { ok: true, value: { root: root.root } }
}

/**
 * Recent commits (`git log -n`).
 * @param path - any path inside the work tree.
 * @param limit - max rows (caller-clamped).
 * @param signal - aborts the git child process.
 */
export async function collectGitLog(
  path: string,
  limit: number,
  signal?: AbortSignal,
): Promise<GitOpsResult<GitLogEntry[]>> {
  const root = await resolveGitRoot(path, signal)
  if (!root.ok) return root
  const n = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : DEFAULT_LOG_LIMIT
  const ran = await runGit(['-C', root.root, 'log', `-n${n}`, `--format=${LOG_FORMAT}`], signal)
  if (!ran.ok) return ran
  return { ok: true, value: parseGitLog(ran.stdout) }
}

/**
 * Build `git diff` argv for one side.
 * @param root - repository root.
 * @param side - worktree or staged.
 * @param file - optional repository-relative path.
 */
export function diffArgs(root: string, side: GitDiffSide, file: string | undefined): string[] {
  const args = ['-C', root, 'diff']
  if (side === 'staged') args.push('--cached')
  args.push('--')
  if (file !== undefined) args.push(file)
  return args
}

/**
 * Parse `git log --format=%H%x1f%s%x1f%an%x1f%at` stdout.
 * @param stdout - log text.
 */
export function parseGitLog(stdout: string): GitLogEntry[] {
  const out: GitLogEntry[] = []
  for (const line of stdout.split(/\r?\n/)) {
    if (line.length === 0) continue
    const [hash, subject, author, stamp] = line.split('\x1f')
    if (hash === undefined || hash.length === 0) continue
    out.push({
      hash,
      subject: subject ?? '',
      author: author ?? '',
      timestamp: Number(stamp ?? 0),
    })
  }
  return out
}

/**
 * Whether `git restore` failed because the path is untracked (discard continues to clean).
 * @param message - git stderr.
 */
export function isUntrackedRestoreFailure(message: string): boolean {
  return /did not match any file|untracked|error: pathspec/i.test(message)
}

async function runAtRoot(
  path: string,
  verb: readonly string[],
  signal?: AbortSignal,
): Promise<GitOpsResult<{ root: string }>> {
  const root = await resolveGitRoot(path, signal)
  if (!root.ok) return root
  const ran = await runGit(['-C', root.root, ...verb], signal)
  if (!ran.ok) return ran
  return { ok: true, value: { root: root.root } }
}
