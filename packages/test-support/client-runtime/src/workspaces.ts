/** Test-owned workspaces face: the renderer standard-kit observable plus recorded actions. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  DirectoryListing, FileListing, GitBranch, GitCommitResult, GitDiff, GitDiffSide, GitLogEntry,
  GitStatus, GitSyncMode,
  IWorkspaces, SessionId, SnapshotStore, WorkspaceId, WorkspaceListState, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { workspaceListState } from './fixtures.ts'
import type { Stabilizer } from './fixtures.ts'

/**
 * Workspaces test double. Implements the same IWorkspaces face features
 * receive as `ctx.workspaces`, so a production face change breaks this
 * double at compile time. Every action records into {@link
 * TestWorkspaces.calls}; defaults are inert echoes — feature tests needing
 * richer behavior replace them via {@link TestWorkspaces.stub}.
 */
export class TestWorkspaces implements IWorkspaces {
  /** The useWorkspaces standard feed. */
  readonly list: SnapshotStore<WorkspaceListState>

  /** Calls observed on the action face, newest last. */
  readonly calls: { method: string; args: unknown[] }[] = []

  /** Replaceable action seat: feature tests may stub richer behavior. */
  private readonly stubs = new Map<string, (...args: unknown[]) => unknown>()

  /**
   * @param stabilize - the owning runtime's act wrapper.
   */
  constructor(private readonly stabilize: Stabilizer) {
    this.list = createSnapshotStore<WorkspaceListState>(workspaceListState())
  }

  /**
   * Update the workspace list state through an immer draft.
   * @param mutate - draft mutator.
   */
  async update(mutate: (draft: WorkspaceListState) => void): Promise<void> {
    await this.stabilize(() => { this.list.update(mutate) })
  }

  /**
   * Replace an action's behavior (the recorded call is still appended first).
   * @param method - action name (e.g. 'connectWorkspace').
   * @param impl - replacement behavior.
   */
  stub(method: string, impl: (...args: unknown[]) => unknown): void {
    this.stubs.set(method, impl)
  }

  /**
   * Connect a workspace to its reusable/new blank session (recorded). The
   * default resolves the workspace id back as the session id; stub for
   * cross-session flows.
   * @param workspaceId - target workspace.
   * @returns the connected session id.
   */
  async connectWorkspace(workspaceId: WorkspaceId): Promise<SessionId> {
    this.calls.push({ method: 'connectWorkspace', args: [workspaceId] })
    const stub = this.stubs.get('connectWorkspace')
    if (stub !== undefined) return await (stub(workspaceId) as Promise<SessionId>)
    return `session-of-${workspaceId}` as SessionId
  }

  /**
   * New-session flow (recorded; stubbed behavior runs when installed).
   * @param workspaceId - optional explicit workspace target.
   * @param opts - optional New Session flags (`preferExisting` focuses without minting).
   */
  startSession(workspaceId?: WorkspaceId, opts?: { preferExisting?: boolean; forceNew?: boolean }): void {
    this.calls.push({
      method: 'startSession',
      args: opts === undefined ? [workspaceId] : [workspaceId, opts],
    })
    this.stubs.get('startSession')?.(workspaceId, opts)
  }

  /**
   * Create a Workspace (recorded). The default echoes a view derived from
   * the input; stub for failure or list-coupled flows.
   * @param input - the Host create payload.
   * @returns the created Workspace view.
   */
  async create(input: { path: string }): Promise<WorkspaceView> {
    this.calls.push({ method: 'create', args: [input] })
    const stub = this.stubs.get('create')
    if (stub !== undefined) return await (stub(input) as Promise<WorkspaceView>)
    return {
      workspaceId: `ws-${input.path}` as WorkspaceId,
      title: input.path,
      path: input.path,
      sessionIds: [],
    } as unknown as WorkspaceView
  }

  /**
   * Open a path with the host OS default application (recorded; default no-op).
   * @param path - host-resolvable path.
   */
  async openPath(path: string): Promise<void> {
    this.calls.push({ method: 'openPath', args: [path] })
    await (this.stubs.get('openPath')?.(path) as Promise<void> | undefined)
  }

  /**
   * Directory picker (recorded). The default cancels (null); stub to select.
   * @returns the picked path, or null.
   */
  async pickDirectory(): Promise<string | null> {
    this.calls.push({ method: 'pickDirectory', args: [] })
    const stub = this.stubs.get('pickDirectory')
    if (stub !== undefined) return await (stub() as Promise<string | null>)
    return null
  }

