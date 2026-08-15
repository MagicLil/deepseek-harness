/**
 * X-Mart marketplace plugin: registers Plugins and Extensions activities
 * on `ctx.xmartWorkbench`. Components never see ctx.
 */
import { createElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-xmart-workbench/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { DshPluginCard, MarketplaceJobResult, VsixCard } from './contract.ts'
import { ExtensionsIcon, PluginsIcon } from './icons.tsx'
import { MarketplacePane } from './MarketplacePane.tsx'
import { en, zh, type MarketplaceKey } from './locales.ts'
import { unwrapRemote, type RemoteResult } from './unwrap.ts'

export type { MarketplaceKey } from './locales.ts'
export type {
  DshPluginCard, MarketplaceJobResult, MarketplacePaneProps, MarketplaceRpc, VsixCard, VsixCompatibility,
} from './contract.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Marketplace sidebar copy. */
    'marketplace': MarketplaceKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'marketplace'

/** Services required by activity registration and the generated Remote face. */
export const inject = ['slots', 'locale', 'xmartWorkbench', 'remote', 'remote.marketplace']

interface MarketplaceRemote {
  searchPlugins: (req: { query: string; locale?: string }) => Promise<RemoteResult<{
    query: string
    items: readonly DshPluginCard[]
  }>>
  listInstalledPlugins: (req: { locale?: string }) => Promise<RemoteResult<{
    query: string
    items: readonly DshPluginCard[]
  }>>
  installPlugin: (req: { spec: string; allowBuilds?: boolean }) => Promise<RemoteResult<MarketplaceJobResult>>
  uninstallPlugin: (req: { name: string }) => Promise<RemoteResult<MarketplaceJobResult>>
  searchExtensions: (req: { query: string }) => Promise<RemoteResult<{
    query: string
    items: readonly VsixCard[]
  }>>
  listInstalledExtensions: () => Promise<RemoteResult<{ query: string; items: readonly VsixCard[] }>>
  installExtension: (req: { id: string; downloadUrl?: string }) => Promise<RemoteResult<MarketplaceJobResult>>
  uninstallExtension: (req: { id: string }) => Promise<RemoteResult<MarketplaceJobResult>>
}

/**
 * Register dictionaries and the two marketplace activities.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-xmart-marketplace: dictionaries')
  const t = ctx.locale.bind(NS)
  const locale = () => ctx.locale.getLocale().active === 'en' ? 'en' : 'zh'
  const remote = (ctx.remote as { marketplace: MarketplaceRemote }).marketplace

  const rpc = {
    searchPlugins: async (query: string) => unwrapRemote(
      'marketplace.searchPlugins',
      await remote.searchPlugins({ query, locale: locale() }),
    ).items,
    listInstalledPlugins: async () => unwrapRemote(
      'marketplace.listInstalledPlugins',
      await remote.listInstalledPlugins({ locale: locale() }),
    ).items,
    installPlugin: async (spec: string, allowBuilds: boolean): Promise<MarketplaceJobResult> => unwrapRemote(
      'marketplace.installPlugin',
      await remote.installPlugin({ spec, allowBuilds }),
    ),
    uninstallPlugin: async (name: string): Promise<MarketplaceJobResult> => unwrapRemote(
      'marketplace.uninstallPlugin',
      await remote.uninstallPlugin({ name }),
    ),
    searchExtensions: async (query: string) => unwrapRemote(
      'marketplace.searchExtensions',
      await remote.searchExtensions({ query }),
    ).items,
    listInstalledExtensions: async () => unwrapRemote(
      'marketplace.listInstalledExtensions',
      await remote.listInstalledExtensions(),
    ).items,
    installExtension: async (id: string, downloadUrl?: string): Promise<MarketplaceJobResult> => unwrapRemote(
      'marketplace.installExtension',
      await remote.installExtension({ id, ...downloadUrl === undefined ? {} : { downloadUrl } }),
    ),
    uninstallExtension: async (id: string): Promise<MarketplaceJobResult> => unwrapRemote(
      'marketplace.uninstallExtension',
      await remote.uninstallExtension({ id }),
    ),
  }

  ctx.effect(() => ctx.xmartWorkbench.registerActivity({
    id: 'plugins',
    title: () => t('activity.plugins'),
    order: 30,
    icon: PluginsIcon,
    component: props => createElement(MarketplacePane, { ...props, kind: 'plugins', t, ...rpc }),
  }), 'ui-xmart-marketplace: plugins activity')

  ctx.effect(() => ctx.xmartWorkbench.registerActivity({
    id: 'extensions',
    title: () => t('activity.extensions'),
    order: 40,
    icon: ExtensionsIcon,
    component: props => createElement(MarketplacePane, { ...props, kind: 'extensions', t, ...rpc }),
  }), 'ui-xmart-marketplace: extensions activity')
}
