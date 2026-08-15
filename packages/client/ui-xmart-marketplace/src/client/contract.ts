/** Injected RPC + copy for the marketplace panes. Components never see ctx. */

import type { TabBodyProps } from '@deepseek-ai/dsh-client-ui-xmart-workbench/client'
import type { MarketplaceKey } from './locales.ts'

/** How far this product can run a downloaded VS Code extension. */
export type VsixCompatibility = 'pending-host' | 'unsupported' | 'needs-node-host'

/** One DSH community plugin card. */
export interface DshPluginCard {
  readonly id: string
  readonly name: string
  readonly owner: string
  readonly description: string
  readonly category: string
  readonly installSpec: string
  readonly stars: number
  readonly installed: boolean
  readonly desktopCompatible: boolean
  readonly incompatibilityReason?: string
}

/** One Open VSX / local vsix card. */
export interface VsixCard {
  readonly id: string
  readonly displayName: string
  readonly publisher: string
  readonly description: string
  readonly verified: boolean
  readonly installed: boolean
  readonly compatibility: VsixCompatibility
  readonly version?: string
  readonly downloadUrl?: string
}

/** Install / uninstall outcome. */
export interface MarketplaceJobResult {
  readonly ok: boolean
  readonly logs: string
  readonly needsRestart: boolean
  readonly error?: string
}

/** RPC closed over from apply. */
export interface MarketplaceRpc {
  searchPlugins: (query: string) => Promise<readonly DshPluginCard[]>
  listInstalledPlugins: () => Promise<readonly DshPluginCard[]>
  installPlugin: (spec: string, allowBuilds: boolean) => Promise<MarketplaceJobResult>
  uninstallPlugin: (name: string) => Promise<MarketplaceJobResult>
  searchExtensions: (query: string) => Promise<readonly VsixCard[]>
  listInstalledExtensions: () => Promise<readonly VsixCard[]>
  installExtension: (id: string, downloadUrl?: string) => Promise<MarketplaceJobResult>
  uninstallExtension: (id: string) => Promise<MarketplaceJobResult>
}

/** Props for either marketplace pane. */
export type MarketplacePaneProps = TabBodyProps & MarketplaceRpc & {
  kind: 'plugins' | 'extensions'
  t: (key: MarketplaceKey) => string
}
