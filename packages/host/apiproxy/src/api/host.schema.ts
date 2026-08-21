/**
 * host domain zod schemas (names derived from map keys).
 */

import { z } from 'zod'
import type { DirectoryEntry, FileEntry, GitChange } from './host.ts'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'

/** host.describe request payload (empty object literal). */
export const hostDescribeRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'host.describe'>>>

/** host.describe response value. */
export const hostDescribeValueSchema = z.object({
  version: z.string(),
  cwd: z.string(),
  provider: z.string().optional(),
  model: z.string().optional(),
  attachedSessions: z.number().int().nonnegative(),
  home: z.string(),
  canOpenPath: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.describe'>>>

/** host.pickDirectory request payload (empty object literal). */
export const hostPickDirectoryRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'host.pickDirectory'>>>

/** host.pickDirectory response value; null means the user cancelled. */
export const hostPickDirectoryValueSchema = z.object({
  path: z.string().nullable(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.pickDirectory'>>>

/** Directory row shared by listing entries and breadcrumb crumbs. */
export const directoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  hidden: z.boolean(),
}) satisfies z.ZodType<Wire<DirectoryEntry>>

/** host.listDirectory request payload; an absent path lists the home directory. */
export const hostListDirectoryRequestSchema = z.object({
  path: z.string().optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.listDirectory'>>>

/** host.listDirectory response value. */
export const hostListDirectoryValueSchema = z.object({
  path: z.string(),
  home: z.string(),
  crumbs: z.array(directoryEntrySchema),
  entries: z.array(directoryEntrySchema),
  truncated: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.listDirectory'>>>

/** host.createDirectory request payload: name must be one plain path segment. */
export const hostCreateDirectoryRequestSchema = z.object({
  path: z.string(),
  name: z.string(),
}).refine(
  payload => payload.name.trim() !== '' && payload.name !== '.' && payload.name !== '..'
    && !/[/\\]/.test(payload.name),
  { message: 'host.createDirectory requires a single non-blank path segment name' },
) satisfies z.ZodType<Wire<RequestPayload<'host.createDirectory'>>>

/** host.createDirectory response value: the created directory's absolute path. */
export const hostCreateDirectoryValueSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.createDirectory'>>>
/** host.openPath request payload. */
export const hostOpenPathRequestSchema = z.object({
  path: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.openPath'>>>

/** host.openPath response value. */
export const hostOpenPathValueSchema = z.object({
  opened: z.literal(true),
}) satisfies z.ZodType<Wire<ResponseValue<'host.openPath'>>>

/** Mixed file/directory row served by host.listEntries. */
export const fileEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  kind: z.union([z.literal('file'), z.literal('directory')]),
  hidden: z.boolean(),
}) satisfies z.ZodType<Wire<FileEntry>>

/** host.listEntries request payload. */
export const hostListEntriesRequestSchema = z.object({
  path: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.listEntries'>>>

/** host.listEntries response value. */
export const hostListEntriesValueSchema = z.object({
  path: z.string(),
  entries: z.array(fileEntrySchema),
  truncated: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.listEntries'>>>

/** host.readFile request payload. */
export const hostReadFileRequestSchema = z.object({
  path: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.readFile'>>>

/** host.readFile response value: whole UTF-8 text content. */
export const hostReadFileValueSchema = z.object({
  path: z.string(),
  content: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.readFile'>>>

/** host.readFileBytes request payload. */
export const hostReadFileBytesRequestSchema = z.object({
  path: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.readFileBytes'>>>

/** host.readFileBytes response value: raw bytes as base64 plus a MIME guess. */
export const hostReadFileBytesValueSchema = z.object({
  path: z.string(),
  contentBase64: z.string(),
  mimeType: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.readFileBytes'>>>

/** host.writeFile request payload: whole-content replacement. */
export const hostWriteFileRequestSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.writeFile'>>>

/** host.writeFile response value: the written file's absolute path. */
export const hostWriteFileValueSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.writeFile'>>>

/** host.renameEntry request payload: name must be one plain path segment. */
export const hostRenameEntryRequestSchema = z.object({
  path: z.string().min(1),
  name: z.string(),
}).refine(
  payload => payload.name.trim() !== '' && payload.name !== '.' && payload.name !== '..'
    && !/[/\\]/.test(payload.name),
  { message: 'host.renameEntry requires a single non-blank path segment name' },
) satisfies z.ZodType<Wire<RequestPayload<'host.renameEntry'>>>

/** host.renameEntry response value: the new absolute path. */
export const hostRenameEntryValueSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.renameEntry'>>>

/** host.deleteEntry request payload. */
export const hostDeleteEntryRequestSchema = z.object({
  path: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.deleteEntry'>>>

/** host.deleteEntry response value: the removed absolute path. */
export const hostDeleteEntryValueSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.deleteEntry'>>>

const positiveGlob = z.string().min(1).max(500).refine(
  value => !value.startsWith('!'),
  { message: 'search glob filters must be positive patterns' },
)

/** host.search request payload. */
export const hostSearchRequestSchema = z.object({
  path: z.string().min(1),
  query: z.string().min(1).max(2000),
  regex: z.boolean().optional(),
  caseSensitive: z.boolean().optional(),
  wholeWord: z.boolean().optional(),
  include: positiveGlob.optional(),
  exclude: positiveGlob.optional(),
  limit: z.number().int().positive().max(2000).optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.search'>>>

/** host.search response value. */
export const hostSearchValueSchema = z.object({
  root: z.string(),
  hits: z.array(z.object({
    path: z.string(),
    line: z.number().int().positive(),
    text: z.string(),
    spans: z.array(z.object({
      start: z.number().int().nonnegative(),
      end: z.number().int().nonnegative(),
    })),
  })),
  fileCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.search'>>>

/** One SCM row served by host.gitStatus. */
export const gitChangeSchema = z.object({
  path: z.string(),
  status: z.union([
    z.literal('modified'),
    z.literal('added'),
    z.literal('deleted'),
    z.literal('untracked'),
    z.literal('renamed'),
    z.literal('conflict'),
  ]),
  area: z.union([z.literal('index'), z.literal('worktree')]),
}) satisfies z.ZodType<Wire<GitChange>>

/** host.gitStatus request payload: any path inside the work tree. */
export const hostGitStatusRequestSchema = z.object({
  path: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitStatus'>>>

/** host.gitStatus response value. */
export const hostGitStatusValueSchema = z.object({
  root: z.string(),
  branch: z.string(),
  ahead: z.number().int().nonnegative(),
  behind: z.number().int().nonnegative(),
  detached: z.boolean(),
  changes: z.array(gitChangeSchema),
}) satisfies z.ZodType<Wire<ResponseValue<'host.gitStatus'>>>

const gitRelPath = z.string().min(1).refine(
  value => !value.startsWith('/') && !value.startsWith('\\') && !value.includes('..'),
  { message: 'git path must be repository-relative without ..' },
)

const gitFilesPayload = z.object({
  path: z.string().min(1),
  files: z.array(gitRelPath).min(1),
})

/** host.gitDiff request payload. */
export const hostGitDiffRequestSchema = z.object({
  path: z.string().min(1),
  side: z.union([z.literal('worktree'), z.literal('staged')]),
  file: gitRelPath.optional(),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/i).optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitDiff'>>>

/** host.gitDiff response value. */
export const hostGitDiffValueSchema = z.object({
  root: z.string(),
  side: z.union([z.literal('worktree'), z.literal('staged')]),
  path: z.string().optional(),
  text: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.gitDiff'>>>

/** host.gitStage request payload. */
export const hostGitStageRequestSchema = gitFilesPayload satisfies z.ZodType<Wire<RequestPayload<'host.gitStage'>>>

/** host.gitStage / gitUnstage / gitDiscard response value. */
export const hostGitRootValueSchema = z.object({
  root: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.gitStage'>>>

/** host.gitUnstage request payload. */
export const hostGitUnstageRequestSchema = gitFilesPayload satisfies z.ZodType<Wire<RequestPayload<'host.gitUnstage'>>>

/** host.gitDiscard request payload. */
export const hostGitDiscardRequestSchema = gitFilesPayload satisfies z.ZodType<Wire<RequestPayload<'host.gitDiscard'>>>

/** host.gitCommit request payload. */
export const hostGitCommitRequestSchema = z.object({
  path: z.string().min(1),
  message: z.string().trim().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitCommit'>>>

/** host.gitCommit response value. */
export const hostGitCommitValueSchema = z.object({
  root: z.string(),
  hash: z.string().min(1),
}) satisfies z.ZodType<Wire<ResponseValue<'host.gitCommit'>>>

/** host.gitLog request payload. */
export const hostGitLogRequestSchema = z.object({
  path: z.string().min(1),
  limit: z.number().int().positive().max(100).optional(),
  skip: z.number().int().nonnegative().max(100_000).optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitLog'>>>

/** host.gitLog response value. */
export const hostGitLogValueSchema = z.array(z.object({
  hash: z.string(),
  subject: z.string(),
  author: z.string(),
  timestamp: z.number(),
  parents: z.array(z.string()).optional(),
  refs: z.array(z.object({
    kind: z.union([
      z.literal('head'), z.literal('branch'), z.literal('remote'), z.literal('tag'),
    ]),
    name: z.string(),
  })).optional(),
  body: z.string().optional(),
  files: z.number().int().nonnegative().optional(),
  insertions: z.number().int().nonnegative().optional(),
  deletions: z.number().int().nonnegative().optional(),
  originUrl: z.string().optional(),
})) satisfies z.ZodType<Wire<ResponseValue<'host.gitLog'>>>

const gitBranchName = z.string().min(1).max(200).refine(
  value => (
    /^(?!-)[A-Za-z0-9._/-]+$/.test(value)
    && !value.includes('..')
    && !value.includes('@{')
    && !value.endsWith('/')
    && !value.endsWith('.lock')
  ),
  { message: 'git branch name is not safe' },
)

/** host.gitSync request payload. */
export const hostGitSyncRequestSchema = z.object({
  path: z.string().min(1),
  mode: z.union([z.literal('fetch'), z.literal('pull'), z.literal('push')]),
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitSync'>>>

/** host.gitBranches request payload. */
export const hostGitBranchesRequestSchema = z.object({
  path: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitBranches'>>>

/** host.gitBranches response value. */
export const hostGitBranchesValueSchema = z.object({
  root: z.string(),
  branches: z.array(z.object({
    name: z.string(),
    current: z.boolean(),
    upstream: z.string().optional(),
    remote: z.boolean().optional(),
  })),
}) satisfies z.ZodType<Wire<ResponseValue<'host.gitBranches'>>>

/** host.gitCheckout request payload. */
export const hostGitCheckoutRequestSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1).max(200),
  create: z.boolean().optional(),
  detach: z.boolean().optional(),
}).refine(
  value => !(value.detach === true && value.create === true),
  { message: 'cannot create and detach' },
).refine(
  value => value.detach === true
    ? /^[0-9a-f]{7,40}$/i.test(value.name)
    : gitBranchName.safeParse(value.name).success,
  { message: 'git checkout target is not safe' },
) satisfies z.ZodType<Wire<RequestPayload<'host.gitCheckout'>>>

/** host.gitSuggestCommit request payload. */
export const hostGitSuggestCommitRequestSchema = z.object({
  path: z.string().min(1),
  sessionId: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitSuggestCommit'>>>

/** host.gitSuggestCommit response value. */
export const hostGitSuggestCommitValueSchema = z.object({
  message: z.string().min(1),
}) satisfies z.ZodType<Wire<ResponseValue<'host.gitSuggestCommit'>>>

/** host.gitCheckout response value. */
export const hostGitCheckoutValueSchema = z.object({
  root: z.string(),
  name: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.gitCheckout'>>>

const terminalStatusSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('running') }),
  z.object({
    kind: z.literal('exited'),
    exitCode: z.number().nullable(),
    signal: z.string().nullable(),
  }),
])

const terminalSessionId = z.string().min(1)

/** host.terminalList request payload. */
export const hostTerminalListRequestSchema = z.object({
  sessionId: terminalSessionId,
}) satisfies z.ZodType<Wire<RequestPayload<'host.terminalList'>>>

/** host.terminalList response value. */
export const hostTerminalListValueSchema = z.object({
  available: z.boolean(),
  sessions: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),
    status: terminalStatusSchema,
  })),
}) satisfies z.ZodType<Wire<ResponseValue<'host.terminalList'>>>

/** host.terminalOpen request payload. */
export const hostTerminalOpenRequestSchema = z.object({
  sessionId: terminalSessionId,
  name: z.string().min(1).optional(),
  cwd: z.string().min(1).optional(),
  cols: z.number().int().min(1).max(512).optional(),
  rows: z.number().int().min(1).max(512).optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.terminalOpen'>>>

/** host.terminalOpen response value. */
export const hostTerminalOpenValueSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  motd: z.string(),
  status: terminalStatusSchema,
}) satisfies z.ZodType<Wire<ResponseValue<'host.terminalOpen'>>>

/** host.terminalSend request payload. */
export const hostTerminalSendRequestSchema = z.object({
  sessionId: terminalSessionId,
  id: z.string().min(1),
  text: z.string(),
  submit: z.boolean(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.terminalSend'>>>

/** host.terminalSend response value. */
export const hostTerminalSendValueSchema = z.object({
  viewport: z.string(),
  waitReason: z.enum(['stdin_read', 'inferred_idle', 'timeout', 'session_exit']),
  truncated: z.boolean(),
  status: terminalStatusSchema,
}) satisfies z.ZodType<Wire<ResponseValue<'host.terminalSend'>>>

/** host.terminalWrite request payload. */
export const hostTerminalWriteRequestSchema = z.object({
  sessionId: terminalSessionId,
  id: z.string().min(1),
  data: z.string(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.terminalWrite'>>>

/** host.terminalWrite response value. */
export const hostTerminalWriteValueSchema = z.object({
  written: z.literal(true),
}) satisfies z.ZodType<Wire<ResponseValue<'host.terminalWrite'>>>

/** host.terminalResize request payload. */
export const hostTerminalResizeRequestSchema = z.object({
  sessionId: terminalSessionId,
  id: z.string().min(1),
  cols: z.number().int().min(1).max(512),
  rows: z.number().int().min(1).max(512),
}) satisfies z.ZodType<Wire<RequestPayload<'host.terminalResize'>>>

/** host.terminalResize response value. */
export const hostTerminalResizeValueSchema = z.object({
  resized: z.literal(true),
}) satisfies z.ZodType<Wire<ResponseValue<'host.terminalResize'>>>

/** host.terminalRead request payload. */
export const hostTerminalReadRequestSchema = z.object({
  sessionId: terminalSessionId,
  id: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.terminalRead'>>>

/** host.terminalRead response value. */
export const hostTerminalReadValueSchema = z.object({
  text: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.terminalRead'>>>

/** host.terminalSignal request payload. */
export const hostTerminalSignalRequestSchema = z.object({
  sessionId: terminalSessionId,
  id: z.string().min(1),
  signal: z.enum(['SIGINT', 'SIGTERM', 'SIGKILL', 'SIGTSTP', 'SIGHUP']),
}) satisfies z.ZodType<Wire<RequestPayload<'host.terminalSignal'>>>

/** host.terminalSignal response value. */
export const hostTerminalSignalValueSchema = z.object({
  delivered: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.terminalSignal'>>>

/** host.terminalKill request payload. */
export const hostTerminalKillRequestSchema = z.object({
  sessionId: terminalSessionId,
  id: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.terminalKill'>>>

/** host.terminalKill response value. */
export const hostTerminalKillValueSchema = z.object({
  closed: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.terminalKill'>>>
