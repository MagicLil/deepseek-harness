/**
 * host domain contract. No protocol version: client and host ship
 * together; introduce protocolVersion only when an independently released client appears.
 */

import type { RpcRequest, RpcResponse } from './rpc.ts'

/** One directory row of a listing: a child entry or a breadcrumb ancestor. */
export interface DirectoryEntry {
  /** Base name shown in a browser row (a root crumb carries its full path). */
  name: string
  /** Absolute host path — the client never joins path segments itself. */
  path: string
  /** Hidden by the host platform's convention (dot-prefixed on POSIX); the client owns whether to show it. */
  hidden: boolean
}

/** host.listDirectory response value: one directory level plus its ancestry. */
export interface DirectoryListing {
  /** Absolute path of the listed directory. */
  path: string
  /** The host account's home directory (breadcrumb "Home" rooting). */
  home: string
  /**
   * Ancestor chain from the filesystem root to the listed directory
   * inclusive; every crumb is a jump target (crumb `hidden` is always false).
   */
  crumbs: DirectoryEntry[]
  /** Direct child directories, name-sorted; symlinks to directories included. */
  entries: DirectoryEntry[]
  /** True when the backend cut `entries` at its complete-result bound (the name-sorted tail is absent). */
  truncated: boolean
}

/** One row of a host.listEntries listing: a direct child file or directory. */
export interface FileEntry {
  /** Base name shown in a tree row. */
  name: string
  /** Absolute host path — the client never joins path segments itself. */
  path: string
  /** Entry kind (symlinks report their target's kind; broken links are files). */
  kind: 'file' | 'directory'
  /** Hidden by the host platform's convention (dot-prefixed); the client owns whether to dim it. */
  hidden: boolean
}

/** host.listEntries response value: one directory level, files included. */
export interface FileListing {
  /** Absolute path of the listed directory. */
  path: string
  /** Direct children, directories first then files, name-sorted within each group. */
  entries: FileEntry[]
  /** True when the backend cut `entries` at its complete-result bound. */
  truncated: boolean
}

/** One highlight range inside a matched line (UTF-16 code units, `[start, end)`). */
export interface FileSearchSpan {
  /** Range start (inclusive). */
  start: number
  /** Range end (exclusive). */
  end: number
}

/** One matched line served by host.search. */
export interface FileSearchHit {
  /** Absolute file path — the client relativizes for display. */
  path: string
  /** 1-based line number. */
  line: number
  /** Matched line text (trailing newline stripped, bounded per line). */
  text: string
  /** Match ranges inside `text`; empty when the line is not valid UTF-8. */
  spans: FileSearchSpan[]
}

/** host.search response: one bounded workspace-wide text search. */
export interface FileSearchResult {
  /** Searched directory (echo of the request path). */
  root: string
  /** Matched lines in ripgrep output order (one file's hits stay contiguous). */
  hits: FileSearchHit[]
  /** Distinct files across `hits`. */
  fileCount: number
  /** True when the match cap or the search time budget cut the result. */
  truncated: boolean
}

/** One working-tree change reported by host.gitStatus (Cursor/VS Code SCM row). */
export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed' | 'conflict'

/** Which side of `git status` a change row belongs to (Cursor SCM sections). */
export type GitChangeArea = 'index' | 'worktree'

/** One changed path relative to the repository root (git's `/` separators). */
export interface GitChange {
  /** Repository-relative path using `/`. */
  path: string
  /** Collapsed porcelain status the editor tree and SCM list render. */
  status: GitFileStatus
  /**
   * `index` = staged (Cursor「暂存的更改」); `worktree` = unstaged / untracked
   * (「更改」). A dirty file can appear once in each area (`MM`).
   */
  area: GitChangeArea
}

/** Which tree a workbench diff compares. */
export type GitDiffSide = 'worktree' | 'staged'

/** host.gitDiff response: unified text for one path or the whole tree. */
export interface GitDiff {
  /** Absolute repository root. */
  root: string
  /** Compared side. */
  side: GitDiffSide
  /** Repository-relative path, or undefined for the whole tree. */
  path?: string
  /** Unified diff text (empty when the side is clean). */
  text: string
}