  /**
   * Browse listing (recorded). The default serves an empty home level; stub
   * to shape a tree.
   * @param path - absolute directory to list; absent lists the home level.
   * @returns the level's listing.
   */
  async listDirectory(path?: string, signal?: AbortSignal): Promise<DirectoryListing> {
    // The signal is recorded and forwarded like the production face passes
    // it to the wire, so cancellation integration tests can observe or
    // reject on a superseded scan.
    this.calls.push({ method: 'listDirectory', args: [path, signal] })
    const stub = this.stubs.get('listDirectory')
    if (stub !== undefined) return await (stub(path, signal) as Promise<DirectoryListing>)
    // The chain runs root-to-target inclusive, per the DirectoryListing
    // contract — a bare root crumb would mislabel the level in browsers
    // driven by this double.
    return {
      path: '/home/test',
      home: '/home/test',
      crumbs: [
        { name: '/', path: '/', hidden: false },
        { name: 'home', path: '/home', hidden: false },
        { name: 'test', path: '/home/test', hidden: false },
      ],
      entries: [],
      truncated: false,
    }
  }

  /**
   * Browse child creation (recorded). The default joins parent and name.
   * @param path - absolute existing parent directory.
   * @param name - single path segment.
   * @returns the created directory's absolute path.
   */
  async createDirectory(path: string, name: string): Promise<string> {
    this.calls.push({ method: 'createDirectory', args: [path, name] })
    const stub = this.stubs.get('createDirectory')
    if (stub !== undefined) return await (stub(path, name) as Promise<string>)
    return `${path}/${name}`
  }

  /**
   * Editor tree listing (recorded). The default serves an empty level; stub
   * to shape a tree.
   * @param path - absolute directory to list.
   * @param signal - forwarded like the production face passes it to the wire.
   * @returns the level's mixed file/directory listing.
   */
  async listEntries(path: string, signal?: AbortSignal): Promise<FileListing> {
    this.calls.push({ method: 'listEntries', args: [path, signal] })
    const stub = this.stubs.get('listEntries')
    if (stub !== undefined) return await (stub(path, signal) as Promise<FileListing>)
    return { path, entries: [], truncated: false }
  }

  /**
   * Editor file read (recorded). The default serves empty content; stub to
   * shape file bodies or failures.
   * @param path - absolute file path.
   * @param signal - forwarded like the production face passes it to the wire.
   * @returns the file's whole text content.
   */
  async readFile(path: string, signal?: AbortSignal): Promise<string> {
    this.calls.push({ method: 'readFile', args: [path, signal] })
    const stub = this.stubs.get('readFile')
    if (stub !== undefined) return await (stub(path, signal) as Promise<string>)
    return ''
  }

  /**
   * Editor file write (recorded; default no-op).
   * @param path - absolute file path.
   * @param content - the full replacement text.
   */
  async writeFile(path: string, content: string): Promise<void> {
    this.calls.push({ method: 'writeFile', args: [path, content] })
    await (this.stubs.get('writeFile')?.(path, content) as Promise<void> | undefined)
  }

  /**
   * Editor git status (recorded). The default serves a clean main branch
   * rooted at `path`; stub to shape SCM rows or failures.
   * @param path - absolute workspace path.
   * @param signal - forwarded like the production face passes it to the wire.
   */
  async gitStatus(path: string, signal?: AbortSignal): Promise<GitStatus> {
    this.calls.push({ method: 'gitStatus', args: [path, signal] })
    const stub = this.stubs.get('gitStatus')
    if (stub !== undefined) return await (stub(path, signal) as Promise<GitStatus>)
    return { root: path, branch: 'main', ahead: 0, behind: 0, detached: false, changes: [] }
  }

  /**
   * Unified diff (recorded). Default empty worktree diff.
   * @param path - workspace path.
   * @param side - compared side.
   * @param file - optional repository-relative path.
   * @param signal - forwarded abort.
   * @returns the stub diff.
   */
  async gitDiff(path: string, side: GitDiffSide, file?: string, signal?: AbortSignal): Promise<GitDiff> {
    this.calls.push({ method: 'gitDiff', args: [path, side, file, signal] })
    const stub = this.stubs.get('gitDiff')
    if (stub !== undefined) return await (stub(path, side, file, signal) as Promise<GitDiff>)
    return file === undefined
      ? { root: path, side, text: '' }
      : { root: path, side, path: file, text: '' }
  }

