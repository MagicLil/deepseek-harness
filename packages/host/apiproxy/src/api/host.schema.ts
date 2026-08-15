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

/** host.writeFile request payload: whole-content replacement. */
export const hostWriteFileRequestSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.writeFile'>>>

/** host.writeFile response value: the written file's absolute path. */
export const hostWriteFileValueSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.writeFile'>>>

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
}) satisfies z.ZodType<Wire<RequestPayload<'host.gitLog'>>>

/** host.gitLog response value. */
export const hostGitLogValueSchema = z.array(z.object({
  hash: z.string(),
  subject: z.string(),
  author: z.string(),
  timestamp: z.number(),
})) satisfies z.ZodType<Wire<ResponseValue<'host.gitLog'>>>