/** One `git log` row. */
export interface GitLogEntry {
  /** Full commit hash. */
  hash: string
  /** First line of the commit message. */
  subject: string
  /** Author name from the commit (not a configured identity write). */
  author: string
  /** Author timestamp as unix seconds. */
  timestamp: number
  /** Parent hashes (`git log %P`). Omitted when the commit has none. */
  parents?: string[]
  /** Refs that currently point at this commit. Omitted when none do. */
  refs?: GitRef[]
  /** Remainder of the commit message after the subject. Omitted when empty. */
  body?: string
  /** Paths touched by the first-parent patch (`git log --shortstat`). */
  files?: number
  /** Lines added in that patch. */
  insertions?: number
  /** Lines removed in that patch. */
  deletions?: number
  /** `origin` remote URL, copied onto every row when one exists. */
  originUrl?: string
}

/** Kind of a decorated git ref on a log row. */
export type GitRefKind = 'head' | 'branch' | 'remote' | 'tag'

/** One branch, remote, tag, or HEAD pointer on a commit. */
export interface GitRef {
  /** Ref class. */
  kind: GitRefKind
  /** Short name (`main`, `origin/main`, `v1.0`, `HEAD`). */
  name: string
}

/** host.gitCommit response. */
export interface GitCommitResult {
  /** Absolute repository root. */
  root: string
  /** New HEAD hash. */
  hash: string
}

/** User-clicked remote verb. Never exposed as an agent tool. */
export type GitSyncMode = 'fetch' | 'pull' | 'push'

/** One local or remote-tracking branch from `git for-each-ref`. */
export interface GitBranch {
  /** Short ref name (`main`, or `origin/main` when `remote` is true). */
  name: string
  /** True when this ref is HEAD. */
  current: boolean
  /** Upstream short name when configured. */
  upstream?: string
  /** True for `refs/remotes/*` (absent means a local `refs/heads/*` row). */
  remote?: boolean
}

/** Signals the UI PTY bridge may deliver to the foreground group. */
export type TerminalWireSignal = 'SIGINT' | 'SIGTERM' | 'SIGKILL' | 'SIGTSTP' | 'SIGHUP'

/** Why one line-oriented send returned control. */
export type TerminalWaitReason = 'stdin_read' | 'inferred_idle' | 'timeout' | 'session_exit'

/** Top-level PTY status on the wire (JSON-safe). */
export type TerminalSessionStatusWire =
  | { kind: 'running' }
  | { kind: 'exited'; exitCode: number | null; signal: string | null }

/** One listed UI PTY. */
export interface TerminalListRow {
  /** Host-minted PTY id (`pty-N`). */
  id: string
  /** Optional owner-local display name. */
  name?: string
  /** Current top-level process status. */
  status: TerminalSessionStatusWire
}

/** host.terminalList response. */
export interface TerminalList {
  /** False when `ctx.terminals` is not mounted. */
  available: boolean
  /** PTYs owned by the session agent. */
  sessions: TerminalListRow[]
}

/** host.terminalOpen response. */
export interface TerminalOpenResult {
  /** Host-minted PTY id. */
  id: string
  /** Optional owner-local display name. */
  name?: string
  /** Initial bounded output captured before publication. */
  motd: string
  /** Status at publication. */
  status: TerminalSessionStatusWire
}

/** host.terminalSend response. */
export interface TerminalSendResult {
  /** Bounded rendered delta remaining at settlement. */
  viewport: string
  /** Why the wait returned. */
  waitReason: TerminalWaitReason
  /** Whether output was dropped from the operation or retained scrollback. */
  truncated: boolean
  /** Status at settlement. */
  status: TerminalSessionStatusWire
}

/** host.terminalRead response. */
export interface TerminalReadResult {
  /** Retained scrollback in chronological order. */
  text: string
}

/** host.gitStatus response: branch + working-tree changes for one workspace. */
export interface GitStatus {
  /** Absolute path of the repository root (`git rev-parse --show-toplevel`). */
  root: string
  /** Current branch name, or `HEAD` when detached. */
  branch: string
  /** Commits ahead of the upstream (0 when no upstream). */
  ahead: number
  /** Commits behind the upstream (0 when no upstream). */
  behind: number
  /** True when HEAD is detached. */
  detached: boolean
  /** Changed / untracked / conflicted paths (clean files omitted). */
  changes: GitChange[]
}

