/**
 * User-facing tool-error presentation. The raw failure text (`tool/result`
 * content) stays in the session log for developers; the conversation renders a
 * sanitized summary derived only from the structured `error.code`. The mapping
 * is pure (no locale, no runtime reads) so a UI bridge and a session-log replay
 * derive the identical kind from the same durable code.
 */

import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'

/** Sanitized failure category a tool error presents as. */
export type ToolErrorKind = 'default' | 'file-busy' | 'permission-denied' | 'not-found' | 'stale'

/** Locale key per kind, resolved against the `conversation` namespace. */
type ConversationTranslationKey = Parameters<TranslateNS<'conversation'>>[0]

const ERROR_KEY: Record<ToolErrorKind, ConversationTranslationKey> = {
  default: 'tool.error.default',
  'file-busy': 'tool.error.fileBusy',
  'permission-denied': 'tool.error.permission',
  'not-found': 'tool.error.notFound',
  stale: 'tool.error.stale',
}

/**
 * Classify a structured tool error code into its sanitized category.
 * @param code - the `tool/result` event's `error.code`, or undefined.
 * @returns the category whose locale key renders the friendly summary.
 */
export function toolErrorKind(code: string | undefined): ToolErrorKind {
  switch (code) {
    case 'FS_IO_ERROR': return 'file-busy'
    case 'FS_PERMISSION_DENIED':
    case 'FS_SANDBOX_DENIED': return 'permission-denied'
    case 'FS_NOT_FOUND':
    case 'FS_EDIT_NOT_FOUND': return 'not-found'
    case 'FS_STALE_VERSION': return 'stale'
    default: return 'default'
  }
}

/**
 * Render the friendly, sanitized summary for a failed tool call.
 * @param kind - the classified error category.
 * @param t - the conversation-namespace translate function.
 * @returns the user-facing message; never the raw failure text.
 */
export function friendlyToolErrorSummary(kind: ToolErrorKind, t: TranslateNS<'conversation'>): string {
  return t(ERROR_KEY[kind])
}
