/**
 * X-Mart LAN settings plugin. Registers a `settings.section` page.
 * Components never see ctx.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { LanSettingsInjected, LanStatus } from './contract.ts'
import { LanSettingsSection } from './LanSettingsSection.tsx'
import { en, zh, type LanKey } from './locales.ts'

export type { LanKey } from './locales.ts'
export type { LanSettingsInjected, LanSettingsProps, LanStatus } from './contract.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** LAN settings copy. */
    'settings.lan': LanKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.lan'

/** Services required by the Settings registration and generated Remote face. */
export const inject = ['slots', 'locale', 'remote', 'remote.xmartLan']

interface XmartLanRemote {
  status: () => Promise<
    { ok: true; value: LanStatus } | { ok: false; error: { code: string; message: string } }
  >
  setEnabled: (req: { enabled: boolean }) => Promise<
    { ok: true; value: LanStatus } | { ok: false; error: { code: string; message: string } }
  >
  setPort: (req: { port: number }) => Promise<
    { ok: true; value: LanStatus } | { ok: false; error: { code: string; message: string } }
  >
  rotateToken: () => Promise<
    { ok: true; value: LanStatus } | { ok: false; error: { code: string; message: string } }
  >
}

type LanRemoteResult =
  | { ok: true; value: LanStatus }
  | { ok: false; error: { code: string; message: string } }

function unwrap(label: string, result: LanRemoteResult): LanStatus {
  if (!result.ok) throw new Error(`${label} failed: ${result.error.code}: ${result.error.message}`)
  return result.value
}

/**
 * Register dictionaries and the LAN settings section.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-xmart-lan: dictionaries')
  const t = ctx.locale.bind(NS)
  const remote = (ctx.remote as unknown as { xmartLan: XmartLanRemote }).xmartLan

  const injected = (): LanSettingsInjected => ({
    status: async () => unwrap('xmartLan.status', await remote.status()),
    setEnabled: async enabled => unwrap('xmartLan.setEnabled', await remote.setEnabled({ enabled })),
    setPort: async port => unwrap('xmartLan.setPort', await remote.setPort({ port })),
    rotateToken: async () => unwrap('xmartLan.rotateToken', await remote.rotateToken()),
    copyText: async (text) => { await navigator.clipboard.writeText(text) },
  })

  ctx.slots.inject('settings.section', () => ctx.slots.register(
    {
      name: 'settings.section',
      id: 'lan',
      order: 24,
      label: () => t('nav'),
      locale: NS,
      inject: injected,
    },
    LanSettingsSection,
  ))
}
