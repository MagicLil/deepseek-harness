/** Register the Codex profile's Tool timeline presentation. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import { CodexToolTimeline } from './CodexToolTimeline.tsx'

/** Required generic Tool presentation registry. */
export const inject = ['toolTimelinePresentations']

/** Register the isolated Codex renderer; it is used only by matching preset metadata. */
export function apply(ctx: Context): void {
  ctx.effect(
    () => ctx.toolTimelinePresentations.register({ experienceProfile: 'codex', Frame: CodexToolTimeline }),
    'ui-codex-experience: Codex Tool timeline',
  )
}
