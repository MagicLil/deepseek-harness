/** Resolve the optional runtime experience declared by a session's preset. */

/** The minimal preset facts needed to resolve an experience. */
export interface ExperiencePreset {
  /** Stable preset identity recorded on the session. */
  readonly id: string
  /** Optional experience implementation selected by this preset. */
  readonly experienceProfile?: string
}

/**
 * Resolve one session's experience without assigning a fallback profile.
 * @param agentPreset - preset id recorded on the session.
 * @param presets - current preset roster from the Host.
 * @returns the declared profile, or undefined for the native DSH renderer.
 */
export function resolveExperienceProfile(
  agentPreset: string | undefined,
  presets: readonly ExperiencePreset[],
): string | undefined {
  return agentPreset === undefined
    ? undefined
    : presets.find(preset => preset.id === agentPreset)?.experienceProfile
}
