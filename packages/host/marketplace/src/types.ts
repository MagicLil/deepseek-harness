/** Shared marketplace payloads. JSON-only so they cross the Remote wire. */

/** One DSH community plugin card. */
export interface DshPluginCard {
  /** Catalog identity (`owner/name`). */
  readonly id: string
  /** Package or repo name. */
  readonly name: string
  /** GitHub owner. */
  readonly owner: string
  /** Localized description (UI language already chosen by the Host). */
  readonly description: string
  /** Catalog category id. */
  readonly category: string
  /** Spec passed to `pnpm add` (github: or npm name). */
  readonly installSpec: string
  /** GitHub star count when the catalog has one. */
  readonly stars: number
  /** True when the current profile lists this package. */
  readonly installed: boolean
  /** False when the plugin needs a webserver or WebSocket. */
  readonly desktopCompatible: boolean
  /** Why install is refused, when it is. */
  readonly incompatibilityReason?: string
}

/** Search result for DSH plugins. */
export interface DshPluginSearchResult {
  /** Echo of the query. */
  readonly query: string
  /** Matching cards. */
  readonly items: readonly DshPluginCard[]
}

/** Install / uninstall outcome. */
export interface MarketplaceJobResult {
  /** True when the child process exited 0. */
  readonly ok: boolean
  /** Combined stdout and stderr. */
  readonly logs: string
  /** True after a successful DSH plugin mutation (desktop must relaunch). */
  readonly needsRestart: boolean
  /** Short error for the dialog, when `ok` is false. */
  readonly error?: string
}

/** How far this product can run a downloaded VS Code extension. */
export type VsixCompatibility = 'pending-host' | 'unsupported' | 'needs-node-host'

/** One Open VSX / local vsix card. */
export interface VsixCard {
  /** `publisher.name`. */
  readonly id: string
  /** Marketplace display name. */
  readonly displayName: string
  /** Publisher id. */
  readonly publisher: string
  /** Short description. */
  readonly description: string
  /** Open VSX verified flag. */
  readonly verified: boolean
  /** True when a vsix is on disk under `~/.dsh/extensions`. */
  readonly installed: boolean
  /** Compatibility class for this product. */
  readonly compatibility: VsixCompatibility
  /** Latest version string when known. */
  readonly version?: string
  /** Open VSX download URL when installing. */
  readonly downloadUrl?: string
}

/** Search result for VS Code extensions. */
export interface VsixSearchResult {
  /** Echo of the query. */
  readonly query: string
  /** Matching cards. */
  readonly items: readonly VsixCard[]
}

/** Cordis plugin config for the marketplace Host. */
export interface MarketplaceConfig {
  /** Profile name (`desktop` / `web`). */
  readonly profile?: string
}

/** Search DSH plugins. */
export interface PluginQueryRequest {
  /** Keyword; empty returns the full catalog. */
  readonly query: string
  /** `zh` or `en`; default `zh`. */
  readonly locale?: string
}

/** List installed DSH plugins. */
export interface PluginListRequest {
  /** `zh` or `en`; default `zh`. */
  readonly locale?: string
}

/** Install a DSH plugin into the running profile. */
export interface PluginInstallRequest {
  /** `pnpm add` spec (`github:owner/name` or npm name). */
  readonly spec: string
  /** When true, allow lifecycle scripts. Default false. */
  readonly allowBuilds?: boolean
}

/** Uninstall a DSH plugin from the running profile. */
export interface PluginUninstallRequest {
  /** Package name in the profile `dependencies`. */
  readonly name: string
}

/** Search Open VSX. */
export interface VsixQueryRequest {
  /** Keyword; empty returns the recommended set plus installed. */
  readonly query: string
}

/** Download a vsix into `~/.dsh/extensions`. */
export interface VsixInstallRequest {
  /** `publisher.name`. */
  readonly id: string
  /** Open VSX download URL when already known. */
  readonly downloadUrl?: string
}

/** Remove a stored vsix. */
export interface VsixUninstallRequest {
  /** `publisher.name`. */
  readonly id: string
}
