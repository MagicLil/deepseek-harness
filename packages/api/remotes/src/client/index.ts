/** Platform-neutral assembly of generated Host Remote contributions. */

import type { Context } from '@deepseek-ai/cordis'
import commandsRemote from '@deepseek-ai/dsh-commands/remote'
import goalsRemote from '@deepseek-ai/dsh-goal/remote'
import dynamicRemote from '@deepseek-ai/dsh-cordis-host-runner/remote'
import pluginInventoryRemote from '@deepseek-ai/dsh-host-plugin-inventory/remote'
import marketplaceRemote from '@deepseek-ai/dsh-host-marketplace/remote'
import skillManagerRemote from '@deepseek-ai/dsh-host-skill-manager/remote'
import agentReviewRemote from '@deepseek-ai/dsh-host-agent-review/remote'
import workspaceChecksRemote from '@deepseek-ai/dsh-host-workspace-checks/remote'
import xmartLanRemote from '@deepseek-ai/dsh-host-xmart-lan/remote'
import vueLspRemote from '@deepseek-ai/dsh-lsp-vue/remote'
import languagesLspRemote from '@deepseek-ai/dsh-lsp-languages/remote'
import messageFeedbackRemote from '@deepseek-ai/dsh-message-feedback/remote'
import type { TypertClientRemote } from '@deepseek-ai/dsh-typert-protocol'

export type { TypertClientRemote as ClientRemote } from '@deepseek-ai/dsh-typert-protocol'
export type { PluginInventorySnapshot } from '@deepseek-ai/dsh-host-plugin-inventory/types'
export type {
  DshPluginCard, DshPluginSearchResult, MarketplaceJobResult, VsixCard, VsixCompatibility, VsixSearchResult,
} from '@deepseek-ai/dsh-host-marketplace/types'
export type {
  VueLspCompleteResult, VueLspCompletionItem, VueLspDiagnostic, VueLspDiagnosticsResult,
} from '@deepseek-ai/dsh-lsp-vue/types'
export type {
  EditorLspCompleteResult, EditorLspCompletionItem, EditorLspDiagnostic, EditorLspDiagnosticsResult,
} from '@deepseek-ai/dsh-lsp-languages/types'
export type {} from '@deepseek-ai/dsh-commands/remote'
export type {} from '@deepseek-ai/dsh-goal/remote'
export type {} from '@deepseek-ai/dsh-host-plugin-inventory/remote'
export type {} from '@deepseek-ai/dsh-host-marketplace/remote'
export type {} from '@deepseek-ai/dsh-host-skill-manager/remote'
export type {} from '@deepseek-ai/dsh-host-agent-review/remote'
export type {} from '@deepseek-ai/dsh-host-workspace-checks/remote'
export type {} from '@deepseek-ai/dsh-host-xmart-lan/remote'
export type {} from '@deepseek-ai/dsh-lsp-vue/remote'
export type {} from '@deepseek-ai/dsh-lsp-languages/remote'
export type {} from '@deepseek-ai/dsh-message-feedback/remote'
// The forwarded-event allowlist's selection seat: without it in the consumer's
// compilation face `TypertRemoteEvent` is `never` and every `$on` call fails.
export type { ApiRemoteForwardedEvent } from '../types.ts'
// The owner packages' client-safe `./types` exports supply the `Events`
// signatures `$on` hands to a listener, so a consumer reads the very
// declaration the Host emits rather than a flattened restatement of it.
export type {} from '@deepseek-ai/dsh-commands/types'
export type {} from '@deepseek-ai/dsh-cordis-host-runner/types'
export type {} from '@deepseek-ai/dsh-credentials/types'
export type {} from '@deepseek-ai/dsh-llm/types'
export type {} from '@deepseek-ai/dsh-agent-presets/types'
export type {} from '@deepseek-ai/dsh-settings/types'
export type { TerminalOutputPayload } from '../terminal-events.ts'

/**
 * The carrier's Client-facing types, re-exported so a business package names one
 * assembly package instead of both this facade and the Connection plugin. Type-only:
 * the carrier's runtime values stay behind their own module edge.
 */
