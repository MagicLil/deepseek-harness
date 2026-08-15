/** Injected RPC + copy for the Skills settings page. Components never see ctx. */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SkillsKey } from './locales.ts'

/** Owned write scope. */
export type SkillScope = 'personal' | 'project'

/** Catalog origin shown on a row. */
export type SkillOrigin = SkillScope | 'agents' | 'claude' | 'cursor' | 'codex' | 'other'

/** Catalog row. */
export interface ManagedSkillSummary {
  readonly name: string
  readonly description: string
  readonly whenToUse?: string
  readonly modelInvocable: boolean
  readonly userInvocable: boolean
  readonly origin: SkillOrigin
  readonly sourcePath?: string
}

/** Mutation outcome. */
export interface SkillJobResult {
  readonly ok: boolean
  readonly error?: string
}

/** Registration-side Remote face used by the section. */
export interface SkillsSettingsInjected {
  /** List owned and home-tool skills in one scope. */
  listOwned: (scope: SkillScope, projectRoot?: string) => Promise<readonly ManagedSkillSummary[]>
  /** List project skills after hiding personal names that are not overrides. */
  listProject: (projectRoot: string) => Promise<readonly ManagedSkillSummary[]>
  /** Turn a listed skill on or off. */
  setEnabled: (input: {
    name: string
    enabled: boolean
    sourcePath?: string
    projectRoot?: string
  }) => Promise<SkillJobResult>
}

/** Full composed props for the Skills settings section. */
export type SkillsSettingsProps =
  & PropsRuntime<'settings.section'>
  & PropsLocale<'settings.skills'>
  & InjectFace<SkillsSettingsInjected>

export type { SkillsKey }
