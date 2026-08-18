/** WorkspaceRuntime projects the Workspace object manager for UI consumers. */

import type { Context } from '@deepseek-ai/cordis'
import type {
  DirectoryListing, FileListing, FileSearchResult, GitBranch, GitCommitResult, GitDiff, GitDiffSide, GitLogEntry,
  GitStatus, GitSyncMode,
  IApiClient, RpcError, SessionId, WorkspaceId, WorkspaceView,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { SnapshotStore } from '../contract/store.ts'
import { createSnapshotStore } from '../contract/store.ts'
import type { SessionsPort, SessionsPortList } from '../contract/sessions-port.ts'
import type { FileSearchOptions, IWorkspaces } from '../contract/workspaces.ts'
import { WorkspaceManager, type WorkspaceListPhase } from './manager.ts'

/** Workspace list plus the two-baseline readiness and default-target projection. */
export interface WorkspaceListState {
  items: readonly WorkspaceView[]
  /**
   * Registry-global archive set in Host order: grouping surfaces hide these
   * sessions everywhere (workspace groups and the ungrouped bucket) while
   * their session logs and workspace accounting slots remain. A plain array
   * (store-engine vocabulary; immer drafts reject Sets) — membership lookups
   * build their own transient Set.
   */
  archivedSessionIds: readonly SessionId[]
  state: 'idle' | 'loading' | 'error'
  phase: WorkspaceListPhase
  error: RpcError | null
  /** True only after both workspace.list and session.list have succeeded. */
  baselinesReady: boolean
  /** Most recently active Workspace, derived without changing `items` order. */
  recentWorkspaceId: WorkspaceId | undefined
}

/** Structured create failure for UI flows that distinguish Host business errors. */
export class WorkspaceCreateError extends Error {
  constructor(readonly rpcError: RpcError) {
    super(`workspace create failed: ${rpcError.code}: ${rpcError.message}`)
    this.name = 'WorkspaceCreateError'
  }
}

/** Structured browse failure so the directory browser can branch on Host business codes. */
export class DirectoryBrowseError extends Error {
  constructor(readonly rpcError: RpcError) {
    super(`directory browse failed: ${rpcError.code}: ${rpcError.message}`)
    this.name = 'DirectoryBrowseError'
  }
}

/** Decode a host.readFileBytes base64 payload in the browser (no Buffer). */
function decodeBase64Bytes(contentBase64: string): Uint8Array {
  const binary = atob(contentBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Structured file access failure so the editor can branch on Host business codes. */
export class FileAccessError extends Error {
  constructor(readonly rpcError: RpcError) {
    super(`file access failed: ${rpcError.code}: ${rpcError.message}`)
    this.name = 'FileAccessError'
  }
}

/** Structured git failure so the editor SCM panel can branch on Host business codes. */
export class GitAccessError extends Error {
  constructor(readonly rpcError: RpcError) {
    super(`git access failed: ${rpcError.code}: ${rpcError.message}`)
    this.name = 'GitAccessError'
  }
}

/** Structured search failure so the search panel can branch on Host business codes. */
export class SearchAccessError extends Error {
  constructor(readonly rpcError: RpcError) {
    super(`search failed: ${rpcError.code}: ${rpcError.message}`)
    this.name = 'SearchAccessError'
  }
}

/** Real Workspace object layer and Host actions. */
export class WorkspaceRuntime implements IWorkspaces {
  /** UI-facing immutable projection; the manager remains wire truth. */
  readonly list: SnapshotStore<WorkspaceListState>
  /** Workspace baseline and frame owner. */
  private readonly manager: WorkspaceManager
  /** In-flight blank-session creates keyed by workspace (connectWorkspace coalescing). */
  private readonly connecting = new Map<WorkspaceId, Promise<SessionId>>()
  /** Guards the runtime-owned one-shot initial-selection subscription. */
  private initialSelectionStarted = false

  /**
   * @param ctx - client root context.
   * @param api - shared wire client.
   * @param sessions - cross-domain sessions face used for recency and blank-session reuse.
   */
  constructor(ctx: Context, private readonly api: IApiClient, private readonly sessions: SessionsPort) {
    this.manager = new WorkspaceManager(api)
    this.list = createSnapshotStore<WorkspaceListState>({
      items: [], archivedSessionIds: [], state: 'idle', phase: 'pending', error: null,
      baselinesReady: false, recentWorkspaceId: undefined,
    })
    this.manager.subscribe(() => { this.project() })
    this.sessions.list.subscribe(() => { this.project() })
    ctx.reflect.provide('workspaces', this, undefined)
  }

  /**
   * Resolve the session a New Session flow lands in once this Workspace is
   * chosen: reuse the workspace's existing blank session when one is in the
   * list mirror, else create a fresh one on the host (`session.create` births
   * the full Session+Agent — the client holds no intermediate state). The
   * caller owns navigation: take the returned id to `sessions.open`.
   * Resolution guarantee (both arms): the returned id is already in the list
   * store and `sessions.binding(id)` resolves synchronously — draft hand-off
   * may write the new scope's machine before opening.
   * @param workspaceId - chosen Workspace (must be in the workspace list).
   * @returns the reused or newly created session id.
   */
  async connectWorkspace(workspaceId: WorkspaceId): Promise<SessionId> {
    const workspace = this.list.getSnapshot().items.find(item => item.workspaceId === workspaceId)
    if (workspace === undefined) throw new Error(`workspaces.connectWorkspace: unknown workspace ${workspaceId}`)
    // Coalesce concurrent connects: a create's summary lands without cwd
    // until the host frame arrives, so a second call inside that window
    // would miss the reuse scan and mint another hidden blank session.
    const inflight = this.connecting.get(workspaceId)
    if (inflight !== undefined) return inflight
    // Reuse requires workspace membership (id in sessionIds AND same
    // canonical cwd — the host's own membership rule), never cwd alone:
    // a cwd match can belong to no account (sessions the CLI/TUI birthed at
    // the host cwd, or a deleted/recreated registration) and reusing it
    // would open a session no grouping surface shows under this workspace.
    // An archived blank is never reused either: reuse would open a session
    // no grouping surface can show, so New Session mints a fresh one instead.
    const archived = this.list.getSnapshot().archivedSessionIds
    const sessions = this.sessions.list.getSnapshot()
    for (const id of sessions.ids) {
      const summary = sessions.byId[id]
      if (summary !== undefined && summary.blank && summary.cwd === workspace.path
        && workspace.sessionIds.includes(summary.id)
        && !archived.includes(summary.id)) return summary.id
    }
    const attempt = this.sessions.create({ workspaceId })
      .finally(() => { this.connecting.delete(workspaceId) })
    this.connecting.set(workspaceId, attempt)
    return attempt
  }

  /**
   * Follow the first complete Workspace/Session baseline and select a default
   * session exactly once. A restored current session wins; otherwise the most
   * recent Workspace is connected (reusing or creating its blank session).
   * Later explicit clears stay cleared instead of retriggering this startup
   * policy. A failed connect may retry on the next baseline projection.
   * @returns disposer for the baseline subscription; late work cannot navigate after disposal.
   */
  startInitialSelection(): () => void {
    if (this.initialSelectionStarted) {
      throw new Error('workspaces.startInitialSelection: already started')
    }
    this.initialSelectionStarted = true
    let state: 'waiting' | 'connecting' | 'done' = 'waiting'
    let disposed = false
    const reconcile = (): void => {
      if (disposed || state !== 'waiting') return
      const workspace = this.list.getSnapshot()
      if (!workspace.baselinesReady) return
      const current = this.sessions.list.getSnapshot().current
      const target = workspace.recentWorkspaceId
      if (current !== undefined || target === undefined) {
        state = 'done'
        return
      }
      state = 'connecting'
      void this.connectWorkspace(target).then(
        (sessionId) => {
          if (disposed) return
          if (this.sessions.list.getSnapshot().current === undefined) {
            this.sessions.open(sessionId)
          }
          state = 'done'
        },
        (reason: unknown) => {
          if (disposed) return
          state = 'waiting'
          console.warn('initial workspace selection failed:', reason)
        },
      )
    }
    const unsubscribe = this.list.subscribe(reconcile)
    reconcile()
    return () => {
      disposed = true
      unsubscribe()
    }
  }

  /**
   * The shared New Session action behind the shell entry points (sidebar
   * button, workspace browser): resolve the target Workspace — explicit wins,
   * then the current Session's Workspace, then the recent-Workspace
   * projection — connect its blank session and navigate there; with no
   * Workspace at all, clear the selection into the New Session view state.
   * Connect failures are non-fatal (console diagnostics; the current view
   * stays usable). Reusing the parked blank is a no-op when that blank is
   * already current; unless `preferExisting` is set, mint a fresh session
   * so the New Session button always produces a new conversation.
   * @param workspaceId - explicit target Workspace for scoped actions.
   * @param opts - `preferExisting` focuses a workspace without minting, and
   *   skips connect when the current session already belongs there.
   *   `forceNew` always mints a session on the target Workspace.
   */
  startSession(workspaceId?: WorkspaceId, opts?: { preferExisting?: boolean; forceNew?: boolean }): void {
    const workspace = this.list.getSnapshot()
    const current = this.sessions.list.getSnapshot().current
    const currentWorkspaceId = current === undefined
      ? undefined
      : workspace.items.find(item => item.sessionIds.includes(current))?.workspaceId
    const target = workspaceId ?? currentWorkspaceId ?? workspace.recentWorkspaceId
    if (target === undefined) {
      this.sessions.clear()
      return
    }
    if (opts?.forceNew === true) {
      void this.sessions.create({ workspaceId: target }).then(
        (fresh) => { this.sessions.open(fresh) },
        (reason: unknown) => { console.warn('new session failed:', reason) },
      )
      return
    }
    if (opts?.preferExisting === true && current !== undefined && currentWorkspaceId === target) {
      return
    }
    void this.connectWorkspace(target).then(
      async (sessionId) => {
        if (this.sessions.list.getSnapshot().current === sessionId && opts?.preferExisting !== true) {
          const fresh = await this.sessions.create({ workspaceId: target })
          this.sessions.open(fresh)
          return
        }
        this.sessions.open(sessionId)
      },
      (reason: unknown) => { console.warn('new session failed:', reason) },
    )
  }

  /**
   * Register an existing path as a Workspace, then start that Workspace
   * with preferExisting so Git and the composer follow the folder.
   * @param input - the Host create payload.
   * @returns the created or idempotently resolved Workspace.
   */
  async create(input: { path: string }): Promise<WorkspaceView> {
    const result = await this.manager.create(input)
    if (!result.ok) throw new WorkspaceCreateError(result.error)
    const created = result.value.workspace
    // A newly registered folder must land in its own conversation; otherwise
    // Git and the composer stay on the previous session's cwd.
    this.startSession(created.workspaceId, { preferExisting: true })
    return created
  }

  /**
   * Open the Host's native directory picker (the `native` capability).
   * @returns the selected path, or null when the user cancelled.
   */
  async pickDirectory(): Promise<string | null> {
    const response = await this.api.host.pickDirectory({})
    if (!response.result.ok) {
      throw new Error(`directory picker failed: ${response.result.error.message}`)
    }
    return response.result.value.path
  }

  /**
   * List one directory level through the Host's `browse` capability.
   * @param path - absolute directory to list; absent lists the Host home directory.
   * @param signal - aborts the wire request (and the Host's scan) when the caller supersedes it.
   * @returns the level's listing with breadcrumb ancestry.
   */
  async listDirectory(path?: string, signal?: AbortSignal): Promise<DirectoryListing> {
    const response = await this.api.host.listDirectory(path === undefined ? {} : { path }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Create one child directory through the Host's `browse` capability.
   * @param path - absolute existing parent directory.
   * @param name - single non-blank path segment.
   * @returns the created directory's absolute path.
   */
  async createDirectory(path: string, name: string): Promise<string> {
    const response = await this.api.host.createDirectory({ path, name })
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value.path
  }

  /**
   * Open a filesystem path with the Host operating system's default application.
   * @param path - absolute or host-resolvable path.
   */
  async openPath(path: string): Promise<void> {
    const response = await this.api.host.openPath({ path })
    if (!response.result.ok) {
      throw new Error(`path open failed: ${response.result.error.message}`)
    }
  }

  /**
   * List one directory level including files (the in-app editor's tree feed).
   * @param path - absolute directory to list.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the level's mixed file/directory listing.
   */
  async listEntries(path: string, signal?: AbortSignal): Promise<FileListing> {
    const response = await this.api.host.listEntries({ path }, signal)
    if (!response.result.ok) throw new FileAccessError(response.result.error)
    return response.result.value
  }

  /**
   * Read one UTF-8 text file from the Host.
   * @param path - absolute file path.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the file's whole text content.
   */
  async readFile(path: string, signal?: AbortSignal): Promise<string> {
    const response = await this.api.host.readFile({ path }, signal)
    if (!response.result.ok) throw new FileAccessError(response.result.error)
    return response.result.value.content
  }

  /**
   * Write one UTF-8 text file on the Host (whole-content replacement).
   * @param path - absolute file path (its parent directory must exist).
   * @param content - the full replacement text.
   */
  async writeFile(path: string, content: string): Promise<void> {
    const response = await this.api.host.writeFile({ path, content })
    if (!response.result.ok) throw new FileAccessError(response.result.error)
  }

  /**
   * Rename one file or directory in its parent.
   * @param path - absolute existing file or directory.
   * @param name - single destination path segment.
   * @returns the new absolute path.
   */
  async renameEntry(path: string, name: string): Promise<string> {
    const response = await this.api.host.renameEntry({ path, name })
    if (!response.result.ok) throw new FileAccessError(response.result.error)
    return response.result.value.path
  }

  /**
   * Delete one file or directory tree.
   * @param path - absolute existing file or directory.
   */
  async deleteEntry(path: string): Promise<void> {
    const response = await this.api.host.deleteEntry({ path })
    if (!response.result.ok) throw new FileAccessError(response.result.error)
  }

  /**
   * Read one file as bytes for in-column image preview.
   * @param path - absolute file path.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns raw bytes and a MIME guess from the path.
   */
  async readFileBytes(
    path: string,
    signal?: AbortSignal,
  ): Promise<{ bytes: Uint8Array; mimeType: string }> {
    const response = await this.api.host.readFileBytes({ path }, signal)
    if (!response.result.ok) throw new FileAccessError(response.result.error)
    return {
      bytes: decodeBase64Bytes(response.result.value.contentBase64),
      mimeType: response.result.value.mimeType,
    }
  }

  /**
   * Workspace-wide text search (the workbench search panel).
   * @param path - absolute directory to search.
   * @param query - pattern text.
   * @param options - match flags, glob filters, and the match cap.
   * @param signal - aborts the wire request (and the host's ripgrep child).
   * @returns the bounded search result.
   */
  async search(
    path: string,
    query: string,
    options?: FileSearchOptions,
    signal?: AbortSignal,
  ): Promise<FileSearchResult> {
    const response = await this.api.host.search({
      path,
      query,
      ...options?.regex === undefined ? {} : { regex: options.regex },
      ...options?.caseSensitive === undefined ? {} : { caseSensitive: options.caseSensitive },
      ...options?.wholeWord === undefined ? {} : { wholeWord: options.wholeWord },
      ...options?.include === undefined ? {} : { include: options.include },
      ...options?.exclude === undefined ? {} : { exclude: options.exclude },
      ...options?.limit === undefined ? {} : { limit: options.limit },
    }, signal)
    if (!response.result.ok) throw new SearchAccessError(response.result.error)
    return response.result.value
  }

  /**
   * Read git status for the repository containing `path`.
   * @param path - absolute workspace path or any file inside it.
   * @param signal - aborts the wire request when the caller supersedes it.
   */
  async gitStatus(path: string, signal?: AbortSignal): Promise<GitStatus> {
    const response = await this.api.host.gitStatus({ path }, signal)
    if (!response.result.ok) throw new GitAccessError(response.result.error)
    return response.result.value
  }

  /**
   * Unified diff for one path (or the whole tree).
   * @param path - absolute workspace path or any file inside it.
   * @param side - `worktree` or `staged`.
   * @param file - optional repository-relative path.
   * @param signal - aborts the wire request.
   * @returns the unified diff snapshot.
   */
  async gitDiff(path: string, side: GitDiffSide, file?: string, signal?: AbortSignal): Promise<GitDiff> {
    const response = await this.api.host.gitDiff(
      file === undefined ? { path, side } : { path, side, file },
      signal,
    )
    if (!response.result.ok) throw new GitAccessError(response.result.error)
    return response.result.value
  }

  /**
   * Unified diff for one commit.
   * @param path - absolute workspace path or any file inside it.
   * @param commit - commit hash (7–40 hex).
   * @param signal - aborts the wire request.
   * @returns the unified diff snapshot.
   */
  async gitCommitDiff(path: string, commit: string, signal?: AbortSignal): Promise<GitDiff> {
    const response = await this.api.host.gitDiff({ path, side: 'worktree', commit }, signal)
    if (!response.result.ok) throw new GitAccessError(response.result.error)
    return response.result.value
  }

  /**
   * Stage repository-relative paths.
   * @param path - absolute workspace path or any file inside it.
   * @param files - repository-relative paths.
   * @param signal - aborts the wire request.
   */
  async gitStage(path: string, files: readonly string[], signal?: AbortSignal): Promise<void> {
    const response = await this.api.host.gitStage({ path, files: [...files] }, signal)
    if (!response.result.ok) throw new GitAccessError(response.result.error)
  }

  /**
   * Unstage repository-relative paths.
   * @param path - absolute workspace path or any file inside it.
   * @param files - repository-relative paths.
   * @param signal - aborts the wire request.
   */
  async gitUnstage(path: string, files: readonly string[], signal?: AbortSignal): Promise<void> {
    const response = await this.api.host.gitUnstage({ path, files: [...files] }, signal)
    if (!response.result.ok) throw new GitAccessError(response.result.error)
  }

  /**
   * Commit staged changes without writing git identity.
   * @param path - absolute workspace path or any file inside it.
   * @param message - commit message.
   * @param signal - aborts the wire request.
   * @returns the new HEAD hash.
   */
  async gitCommit(path: string, message: string, signal?: AbortSignal): Promise<GitCommitResult> {
    const response = await this.api.host.gitCommit({ path, message }, signal)
    if (!response.result.ok) throw new GitAccessError(response.result.error)
    return response.result.value
  }

  /**
   * Discard worktree changes for the given paths.
   * @param path - absolute workspace path or any file inside it.
   * @param files - repository-relative paths.
   * @param signal - aborts the wire request.
   */
  async gitDiscard(path: string, files: readonly string[], signal?: AbortSignal): Promise<void> {
    const response = await this.api.host.gitDiscard({ path, files: [...files] }, signal)
    if (!response.result.ok) throw new GitAccessError(response.result.error)
  }

  /**
   * Recent commits.
   * @param path - absolute workspace path or any file inside it.
   * @param limit - max rows.
   * @param signal - aborts the wire request.
   * @param skip - older-page offset (`git log --skip`).
   * @returns log rows newest first.
   */
  async gitLog(
    path: string,
    limit?: number,
    signal?: AbortSignal,
    skip?: number,
  ): Promise<GitLogEntry[]> {
    const response = await this.api.host.gitLog(
      {
        path,
        ...(limit === undefined ? {} : { limit }),
        ...(skip === undefined || skip <= 0 ? {} : { skip }),
      },
      signal,
    )
    if (!response.result.ok) throw new GitAccessError(response.result.error)
    return response.result.value
  }

  /**
   * User-initiated fetch / ff-only pull / push.
   * @param path - absolute workspace path or any file inside it.
   * @param mode - remote verb.
   * @param signal - aborts the wire request.
   */
  async gitSync(path: string, mode: GitSyncMode, signal?: AbortSignal): Promise<void> {
    const response = await this.api.host.gitSync({ path, mode }, signal)
    if (!response.result.ok) throw new GitAccessError(response.result.error)
  }

  /**
   * Local and remote-tracking branches for the SCM picker.
   * @param path - absolute workspace path or any file inside it.
   * @param signal - aborts the wire request.
   * @returns branch rows.
   */
  async gitBranches(path: string, signal?: AbortSignal): Promise<GitBranch[]> {
    const response = await this.api.host.gitBranches({ path }, signal)
    if (!response.result.ok) throw new GitAccessError(response.result.error)
    return response.result.value.branches
  }

  /**
   * Switch or create a local branch.
   * @param path - absolute workspace path or any file inside it.
   * @param name - branch name.
   * @param create - when true, create the branch.
   * @param signal - aborts the wire request.
   */
  async gitCheckout(path: string, name: string, create?: boolean, signal?: AbortSignal): Promise<void> {
    const response = await this.api.host.gitCheckout(
      create === true ? { path, name, create: true } : { path, name },
      signal,
    )
    if (!response.result.ok) throw new GitAccessError(response.result.error)
  }

  /**
   * Detach HEAD at a commit.
   * @param path - absolute workspace path or any file inside it.
   * @param hash - commit hash.
   * @param signal - aborts the wire request.
   */
  async gitCheckoutCommit(path: string, hash: string, signal?: AbortSignal): Promise<void> {
    const response = await this.api.host.gitCheckout({ path, name: hash, detach: true }, signal)
    if (!response.result.ok) throw new GitAccessError(response.result.error)
  }

  /**
   * Ask the session model for a commit message from the staged diff.
   * @param path - absolute workspace path or any file inside it.
   * @param sessionId - session that owns the model route and the log record.
   * @param signal - aborts the wire request.
   */
  async gitSuggestCommit(
    path: string,
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<{ message: string }> {
    const response = await this.api.host.gitSuggestCommit({ path, sessionId }, signal)
    if (!response.result.ok) throw new GitAccessError(response.result.error)
    return response.result.value
  }

  /**
   * Rename a Workspace.
   * @param workspaceId - target workspace.
   * @param title - new display title (trimmed non-empty by the Host).
   * @returns the renamed Workspace view.
   */
  async rename(workspaceId: WorkspaceId, title: string): Promise<WorkspaceView> {
    const result = await this.manager.rename(workspaceId, title)
    if (!result.ok) throw new Error(`workspace rename failed: ${result.error.code}: ${result.error.message}`)
    return result.value.workspace
  }

  /**
   * Delete one Workspace registration. Sessions, session logs, and the
   * directory remain Host-owned outside this operation.
   * @param workspaceId - target workspace.
   */
  async delete(workspaceId: WorkspaceId): Promise<void> {
    const result = await this.manager.delete(workspaceId)
    if (!result.ok) throw new Error(`workspace delete failed: ${result.error.code}: ${result.error.message}`)
  }

  /**
   * Move a Workspace within the durable registry display order.
   * @param workspaceId - Workspace to move.
   * @param beforeWorkspaceId - Anchor workspace; omitted appends.
   */
  async insertBefore(workspaceId: WorkspaceId, beforeWorkspaceId?: WorkspaceId): Promise<void> {
    const result = await this.manager.insertBefore(workspaceId, beforeWorkspaceId)
    if (!result.ok) throw new Error(`workspace reorder failed: ${result.error.code}: ${result.error.message}`)
  }

  /**
   * Archive a session into the registry-global set. Clearing an archived
   * current selection is the projection sweep's job (one rule for the local
   * echo and a remote tab's frame alike).
   * @param sessionId - session to archive.
   */
  async archiveSession(sessionId: SessionId): Promise<void> {
    const result = await this.manager.archiveSession(sessionId)
    if (!result.ok) throw new Error(`session archive failed: ${result.error.code}: ${result.error.message}`)
  }

  /**
   * Move a session within its Workspace's manual order (DOM-insertBefore-like).
   * @param workspaceId - owning workspace.
   * @param sessionId - accounted session to move.
   * @param beforeSessionId - accounted anchor to insert before; omitted appends.
   * @returns the updated Workspace view.
   */
  async insertSessionBefore(
    workspaceId: WorkspaceId,
    sessionId: SessionId,
    beforeSessionId?: SessionId,
  ): Promise<WorkspaceView> {
    const result = await this.manager.insertSessionBefore(workspaceId, sessionId, beforeSessionId)
    if (!result.ok) throw new Error(`workspace move failed: ${result.error.code}: ${result.error.message}`)
    return result.value.workspace
  }

  /**
   * Refresh the workspace baseline, reusing an in-flight pull.
   * @returns completion of the current or newly started workspace baseline pull.
   */
  refresh(): Promise<void> {
    return this.manager.refresh()
  }

  /**
   * Route a Host stream envelope into the Workspace object layer.
   * @param envelope - validated Host stream envelope.
   */
  handleHostEnvelope(envelope: Parameters<WorkspaceManager['handleHostEnvelope']>[0]): void {
    this.manager.handleHostEnvelope(envelope)
  }

  /** Rebuild the Workspace baseline after connection. */
  handleConnected(): void {
    this.manager.handleConnected()
  }

  private project(): void {
    const workspace = this.manager.getSnapshot()
    const sessions = this.sessions.list.getSnapshot()
    const baselinesReady = workspace.phase === 'ready' && sessions.phase === 'ready'
    // An archived current selection clears into the New Session view state —
    // a hidden row must not stay open behind the list. Sweeping here covers
    // every install path with one rule: the local unary echo, another tab's
    // changed frame, and a reconnect baseline restoring a persisted
    // selection that was archived while this client was away.
    if (sessions.current !== undefined && workspace.archivedSessionIds.includes(sessions.current)) {
      this.sessions.clear()
    }
    this.list.set({
      items: workspace.items,
      archivedSessionIds: workspace.archivedSessionIds,
      state: workspace.state,
      phase: workspace.phase,
      error: workspace.error,
      baselinesReady,
      recentWorkspaceId: baselinesReady ? recentWorkspace(workspace.items, sessions.byId) : undefined,
    })
  }
}

/** Stable tie-breaking follows Host Workspace order. */
function recentWorkspace(
  workspaces: readonly WorkspaceView[],
  sessions: SessionsPortList['byId'],
): WorkspaceId | undefined {
  let selected: WorkspaceId | undefined
  let selectedTime = Number.NEGATIVE_INFINITY
  for (const workspace of workspaces) {
    let latest = Number.NEGATIVE_INFINITY
    for (const sessionId of workspace.sessionIds) {
      const session = sessions[sessionId]
      if (session !== undefined) latest = Math.max(latest, session.updatedAt)
    }
    if (latest === Number.NEGATIVE_INFINITY) latest = Date.parse(workspace.createdAt)
    if (selected === undefined || latest > selectedTime) {
      selected = workspace.workspaceId
      selectedTime = latest
    }
  }
  return selected
}
