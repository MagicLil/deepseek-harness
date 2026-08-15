/**
 * Classify a VS Code extension for this product (AMD Monaco, no remote authority).
 */
import type { VsixCompatibility } from './types.ts'

const UNSUPPORTED_IDS = new Set([
  'ms-vscode-remote.remote-ssh',
  'ms-vscode-remote.remote-containers',
  'ms-vscode-remote.remote-wsl',
  'ms-vscode-remote.remote-ssh-edit',
  'ms-ceintl.vscode-language-pack-zh-hans',
  'ms-ceintl.vscode-language-pack-zh-hant',
])

const UNSUPPORTED_PUBLISHERS = new Set([
  'anysphere',
  'kilocode',
  'kilo-code',
])

const UNSUPPORTED_NAME = /remote-ssh|remote-containers|remote-wsl|dev-containers|language-pack|roo-cline|kimi-code|kilo-code|cursor-/i

/** Subset of a vsix `package.json` used for classification. */
export interface VsixManifest {
  readonly name?: string
  readonly publisher?: string
  readonly displayName?: string
  readonly description?: string
  readonly main?: string
  readonly browser?: string
  readonly contributes?: {
    readonly languages?: unknown
    readonly grammars?: unknown
    readonly themes?: unknown
    readonly iconThemes?: unknown
    readonly localizations?: unknown
  }
}

/**
 * Build `publisher.name` from Open VSX fields.
 * @param publisher - namespace.
 * @param name - extension name.
 */
export function vsixId(publisher: string, name: string): string {
  return `${publisher}.${name}`
}

/**
 * Classify an extension. Unsupported ids never install.
 * @param id - `publisher.name`.
 * @param manifest - optional package.json.
 */
export function classifyVsix(id: string, manifest?: VsixManifest): VsixCompatibility {
  const lower = id.toLocaleLowerCase()
  const [publisher = '', name = ''] = id.split('.')
  if (UNSUPPORTED_IDS.has(lower) || UNSUPPORTED_PUBLISHERS.has(publisher.toLocaleLowerCase())) {
    return 'unsupported'
  }
  if (UNSUPPORTED_NAME.test(name) || UNSUPPORTED_NAME.test(id)) {
    return 'unsupported'
  }
  if (manifest?.contributes?.localizations !== undefined) {
    return 'unsupported'
  }
  if (typeof manifest?.main === 'string' && manifest.main.length > 0 && manifest.browser === undefined) {
    return 'needs-node-host'
  }
  return 'pending-host'
}

/**
 * True when the install button must stay disabled.
 * @param compatibility - class.
 */
export function installDisabled(compatibility: VsixCompatibility): boolean {
  return compatibility === 'unsupported'
}
