/**
 * Send a repair prompt into the scoped session and reveal the conversation.
 */
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'

/** Minimal sessions + layout face used by the pre-commit hand-off. */
export type AskAgentFixHost = {
  sessions: {
    binding: (id: SessionId) => {
      session: {
        prompt: (
          content: { type: 'text'; text: string }[],
          mode: 'queue' | 'steer',
        ) => Promise<{ ok: true } | { ok: false; error: { code: string; message: string } }>
      }
    } | undefined
  }
  layout: {
    openConversation: () => void
  }
}

/**
 * Queue one text prompt and open the conversation column.
 * @param host - sessions binding + layout.
 * @param sessionId - target session.
 * @param text - prompt body.
 */
export async function askAgentFix(
  host: AskAgentFixHost,
  sessionId: string,
  text: string,
): Promise<void> {
  const binding = host.sessions.binding(sessionId as SessionId)
  if (binding === undefined) throw new Error('no session')
  const result = await binding.session.prompt([{ type: 'text', text }], 'queue')
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`)
  }
  host.layout.openConversation()
}