/** Host-level unary methods. */
export interface HostApi {
  /**
   * One-shot host snapshot. Empty payload uses the literal `{}` (extend in place when fields arrive).
   * version = the host app's (apps/cli) package.json version; cwd = the host process working
   * directory (root for session persistence and tool execution); provider/model = the defaults
   * applied when a new agent doesn't specify them explicitly, absent when the host configures
   * no explicit default (the adapter falls back internally);
   * attachedSessions = count of currently attached sessions (those with a live agent);
   * canOpenPath = whether this deployment can hand a path to a user-visible native desktop.
   */
  describe(request: RpcRequest<{}>): Promise<RpcResponse<{
    version: string
    cwd: string
    provider?: string
    model?: string
    attachedSessions: number
    canOpenPath: boolean
  }>>

  /**
   * Open the operating system's single-directory picker; cancellation returns
   * null. Only served under the `native` capability.
   */
  pickDirectory(
    request: RpcRequest<{}>,
    signal: AbortSignal,
  ): Promise<RpcResponse<{ path: string | null }>>

  /**
   * List one directory level for the in-app browser; an absent path lists the
   * host account's home directory. Only served under the `browse` capability;
   * unreadable or missing targets fail with `directory-unreadable`. The
   * carrier's request signal follows the caller, stopping the backend's scan
   * on disconnect or timeout.
   */
  listDirectory(
    request: RpcRequest<{ path?: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<DirectoryListing>>

  /**
   * Create one child directory under an existing parent (the browser's
   * "New folder"). Only served under the `browse` capability; an existing
   * child fails with `directory-exists`, every other filesystem failure with
   * `directory-create-failed`.
   */
  createDirectory(
    request: RpcRequest<{ path: string; name: string }>,
  ): Promise<RpcResponse<{ path: string }>>

  /**
   * Open a filesystem path with the operating system's default application
   * (Finder / Explorer / xdg-open hand-off). The browser carrier's
   * prefix-wide trust fence covers this privileged method like every other
   * `/api` request.
   */
  openPath(
    request: RpcRequest<{ path: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<{ opened: true }>>

  /**
   * List one directory level including files (the in-app editor's tree).
   * Unlike `listDirectory` (workspace picker, directories only), this serves
   * mixed entries with a kind discriminant. Unreadable or missing targets
   * fail with `directory-unreadable`. The browser carrier's prefix-wide
   * trust fence covers this method like every other `/api` request.
   */
  listEntries(
    request: RpcRequest<{ path: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<FileListing>>

  /**
   * Read one UTF-8 text file for the in-app editor. Missing/unreadable
   * targets fail with `file-unreadable`, files past the editor byte bound
   * with `file-too-large`, and NUL-bearing content with `file-binary`.
   */
  readFile(
    request: RpcRequest<{ path: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<{ path: string; content: string }>>

  /**
   * Write one UTF-8 text file for the in-app editor (whole-content
   * replacement; the parent directory must exist). Filesystem failures
   * report `file-write-failed`. Last write wins — the editor owns any
   * concurrent-edit presentation.
   */
  writeFile(
    request: RpcRequest<{ path: string; content: string }>,
  ): Promise<RpcResponse<{ path: string }>>

  /**
   * Workspace-wide text search for the workbench search panel, backed by
   * the packaged ripgrep binary (`@vscode/ripgrep` — the same binary the
   * agent's grep tool spawns). Plain-text match by default; `regex` opts
   * into ripgrep regex syntax. Ignore files (.gitignore) are honored.
   * Matches are capped by `limit` (host bound 2000) and a fixed time
   * budget; a cut result reports `truncated` instead of failing. A pattern
   * or glob ripgrep rejects fails with `search-invalid`; a missing binary
   * with `search-unavailable`; other failures with `search-failed`.
   * UI-only — never an agent tool.
   */
  search(
    request: RpcRequest<{
      path: string
      query: string
      regex?: boolean
      caseSensitive?: boolean
      wholeWord?: boolean
      include?: string
      exclude?: string
      limit?: number
    }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<FileSearchResult>>

  /**
   * Read `git status` for the repository containing `path` (the in-app
   * editor's SCM panel). Missing git, or a path outside any work tree,
   * fails with `git-unavailable`; other git failures report `git-failed`.
   */
  gitStatus(
    request: RpcRequest<{ path: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitStatus>>

  /**
   * Unified diff for one path (or the whole tree). `side: worktree` is
   * unstaged (`git diff`); `side: staged` is the index (`git diff --cached`).
   * When `commit` is set, the host returns that commit's first-parent
   * patch and ignores `side`.
   */
  gitDiff(
    request: RpcRequest<{ path: string; side: GitDiffSide; file?: string; commit?: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitDiff>>

  /**
   * `git add` the given repository-relative paths. Never sets identity.
   */
  gitStage(
    request: RpcRequest<{ path: string; files: string[] }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<{ root: string }>>

  /**
   * `git restore --staged` the given repository-relative paths.
   */
  gitUnstage(
    request: RpcRequest<{ path: string; files: string[] }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<{ root: string }>>

  /**
   * `git commit --no-gpg-sign -m`. Never writes `user.name` / `user.email`.
   */
  gitCommit(
    request: RpcRequest<{ path: string; message: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitCommitResult>>

  /**
   * Discard worktree changes for the given paths (restore tracked, clean untracked).
   */
  gitDiscard(
    request: RpcRequest<{ path: string; files: string[] }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<{ root: string }>>

  /**
   * Recent commits (`git log -n`). `limit` defaults to 20 and is capped at 100.
   * `skip` pages older rows (`git log --skip`).
   */
  gitLog(
    request: RpcRequest<{ path: string; limit?: number; skip?: number }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitLogEntry[]>>

  /**
   * User-initiated remote sync. `fetch` updates remotes; `pull` is
   * `--ff-only` only; `push` publishes the current branch (first push may
   * set `origin` upstream). Never force-pushes and never writes identity.
   */
  gitSync(
    request: RpcRequest<{ path: string; mode: GitSyncMode }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<{ root: string }>>

  /**
   * Local and remote-tracking branches for the SCM branch picker.
   */
  gitBranches(
    request: RpcRequest<{ path: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<{ root: string; branches: GitBranch[] }>>

  /**
   * `git switch` / `git switch -c` / `git switch --detach`. `name` is
   * schema-validated. `detach` checks out a commit hash and leaves HEAD
   * detached. Never an agent tool.
   */
  gitCheckout(
    request: RpcRequest<{ path: string; name: string; create?: boolean; detach?: boolean }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<{ root: string; name: string }>>

  /**
   * Write a commit message from the staged diff via an auxiliary model
   * call. The exact prompt is appended as `session/git-commit-llm-request`
   * before dispatch. Never an agent tool.
   */
  gitSuggestCommit(
    request: RpcRequest<{ path: string; sessionId: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<{ message: string }>>

  /**
   * List UI PTYs owned by the session agent. `available` is false when
   * `ctx.terminals` is not mounted.
   */
  terminalList(
    request: RpcRequest<{ sessionId: string }>,
  ): Promise<RpcResponse<TerminalList>>

  /**
   * Spawn one UI PTY for the session agent (quota 3).
   */
  terminalOpen(
    request: RpcRequest<{ sessionId: string; name?: string; cwd?: string; cols?: number; rows?: number }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<TerminalOpenResult>>

  /**
   * Send one exclusive line-oriented write and wait for idle.
   */
  terminalSend(
    request: RpcRequest<{ sessionId: string; id: string; text: string; submit: boolean }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<TerminalSendResult>>

  /**
   * Fire-and-forget stdin write for xterm keystrokes (no exclusive idle wait).
   */
  terminalWrite(
    request: RpcRequest<{ sessionId: string; id: string; data: string }>,
  ): Promise<RpcResponse<{ written: true }>>

  /**
   * Change PTY winsize to match the xterm FitAddon size.
   */
  terminalResize(
    request: RpcRequest<{ sessionId: string; id: string; cols: number; rows: number }>,
  ): Promise<RpcResponse<{ resized: true }>>

  /**
   * Read retained scrollback for reconnect replay.
   */
  terminalRead(
    request: RpcRequest<{ sessionId: string; id: string }>,
  ): Promise<RpcResponse<TerminalReadResult>>

  /**
   * Deliver an allowed signal to the foreground group.
   */
  terminalSignal(
    request: RpcRequest<{ sessionId: string; id: string; signal: TerminalWireSignal }>,
  ): Promise<RpcResponse<{ delivered: boolean }>>

  /**
   * Close one UI PTY.
   */
  terminalKill(
    request: RpcRequest<{ sessionId: string; id: string }>,
  ): Promise<RpcResponse<{ closed: boolean }>>
}
