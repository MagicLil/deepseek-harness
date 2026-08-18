/** Session-scoped resolver over the preset roster's optional experience ids. */

import type { SessionId, ISessions } from '@deepseek-ai/dsh-client-runtime/client'
import type { AgentPresetSettingsController } from './settings-store.ts'
import { resolveExperienceProfile } from './experience-profile.ts'

/** Resolve the runtime experience selected for one visible session. */
export interface IAgentPresetExperience {
  /** @param sessionId - session whose recorded preset selects the profile. @returns the profile id, or undefined for native DSH. */
  profile(sessionId: SessionId): string | undefined
}

/** Implementation backed by the live session list and roster controller. */
export class AgentPresetExperience implements IAgentPresetExperience {
  constructor(private readonly sessions: Pick<ISessions, 'list'>, private readonly controller: AgentPresetSettingsController) {}

  profile(sessionId: SessionId): string | undefined {
    const agentPreset = this.sessions.list.getSnapshot().byId[sessionId]?.agentPreset
    return resolveExperienceProfile(agentPreset, this.controller.store.getSnapshot().options)
  }
}