  /**
   * Commit unified diff (recorded). Default empty worktree diff.
   * @param path - workspace path.
   * @param commit - commit hash.
   * @param signal - forwarded abort.
   * @returns the stub diff.
   */
  async gitCommitDiff(path: string, commit: string, signal?: AbortSignal): Promise<GitDiff> {
    this.calls.push({ method: 'gitCommitDiff', args: [path, commit, signal] })
    const stub = this.stubs.get('gitCommitDiff')
    if (stub !== undefined) return await (stub(path, commit, signal) as Promise<GitDiff>)
    return { root: path, side: 'worktree', text: '' }
  }

  /**
   * Stage paths (recorded; default no-op).
   * @param path - workspace path.
   * @param files - repository-relative paths.
   * @param signal - forwarded abort.
   */
  async gitStage(path: string, files: readonly string[], signal?: AbortSignal): Promise<void> {
    this.calls.push({ method: 'gitStage', args: [path, files, signal] })
    await (this.stubs.get('gitStage')?.(path, files, signal) as Promise<void> | undefined)
  }

  /**
   * Unstage paths (recorded; default no-op).
   * @param path - workspace path.
   * @param files - repository-relative paths.
   * @param signal - forwarded abort.
   */
  async gitUnstage(path: string, files: readonly string[], signal?: AbortSignal): Promise<void> {
    this.calls.push({ method: 'gitUnstage', args: [path, files, signal] })
    await (this.stubs.get('gitUnstage')?.(path, files, signal) as Promise<void> | undefined)
  }

  /**
   * Commit (recorded). Default hash `deadbeef`.
   * @param path - workspace path.
   * @param message - commit message.
   * @param signal - forwarded abort.
   * @returns the stub commit result.
   */
  async gitCommit(path: string, message: string, signal?: AbortSignal): Promise<GitCommitResult> {
    this.calls.push({ method: 'gitCommit', args: [path, message, signal] })
    const stub = this.stubs.get('gitCommit')
    if (stub !== undefined) return await (stub(path, message, signal) as Promise<GitCommitResult>)
    return { root: path, hash: 'deadbeef' }
  }

  /**
   * Discard paths (recorded; default no-op).
   * @param path - workspace path.
   * @param files - repository-relative paths.
   * @param signal - forwarded abort.
   */
  async gitDiscard(path: string, files: readonly string[], signal?: AbortSignal): Promise<void> {
    this.calls.push({ method: 'gitDiscard', args: [path, files, signal] })
    await (this.stubs.get('gitDiscard')?.(path, files, signal) as Promise<void> | undefined)
  }

  /**
   * Recent commits (recorded). Default empty list.
   * @param path - workspace path.
   * @param limit - max rows.
   * @param signal - forwarded abort.
   * @param skip - older-page offset.
   * @returns stub log rows.
   */
  async gitLog(
    path: string,
    limit?: number,
    signal?: AbortSignal,
    skip?: number,
  ): Promise<GitLogEntry[]> {
    this.calls.push({ method: 'gitLog', args: [path, limit, signal, skip] })
    const stub = this.stubs.get('gitLog')
    if (stub !== undefined) return await (stub(path, limit, signal, skip) as Promise<GitLogEntry[]>)
    return []
  }

  /**
   * Remote sync (recorded; default no-op).
   * @param path - workspace path.
   * @param mode - remote verb.
   * @param signal - forwarded abort.
   */
  async gitSync(path: string, mode: GitSyncMode, signal?: AbortSignal): Promise<void> {
    this.calls.push({ method: 'gitSync', args: [path, mode, signal] })
    await (this.stubs.get('gitSync')?.(path, mode, signal) as Promise<void> | undefined)
  }

  /**
   * Local branches (recorded). Default empty list.
   * @param path - workspace path.
   * @param signal - forwarded abort.
   * @returns stub branches.
   */
  async gitBranches(path: string, signal?: AbortSignal): Promise<GitBranch[]> {
    this.calls.push({ method: 'gitBranches', args: [path, signal] })
    const stub = this.stubs.get('gitBranches')
    if (stub !== undefined) return await (stub(path, signal) as Promise<GitBranch[]>)
    return []
  }