export type {
  ClientResponse, ConfigurableProviderView, ConnectionHandle, ConnectionSinks, ContentBlock,
  CredentialView, DirectoryListing, DiscoveredModelView, FileEntry, FileListing,
  FileSearchHit, FileSearchResult, FileSearchSpan, GitBranch, GitChange, GitCommitResult,
  GitDiff, GitDiffSide, GitFileStatus, GitLogEntry, GitRef, GitRefKind, GitStatus, GitSyncMode, HistoryEntry,
  HostFrame, IApiClient,
  MessageId, ModelCatalogFailure, ModelProviderGroup, ModelReasoningEffort, ModelSelection,
  MuxFrame, PromptContentPart, QuestionResponsePayload, QueueAction, RpcError, RpcId, RpcReceipt,
  RpcRequest, RpcResponse, RpcResult, SessionId, SessionModels, SessionSearchItem,
  SessionSummary, SettingsNamespaceView, SettingsPathOpView, SkillEntry, StreamChunk,
  SubagentAddress, SubagentCatalog, JobView, ToolCallView, ToolEventView, ToolResultView,
  WorkspaceId, WorkspaceView,
} from '@deepseek-ai/dsh-client-connection/client'
export type {} from '@deepseek-ai/dsh-api-gateway/client'
export type {} from '@deepseek-ai/dsh-cordis-host-runner/remote'

// The payload vocabulary of the selected namespaces, re-exported so a Client
// contribution can name what it sends and receives without importing a Host
// package: this assembly is the one place both planes legitimately meet.
export type {
  ApprovalRequestId,
  CordisHalfState,
  CordisDynamicPackageId,
  CordisDynamicPluginId,
  CordisDynamicPluginRunId,
  CordisDynamicRunMode,
  CordisInspectMethodManifest,
  CordisInspectPlatform,
  CordisInspectProviderManifest,
  CordisInspectProviderView,
  CordisInspectQueryRequest,
  CordisInspectQueryResolution,
  CordisInspectQueryResolved,
  CordisInspectRequestId,
  CordisInspectResolveAck,
  CordisRunDiagnostic,
  CordisRunStatus,
  DynamicCordisClientSource,
  DynamicCordisHostHalfResult,
  DynamicCordisInventoryRow,
  DynamicCordisInvokeResult,
  DynamicCordisPackage,
  DynamicCordisRequestResolved,
  DynamicCordisResolveAck,
  DynamicCordisRetracted,
  DynamicCordisRunRequest,
  DynamicCordisRunResolution,
  DynamicCordisRunAttempt,
  DynamicCordisRunResponse,
  DynamicCordisStopResponse,
  DynamicCordisUndefineReceipt,
  RequestRunOutcome,
} from '@deepseek-ai/dsh-cordis-host-runner/types'
// The JSON vocabulary those payloads are built from, re-exported for the same
// reason: a Client contribution names what it sends without importing a Host
// package, and this assembly is where both planes legitimately meet.
export type { JsonValue } from '@deepseek-ai/dsh-session/types'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Generated Remote namespaces selected by this Client assembly. */
    remote: TypertClientRemote
  }
}

/** Required service: the typed Client Remote contribution mount. */
export const inject = ['remote']

/**
 * Mount the Host capabilities explicitly selected for this Client assembly.
 * @param ctx - Client Cordis root carrying the typed API service.
 * @returns disposer after every selected Remote namespace is ready.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const disposers: Array<() => Promise<void>> = []
  try {
    for (const contribution of [
      commandsRemote, goalsRemote, dynamicRemote, pluginInventoryRemote, marketplaceRemote,
      skillManagerRemote, agentReviewRemote, workspaceChecksRemote, xmartLanRemote, vueLspRemote, languagesLspRemote, messageFeedbackRemote,
    ]) {
      disposers.push(await ctx.remote.$mount(contribution))
    }
  } catch (error) {
    for (const dispose of disposers.reverse()) await dispose()
    throw error
  }
  // Unwound in reverse mount order, so a namespace never outlives one mounted
  // after it.
  return async () => {
    for (const dispose of disposers.reverse()) await dispose()
  }
}
