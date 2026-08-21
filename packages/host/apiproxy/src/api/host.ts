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

/** One working-tree change reported by host.gitStatus (Cursor/VS Code SCM row). */
export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed' | 'conflict'

/** One changed path relative to the repository root (git's `/` separators). */
export interface GitChange {
  /** Repository-relative path using `/`. */
  path: string
  /** Collapsed porcelain status the editor tree and SCM list render. */
  status: GitFileStatus
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
   * home = the host account home directory (Web display abbreviation on POSIX);
   * canOpenPath = whether this deployment can hand a path to a user-visible native desktop.
   */
  describe(request: RpcRequest<{}>): Promise<RpcResponse<{
    version: string
    cwd: string
    provider?: string
    model?: string
    attachedSessions: number
    home: string
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
   * Read `git status` for the repository containing `path` (the in-app
   * editor's SCM panel). Missing git, or a path outside any work tree,
   * fails with `git-unavailable`; other git failures report `git-failed`.
   */
  gitStatus(
    request: RpcRequest<{ path: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitStatus>>
}
