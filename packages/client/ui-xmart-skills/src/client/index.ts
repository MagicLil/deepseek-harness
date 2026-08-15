/**
 * X-Mart Skills settings plugin. Registers a `settings.section` page.
 * Components never see ctx.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {
  ManagedSkillSummary,
  SkillJobResult,
  SkillScope,
  SkillsSettingsInjected,
} from './contract.ts'
import { SkillsSettingsSection } from './SkillsSettingsSection.tsx'
import { en, zh, type SkillsKey } from './locales.ts'
import { unwrapRemote, type RemoteResult } from './unwrap.ts'

export type { SkillsKey } from './locales.ts'
export type {
  ManagedSkillSummary, SkillOrigin, SkillScope,
  SkillsSettingsInjected, SkillsSettingsProps,
} from './contract.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Skills settings copy. */
    'settings.skills': SkillsKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.skills'

/** Services required by the Settings registration and generated Remote face. */
export const inject = ['slots', 'locale', 'remote', 'remote.skillManager']

interface SkillManagerRemote {
  listOwned: (req: { scope: SkillScope; projectRoot?: string }) => Promise<RemoteResult<{
    items: readonly ManagedSkillSummary[]
  }>>
  listProject: (req: { projectRoot: string }) => Promise<RemoteResult<{
    items: readonly ManagedSkillSummary[]
  }>>
  setEnabled: (req: {
    name: string
    enabled: boolean
    sourcePath?: string
    projectRoot?: string
  }) => Promise<RemoteResult<SkillJobResult>>
}

/**
 * Register dictionaries and the Skills settings section.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-xmart-skills: dictionaries')
  const t = ctx.locale.bind(NS)
  const remote = (ctx.remote as { skillManager: SkillManagerRemote }).skillManager

  const injected = (): SkillsSettingsInjected => ({
    listOwned: async (scope, projectRoot) => unwrapRemote(
      'skillManager.listOwned',
      await remote.listOwned({ scope, ...projectRoot === undefined ? {} : { projectRoot } }),
    ).items,
    listProject: async projectRoot => unwrapRemote(
      'skillManager.listProject',
      await remote.listProject({ projectRoot }),
    ).items,
    setEnabled: async input => unwrapRemote(
      'skillManager.setEnabled',
      await remote.setEnabled(input),
    ),
  })

  ctx.slots.inject('settings.section', () => ctx.slots.register(
    {
      name: 'settings.section',
      id: 'skills',
      order: 22,
      label: () => t('nav'),
      locale: NS,
      inject: injected,
    },
    SkillsSettingsSection,
  ))
}
