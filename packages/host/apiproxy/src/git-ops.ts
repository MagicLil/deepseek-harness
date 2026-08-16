/**
 * Mutating git verbs for the workbench SCM panel. Every call goes through
 * {@link runGit}; this module never writes `user.name` / `user.email` and
 * never force-pushes.
 */
import { resolveGitRoot, runGit } from './git-status.ts'
import type {
  GitBranch, GitCommitResult, GitDiff, GitDiffSide, GitLogEntry, GitRef, GitSyncMode,
} from './api/host.ts'

const REMOTE_TIMEOUT_MS = 120_000
const BRANCH_FORMAT = '%(refname:short)%00%(HEAD)%00%(upstream:short)'

/** Classified git-ops failure (same codes as status). */
export type GitOpsResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: 'git-unavailable' | 'git-failed'; message: string }

const LOG_FORMAT = '%x1e%H%x1f%s%x1f%an%x1f%at%x1f%P%x1f%b'
const DEFAULT_LOG_LIMIT = 20
const SHORTSTAT = /\n[ \t]*(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?[ \t]*\r?$/

/**
 * Unified diff for one path (or the whole tree) against the index, HEAD,
 * or a specific commit.
 * @param path - any path inside the work tree.
 * @param side - `worktree` = unstaged (`git diff`); `staged` = index (`git diff --cached`).
 * @param file - optional repository-relative path.
 * @param signal - aborts the git child process.
 * @param commit - when set, `side` is ignored and the first-parent patch is returned.
 */
export async function collectGitDiff(
  path: string,
  side: GitDiffSide,
  file: string | undefined,
  signal?: AbortSignal,
  commit?: string,
): Promise<GitOpsResult<GitDiff>> {
  if (commit !== undefined && !isGitCommitId(commit)) {
    return { ok: false, code: 'git-failed', message: 'invalid commit' }
  }
  const root = await resolveGitRoot(path, signal)
  if (!root.ok) return root
  const args = diffArgs(root.root, side, file, commit)
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
 * Recent commits (`git log -n`) from HEAD. Walking every tip (`--all`)
 * paints a barcode of remote-branch rails; the SCM graph follows the
 * current checkout the way Cursor's history list does.
 * @param path - any path inside the work tree.
 * @param limit - max rows (caller-clamped).
 * @param signal - aborts the git child process.
 * @param skip - older-page offset (`git log --skip`).
 */
export async function collectGitLog(
  path: string,
  limit: number,
  signal?: AbortSignal,
  skip = 0,
): Promise<GitOpsResult<GitLogEntry[]>> {
  const root = await resolveGitRoot(path, signal)
  if (!root.ok) return root
  const n = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : DEFAULT_LOG_LIMIT
  const offset = Number.isFinite(skip) && skip > 0 ? Math.min(Math.floor(skip), 100_000) : 0
  const args = ['-C', root.root, 'log', `-n${n}`]
  if (offset > 0) args.push(`--skip=${offset}`)
  args.push(`--format=${LOG_FORMAT}`, '--shortstat')
  const ran = await runGit(args, signal)
  if (!ran.ok) return ran
  return { ok: true, value: await decorateGitLog(root.root, parseGitLog(ran.stdout), signal) }
}

/**
 * Whether a string is a safe abbreviated or full commit hash.
 * @param value - candidate from the wire or a direct caller.
 */
export function isGitCommitId(value: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(value)
}

/**
 * Build `git diff` / `git show` argv for one side or one commit.
 * @param root - repository root.
 * @param side - worktree or staged (ignored when `commit` is set).
 * @param file - optional repository-relative path.
 * @param commit - optional 7–40 hex commit id.
 */
export function diffArgs(
  root: string,
  side: GitDiffSide,
  file: string | undefined,
  commit?: string,
): string[] {
  if (commit !== undefined) {
    const args = ['-C', root, 'show', '--format=', '--first-parent', '--patch', commit, '--']
    if (file !== undefined) args.push(file)
    return args
  }
  const args = ['-C', root, 'diff']
  if (side === 'staged') args.push('--cached')
  args.push('--')
  if (file !== undefined) args.push(file)
  return args
}

/**
 * Parse `git log --format=%x1e%H…%b --shortstat` stdout. Single-line
 * records without the record separator still parse (older fixtures).
 * @param stdout - log text.
 */
export function parseGitLog(stdout: string): GitLogEntry[] {
  if (stdout.includes('\x1e')) {
    const out: GitLogEntry[] = []
    for (const record of stdout.split('\x1e')) {
      const row = parseGitLogRecord(record)
      if (row !== undefined) out.push(row)
    }
    return out
  }
  const out: GitLogEntry[] = []
  for (const line of stdout.split(/\r?\n/)) {
    if (line.length === 0) continue
    const row = parseGitLogRecord(line)
    if (row !== undefined) out.push(row)
  }
  return out
}

/**
 * Parse one commit record (fields, optional body, optional shortstat).
 * @param record - text after a `%x1e` split, or one legacy line.
 */
export function parseGitLogRecord(record: string): GitLogEntry | undefined {
  const trimmed = record.replace(/^\r?\n/, '').replace(/\r?\n+$/, '')
  if (trimmed.length === 0) return undefined
  const stat = SHORTSTAT.exec(trimmed)
  const core = stat === null ? trimmed : trimmed.slice(0, stat.index)
  const [hash, subject, author, stamp, parentField, ...bodyParts] = core.split('\x1f')
  if (hash === undefined || hash.trim().length === 0) return undefined
  const parents = (parentField ?? '').split(' ').filter(parent => parent.length > 0)
  const body = bodyParts.join('\x1f').replace(/\s+$/g, '')
  const row: GitLogEntry = {
    hash: hash.trim(),
    subject: subject ?? '',
    author: author ?? '',
    timestamp: Number(stamp ?? 0),
  }
  if (parents.length > 0) row.parents = parents
  if (body.length > 0) row.body = body
  if (stat !== null) {
    row.files = Number(stat[1])
    if (stat[2] !== undefined) row.insertions = Number(stat[2])
    if (stat[3] !== undefined) row.deletions = Number(stat[3])
  }
  return row
}

/**
 * Copy a non-empty `origin` URL onto every log row.
 * @param rows - newest-first log.
 * @param remote - `git remote get-url origin` result, or undefined when the child was not run.
 */
export function attachOriginUrl(
  rows: GitLogEntry[],
  remote: { ok: true; stdout: string } | { ok: false } | undefined,
): GitLogEntry[] {
  if (remote === undefined || !remote.ok) return rows
  const originUrl = remote.stdout.trim()
  if (originUrl.length === 0) return rows
  return rows.map(row => ({ ...row, originUrl }))
}

/**
 * Whether `git restore` failed because the path is untracked (discard continues to clean).
 * @param message - git stderr.
 */
export function isUntrackedRestoreFailure(message: string): boolean {
  return /did not match any file|untracked|error: pathspec/i.test(message)
}

/**
 * User-initiated fetch / ff-only pull / push. First push without upstream
 * retries as `git push -u origin HEAD`.
 * @param path - any path inside the work tree.
 * @param mode - remote verb.
 * @param signal - aborts the git child process.
 */
export async function collectGitSync(
  path: string,
  mode: GitSyncMode,
  signal?: AbortSignal,
): Promise<GitOpsResult<{ root: string }>> {
  const root = await resolveGitRoot(path, signal)
  if (!root.ok) return root
  if (mode === 'fetch') {
    return finishRemote(root.root, await runGit(['-C', root.root, 'fetch'], signal, REMOTE_TIMEOUT_MS))
  }
  if (mode === 'pull') {
    return finishRemote(root.root, await runGit(['-C', root.root, 'pull', '--ff-only'], signal, REMOTE_TIMEOUT_MS))
  }
  const pushed = await runGit(['-C', root.root, 'push'], signal, REMOTE_TIMEOUT_MS)
  if (pushed.ok || !isNoUpstreamPushFailure(pushed.message)) return finishRemote(root.root, pushed)
  return finishRemote(
    root.root,
    await runGit(['-C', root.root, 'push', '-u', 'origin', 'HEAD'], signal, REMOTE_TIMEOUT_MS),
  )
}

/**
 * Local and remote-tracking branch list for the SCM picker.
 * @param path - any path inside the work tree.
 * @param signal - aborts the git child process.
 */
export async function collectGitBranches(
  path: string,
  signal?: AbortSignal,
): Promise<GitOpsResult<{ root: string; branches: GitBranch[] }>> {
  const root = await resolveGitRoot(path, signal)
  if (!root.ok) return root
  const heads = await runGit(
    ['-C', root.root, 'for-each-ref', `--format=${BRANCH_FORMAT}`, 'refs/heads'],
    signal,
  )
  if (!heads.ok) return heads
  const remotes = await runGit(
    ['-C', root.root, 'for-each-ref', `--format=${BRANCH_FORMAT}`, 'refs/remotes'],
    signal,
  )
  const remoteRows = remotes.ok
    ? parseGitBranches(remotes.stdout, true).filter(row => !isGitRemoteSymbolicRef(row.name))
    : []
  return {
    ok: true,
    value: { root: root.root, branches: [...parseGitBranches(heads.stdout), ...remoteRows] },
  }
}

/**
 * `git switch`, `git switch -c`, or `git switch --detach`.
 * @param path - any path inside the work tree.
 * @param name - schema-validated branch name or commit hash.
 * @param create - when true, create the branch.
 * @param detach - when true, leave HEAD detached at `name`.
 * @param signal - aborts the git child process.
 */
export async function collectGitCheckout(
  path: string,
  name: string,
  create: boolean,
  detach = false,
  signal?: AbortSignal,
): Promise<GitOpsResult<{ root: string; name: string }>> {
  const root = await resolveGitRoot(path, signal)
  if (!root.ok) return root
  if (detach && create) {
    return { ok: false, code: 'git-failed', message: 'cannot create and detach' }
  }
  const args = detach
    ? ['-C', root.root, 'switch', '--detach', name]
    : create
      ? ['-C', root.root, 'switch', '-c', name]
      : ['-C', root.root, 'switch', '--', name]
  const ran = await runGit(args, signal)
  if (!ran.ok) return ran
  return { ok: true, value: { root: root.root, name } }
}

/**
 * Map `for-each-ref %(objectname)%00%(refname)` lines to commit hashes.
 * @param stdout - ref listing.
 */
export function parseGitRefMap(stdout: string): Map<string, GitRef[]> {
  const map = new Map<string, GitRef[]>()
  for (const line of stdout.split(/\r?\n/)) {
    if (line.length === 0) continue
    const [hash, refname] = line.split('\0')
    if (hash === undefined || hash.length === 0 || refname === undefined) continue
    const ref = gitRefFromName(refname)
    if (ref === undefined) continue
    const list = map.get(hash) ?? []
    list.push(ref)
    map.set(hash, list)
  }
  return map
}

/**
 * Shorten a full refname into an SCM pill.
 * @param refname - `refs/heads/…`, `refs/remotes/…`, or `refs/tags/…`.
 */
export function gitRefFromName(refname: string): GitRef | undefined {
  if (refname.startsWith('refs/heads/')) return { kind: 'branch', name: refname.slice(11) }
  if (refname.startsWith('refs/remotes/')) return { kind: 'remote', name: refname.slice(13) }
  if (refname.startsWith('refs/tags/')) return { kind: 'tag', name: refname.slice(10) }
  return undefined
}

/**
 * Attach ref pills and HEAD to log rows.
 * @param rows - newest-first log.
 * @param refs - hash → refs from `for-each-ref`.
 * @param headHash - `rev-parse HEAD`.
 * @param headAbbrev - `rev-parse --abbrev-ref HEAD` (`HEAD` when detached).
 */
export function applyGitRefs(
  rows: readonly GitLogEntry[],
  refs: Map<string, GitRef[]>,
  headHash: string,
  headAbbrev: string,
): GitLogEntry[] {
  const detached = headAbbrev === 'HEAD'
  return rows.map((row) => {
    const found = [...refs.get(row.hash) ?? []]
    const onHead = detached
      ? row.hash === headHash
      : found.some(ref => ref.kind === 'branch' && ref.name === headAbbrev)
    if (onHead) found.unshift({ kind: 'head', name: 'HEAD' })
    return found.length > 0 ? { ...row, refs: found } : { ...row }
  })
}

/**
 * Attach current refs to log rows. Decoration failures leave the rows plain.
 * @param root - repository root.
 * @param rows - newest-first log.
 * @param signal - aborts the decorate git children.
 */
async function decorateGitLog(
  root: string,
  rows: GitLogEntry[],
  signal?: AbortSignal,
): Promise<GitLogEntry[]> {
  const listed = await runGit(
    ['-C', root, 'for-each-ref', '--format=%(objectname)%00%(refname)'],
    signal,
  )
  const head = listed.ok ? await runGit(['-C', root, 'rev-parse', 'HEAD'], signal) : undefined
  const abbrev = head?.ok ? await runGit(['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD'], signal) : undefined
  const remote = await runGit(['-C', root, 'remote', 'get-url', 'origin'], signal)
  const decorated = listed.ok && head?.ok && abbrev?.ok
    ? applyGitRefs(rows, parseGitRefMap(listed.stdout), head.stdout.trim(), abbrev.stdout.trim())
    : rows
  return attachOriginUrl(decorated, remote)
}

/**
 * Parse `for-each-ref` NUL fields into SCM branch rows.
 * @param stdout - ref listing.
 * @param remote - mark rows as remote-tracking refs.
 */
/**
 * Remote symbolic names (`origin`, `origin/HEAD`) are not switchable branches.
 * @param name - `for-each-ref` short name from `refs/remotes`.
 */
export function isGitRemoteSymbolicRef(name: string): boolean {
  return name === 'HEAD' || name.endsWith('/HEAD') || !name.includes('/')
}

export function parseGitBranches(stdout: string, remote = false): GitBranch[] {
  const out: GitBranch[] = []
  for (const line of stdout.split(/\r?\n/)) {
    if (line.length === 0) continue
    const [name, head, upstream] = line.split('\0')
    if (name === undefined || name.length === 0) continue
    const row: GitBranch = { name, current: head === '*' }
    if (upstream !== undefined && upstream.length > 0) row.upstream = upstream
    if (remote) row.remote = true
    out.push(row)
  }
  return out
}

/**
 * Whether `git push` failed because the branch has no upstream.
 * @param message - git stderr.
 */
export function isNoUpstreamPushFailure(message: string): boolean {
  return /no upstream|has no upstream|set-upstream/i.test(message)
}

function finishRemote(
  root: string,
  ran: { ok: true; stdout: string } | { ok: false; code: 'git-unavailable' | 'git-failed'; message: string },
): GitOpsResult<{ root: string }> {
  if (!ran.ok) return ran
  return { ok: true, value: { root } }
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
