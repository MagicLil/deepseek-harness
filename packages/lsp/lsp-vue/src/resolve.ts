/**
 * Resolve the bundled Vue language-server entry, its TypeScript SDK, and the
 * Node binary that must spawn it (Electron's `process.execPath` is not Node).
 * @module @deepseek-ai/dsh-lsp-vue/resolve
 */

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'

/** Process facts tests can override without mutating `process`. */
export interface NodeLaunchInternals {
  /** Ambient env (defaults to `process.env`). */
  readonly env?: NodeJS.ProcessEnv
  /** `process.versions` (defaults to the real one). */
  readonly versions?: NodeJS.ProcessVersions
  /** `process.execPath` (defaults to the real one). */
  readonly execPath?: string
}

/** How to launch a Node script under this host. */
export interface NodeLaunch {
  /** Absolute Node (or Electron-as-Node) executable. */
  readonly command: string
  /** Extra env merged onto the child (may set `ELECTRON_RUN_AS_NODE`). */
  readonly extraEnv: Record<string, string>
}

/**
 * Pick the Node binary that should run `@vue/language-server`.
 * Desktop relaunch records `DSH_NODE_EXEC_PATH`; packaged Electron without
 * that fact falls back to `electron.exe` + `ELECTRON_RUN_AS_NODE`.
 * @param internals - process-fact overrides for tests.
 */
export function nodeLaunch(internals: NodeLaunchInternals = {}): NodeLaunch {
  const env = internals.env ?? process.env
  const versions = internals.versions ?? process.versions
  const execPath = internals.execPath ?? process.execPath
  const nodeExecPath = env.DSH_NODE_EXEC_PATH
  const electron = versions.electron
  if (electron !== undefined && typeof nodeExecPath === 'string' && nodeExecPath !== '') {
    return { command: nodeExecPath, extraEnv: {} }
  }
  if (electron !== undefined) {
    return { command: execPath, extraEnv: { ELECTRON_RUN_AS_NODE: '1' } }
  }
  return { command: execPath, extraEnv: {} }
}

/** Bundled Vue language-server script and the TypeScript lib it must load. */
export interface VueRuntime {
  /** Absolute path to `vue-language-server.js`. */
  readonly bin: string
  /** Absolute path to `typescript/lib` (passed as `initializationOptions.typescript.tsdk`). */
  readonly tsdk: string
}

/** `require` face used to resolve workspace packages (tests inject a stub). */
export type PackageResolver = {
  resolve: (id: string) => string
}

/**
 * Resolve this package's `@vue/language-server` bin and `typescript/lib`.
 * @param requireFn - module resolver; defaults to this package's `createRequire`.
 */
export function resolveVueRuntime(requireFn: PackageResolver = createRequire(import.meta.url)): VueRuntime {
  const tsPkg = requireFn.resolve('typescript/package.json')
  const tsdk = join(dirname(tsPkg), 'lib')
  const vuePkg = requireFn.resolve('@vue/language-server/package.json')
  const bin = join(dirname(vuePkg), 'bin', 'vue-language-server.js')
  if (!existsSync(bin)) {
    throw new Error(`lsp-vue: @vue/language-server bin missing at ${bin}`)
  }
  if (!existsSync(tsdk)) {
    throw new Error(`lsp-vue: typescript/lib missing at ${tsdk}`)
  }
  return { bin, tsdk }
}

/**
 * Build the no-shell argv for one Vue language-server process.
 * @param runtime - resolved bin + tsdk.
 * @param launch - Node command chosen for this host.
 */
export function vueServerArgv(runtime: VueRuntime, launch: NodeLaunch): {
  command: string
  args: string[]
  extraEnv: Record<string, string>
} {
  return {
    command: launch.command,
    args: [runtime.bin, '--stdio', `--tsdk=${runtime.tsdk}`],
    extraEnv: launch.extraEnv,
  }
}
