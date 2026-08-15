/**
 * The outward workspaces-service face — what `ctx.workspaces` exposes to
 * feature packages and the renderer host, and therefore exactly what the
 * test runtime's workspaces double must implement. Wire-pump entry points
 * (handleHostEnvelope/handleConnected/refresh/startInitialSelection) stay on
 * the concrete class. Widening this interface is the explicit act of
 * widening what features may do to the workspaces domain.
 */
import type {
  DirectoryListing, FileListing, GitBranch, GitCommitResult, GitDiff, GitDiffSide, GitLogEntry,
  GitStatus, GitSyncMode,
  SessionId, WorkspaceId, WorkspaceView,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { WorkspaceListState } from '../workspaces/service.ts'
import type { ObservableSnapshot } from './store.ts'

/** The workspaces-service face injected as `ctx.workspaces`. */
export interface IWorkspaces {
  /** The useWorkspaces standard feed (read face — writes stay inside the domain). */
  readonly list: ObservableSnapshot<WorkspaceListState>
  /**
   * Connect a Workspace to its reusable or freshly created blank session.
   * @param workspaceId - target workspace.
   * @returns the connected session id.
   */
  connectWorkspace(workspaceId: WorkspaceId): Promise<SessionId>
  /**
   * The New Session flow: connect the explicit, current-Session, or recent
   * Workspace and open the resulting session; failures surface on the session
   * list state. When the connected session is already current, a fresh
   * session is minted so the New Session button is never a no-op.
   * @param workspaceId - explicit target; omitted inherits the current
   * Session's Workspace before falling back to the recency projection.
   * @param opts.preferExisting - when true, return immediately if the current
   *   session already belongs to the target Workspace; otherwise open the
   *   connected session without minting a second blank.
   * @param opts.forceNew - when true, always mint a session on the target
   *   Workspace and open it (the per-project New Session button).
   */
  startSession(workspaceId?: WorkspaceId, opts?: { preferExisting?: boolean; forceNew?: boolean }): void
  /**
   * Register an existing path as a Workspace, then start that Workspace
   * with preferExisting so Git and the composer follow the folder.
   * @param input - the Host create payload.
   * @returns the created or idempotently resolved Workspace.
   */
  create(input: { path: string }): Promise<WorkspaceView>
  /**
   * Open the Host's native directory picker.
   * @returns the selected path, or null when the user cancelled.
   */
  pickDirectory(): Promise<string | null>
  /**
   * List one directory level through the Host's `browse` capability.
   * @param path - absolute directory to list; absent lists the Host home directory.
   * @param signal - aborts the wire request (and the Host's scan) when the caller supersedes it.
   * @returns the level's listing with breadcrumb ancestry.
   */
  listDirectory(path?: string, signal?: AbortSignal): Promise<DirectoryListing>
  /**
   * Create one child directory through the Host's `browse` capability.
   * @param path - absolute existing parent directory.
   * @param name - single non-blank path segment.
   * @returns the created directory's absolute path.
   */
  createDirectory(path: string, name: string): Promise<string>
  /**
   * Open a filesystem path with the Host operating system's default application.
   * @param path - absolute or host-resolvable path.
   */
  openPath(path: string): Promise<void>
  /**
   * List one directory level including files (the in-app editor's tree feed).
   * @param path - absolute directory to list.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the level's mixed file/directory listing.
   */
  listEntries(path: string, signal?: AbortSignal): Promise<FileListing>
  /**
   * Read one UTF-8 text file from the Host.
   * @param path - absolute file path.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the file's whole text content.
   */
  readFile(path: string, signal?: AbortSignal): Promise<string>
  /**
   * Write one UTF-8 text file on the Host (whole-content replacement).
   * @param path - absolute file path (its parent directory must exist).
   * @param content - the full replacement text.
   */
  writeFile(path: string, content: string): Promise<void>
  /**
   * Read git status for the repository containing `path` (editor SCM panel).
   * @param path - absolute workspace path or any file inside it.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the git status snapshot.
   */
  gitStatus(path: string, signal?: AbortSignal): Promise<GitStatus>
  /**
   * Unified diff for one path (or the whole tree).
   * @param path - absolute workspace path or any file inside it.
   * @param side - `worktree` (unstaged) or `staged` (index).
   * @param file - optional repository-relative path.
   * @param signal - aborts the wire request.
   * @returns the unified diff snapshot.
   */
  gitDiff(path: string, side: GitDiffSide, file?: string, signal?: AbortSignal): Promise<GitDiff>
  /**
   * Unified diff for one commit (`git show --first-parent`). Not an agent tool.
   * @param path - absolute workspace path or any file inside it.
   * @param commit - commit hash (7–40 hex).
   * @param signal - aborts the wire request.
   * @returns the unified diff snapshot.
   */
  gitCommitDiff(path: string, commit: string, signal?: AbortSignal): Promise<GitDiff>
  /**
   * Stage repository-relative paths (`git add`).
   * @param path - absolute workspace path or any file inside it.
   * @param files - repository-relative paths.
   * @param signal - aborts the wire request.
   */
  gitStage(path: string, files: readonly string[], signal?: AbortSignal): Promise<void>
  /**
   * Unstage repository-relative paths (`git restore --staged`).
   * @param path - absolute workspace path or any file inside it.
   * @param files - repository-relative paths.
   * @param signal - aborts the wire request.
   */
  gitUnstage(path: string, files: readonly string[], signal?: AbortSignal): Promise<void>
  /**
   * Commit staged changes. Never writes git identity.
   * @param path - absolute workspace path or any file inside it.
   * @param message - commit message.
   * @param signal - aborts the wire request.
   * @returns the new HEAD hash.
   */
  gitCommit(path: string, message: string, signal?: AbortSignal): Promise<GitCommitResult>
  /**
   * Discard worktree changes for the given paths.
   * @param path - absolute workspace path or any file inside it.
   * @param files - repository-relative paths.
   * @param signal - aborts the wire request.
   */
  gitDiscard(path: string, files: readonly string[], signal?: AbortSignal): Promise<void>
  /**
   * Recent commits (`git log -n`).
   * @param path - absolute workspace path or any file inside it.
   * @param limit - max rows (host caps at 100).
   * @param signal - aborts the wire request.
   * @returns log rows newest first.
   */
  gitLog(path: string, limit?: number, signal?: AbortSignal): Promise<GitLogEntry[]>
  /**
   * User-initiated fetch / ff-only pull / push. Not an agent tool.
   * @param path - absolute workspace path or any file inside it.
   * @param mode - remote verb.
   * @param signal - aborts the wire request.
   */
  gitSync(path: string, mode: GitSyncMode, signal?: AbortSignal): Promise<void>
  /**
   * Local branches for the SCM picker.
   * @param path - absolute workspace path or any file inside it.
   * @param signal - aborts the wire request.
   * @returns branch rows.
   */
  gitBranches(path: string, signal?: AbortSignal): Promise<GitBranch[]>
  /**
   * Switch or create a local branch (`git switch` / `git switch -c`).
   * @param path - absolute workspace path or any file inside it.
   * @param name - branch name.
   * @param create - when true, create the branch.
   * @param signal - aborts the wire request.
   */
  gitCheckout(path: string, name: string, create?: boolean, signal?: AbortSignal): Promise<void>
  /**
   * Detach HEAD at a commit (`git switch --detach`). Not an agent tool.
   * @param path - absolute workspace path or any file inside it.
   * @param hash - commit hash (7–40 hex).
   * @param signal - aborts the wire request.
   */
  gitCheckoutCommit(path: string, hash: string, signal?: AbortSignal): Promise<void>
  /**
   * Ask the session model for a commit message from the staged diff.
   * The host logs the exact prompt before dispatch. Not an agent tool.
   * @param path - absolute workspace path or any file inside it.
   * @param sessionId - session whose model route and log receive the request.
   * @param signal - aborts the wire request.
   * @returns the generated commit message.
   */
  gitSuggestCommit(path: string, sessionId: string, signal?: AbortSignal): Promise<{ message: string }>
  /**
   * Rename a Workspace.
   * @param workspaceId - target workspace.
   * @param title - the new display title.
   * @returns the updated Workspace view.
   */
  rename(workspaceId: WorkspaceId, title: string): Promise<WorkspaceView>
  /**
   * Delete a Workspace (its sessions fall back to the unaccounted group).
   * @param workspaceId - target workspace.
   */
  delete(workspaceId: WorkspaceId): Promise<void>
  /**
   * Move a Workspace within the registry display order.
   * @param workspaceId - Workspace to move.
   * @param beforeWorkspaceId - Anchor workspace; omitted appends.
   */
  insertBefore(workspaceId: WorkspaceId, beforeWorkspaceId?: WorkspaceId): Promise<void>
  /**
   * Move an accounted session within/into a Workspace's ordered list.
   * @param workspaceId - target workspace.
   * @param sessionId - accounted session to move.
   * @param beforeSessionId - accounted anchor to insert before; omitted appends.
   * @returns the updated Workspace view.
   */
  insertSessionBefore(workspaceId: WorkspaceId, sessionId: SessionId, beforeSessionId?: SessionId): Promise<WorkspaceView>
  /**
   * Archive a session into the registry-global set (hidden from grouping
   * surfaces; session log and accounting slot remain). Archiving the current
   * session clears the selection into the New Session view state.
   * @param sessionId - session to archive.
   */
  archiveSession(sessionId: SessionId): Promise<void>
}