  /**
   * Switch or create a branch (recorded; default no-op).
   * @param path - workspace path.
   * @param name - branch name.
   * @param create - when true, create the branch.
   * @param signal - forwarded abort.
   */
  async gitCheckout(path: string, name: string, create?: boolean, signal?: AbortSignal): Promise<void> {
    this.calls.push({ method: 'gitCheckout', args: [path, name, create, signal] })
    await (this.stubs.get('gitCheckout')?.(path, name, create, signal) as Promise<void> | undefined)
  }

  /**
   * Detach HEAD at a commit (recorded; default no-op).
   * @param path - workspace path.
   * @param hash - commit hash.
   * @param signal - forwarded abort.
   */
  async gitCheckoutCommit(path: string, hash: string, signal?: AbortSignal): Promise<void> {
    this.calls.push({ method: 'gitCheckoutCommit', args: [path, hash, signal] })
    await (this.stubs.get('gitCheckoutCommit')?.(path, hash, signal) as Promise<void> | undefined)
  }

  /**
   * Suggest a commit message (recorded). Default a fixed subject.
   * @param path - workspace path.
   * @param sessionId - session id.
   * @param signal - forwarded abort.
   */
  async gitSuggestCommit(
    path: string,
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<{ message: string }> {
    this.calls.push({ method: 'gitSuggestCommit', args: [path, sessionId, signal] })
    const stub = this.stubs.get('gitSuggestCommit')
    if (stub !== undefined) {
      return await (stub(path, sessionId, signal) as Promise<{ message: string }>)
    }
    return { message: 'chore: generated' }
  }

  /**
   * Rename a Workspace (recorded). The default echoes a minimal view.
   * @param workspaceId - target workspace.
   * @param title - new title.
   * @returns the updated view.
   */
  async rename(workspaceId: WorkspaceId, title: string): Promise<WorkspaceView> {
    this.calls.push({ method: 'rename', args: [workspaceId, title] })
    const stub = this.stubs.get('rename')
    if (stub !== undefined) return await (stub(workspaceId, title) as Promise<WorkspaceView>)
    return { workspaceId, title, path: `/${title}`, sessionIds: [] } as unknown as WorkspaceView
  }

  /**
   * Delete a Workspace (recorded; default no-op).
   * @param workspaceId - target workspace.
   */
  async delete(workspaceId: WorkspaceId): Promise<void> {
    this.calls.push({ method: 'delete', args: [workspaceId] })
    await (this.stubs.get('delete')?.(workspaceId) as Promise<void> | undefined)
  }

  /**
   * Move a Workspace in display order (recorded; default no-op).
   * @param workspaceId - Workspace to move.
   * @param beforeWorkspaceId - Anchor; omitted appends.
   */
  async insertBefore(workspaceId: WorkspaceId, beforeWorkspaceId?: WorkspaceId): Promise<void> {
    this.calls.push({ method: 'insertBefore', args: [workspaceId, beforeWorkspaceId] })
    await (this.stubs.get('insertBefore')?.(workspaceId, beforeWorkspaceId) as Promise<void> | undefined)
  }

  /**
   * Move an accounted session (recorded). The default echoes a minimal view.
   * @param workspaceId - target workspace.
   * @param sessionId - session to move.
   * @param beforeSessionId - anchor; omitted appends.
   * @returns the updated view.
   */
  async insertSessionBefore(workspaceId: WorkspaceId, sessionId: SessionId, beforeSessionId?: SessionId): Promise<WorkspaceView> {
    this.calls.push({ method: 'insertSessionBefore', args: [workspaceId, sessionId, beforeSessionId] })
    const stub = this.stubs.get('insertSessionBefore')
    if (stub !== undefined) return await (stub(workspaceId, sessionId, beforeSessionId) as Promise<WorkspaceView>)
    return { workspaceId, title: '', path: '', sessionIds: [sessionId] } as unknown as WorkspaceView
  }

  /**
   * Archive a session (recorded). The default mirrors the production face's
   * observable effect: the id joins the list state's archive set.
   * @param sessionId - session to archive.
   */
  async archiveSession(sessionId: SessionId): Promise<void> {
    this.calls.push({ method: 'archiveSession', args: [sessionId] })
    const stub = this.stubs.get('archiveSession')
    if (stub !== undefined) {
      await (stub(sessionId) as Promise<void>)
      return
    }
    await this.update((draft) => {
      draft.archivedSessionIds = [...draft.archivedSessionIds, sessionId]
    })
  }
}
