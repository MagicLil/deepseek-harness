/** Map a catalog origin to a locale key. */

import type { SkillOrigin } from './contract.ts'
import type { SkillsKey } from './locales.ts'

/**
 * Locale key for a skill origin badge.
 * @param origin - catalog origin.
 * @returns a SkillsKey for `t()`.
 */
export function originKey(origin: SkillOrigin): SkillsKey {
  if (origin === 'claude') return 'origin.claude'
  if (origin === 'cursor') return 'origin.cursor'
  if (origin === 'agents') return 'origin.agents'
  if (origin === 'personal') return 'origin.personal'
  if (origin === 'codex') return 'origin.codex'
  if (origin === 'other') return 'origin.other'
  return 'origin.project'
}
