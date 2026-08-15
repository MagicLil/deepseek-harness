/**
 * Resolve the bundled `typescript-language-server` and this package's TypeScript SDK.
 * @module @deepseek-ai/dsh-lsp-languages/resolve-typescript
 */

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { nodeLaunch } from './node-launch.ts'
import type { NodeLaunch, NodeLaunchInternals } from './node-launch.ts'

/** Bundled TypeScript language-server script and the SDK it should load. */
export interface TypescriptRuntime {
  /** Absolute path to the language-server CLI. */
  readonly bin: string
  /** Absolute path to `typescript/lib`. */
  readonly tsdk: string
}

/** `require` face used to resolve workspace packages (tests inject a stub). */
export type PackageResolver = {
  resolve: (id: string) => string
}

/**
 * Resolve this package's `typescript-language-server` CLI and `typescript/lib`.
 * @param requireFn - module resolver; defaults to this package's `createRequire`.
 */
export function resolveTypescriptRuntime(
  requireFn: PackageResolver = createRequire(import.meta.url),
): TypescriptRuntime {
  const tsPkg = requireFn.resolve('typescript/package.json')
  const tsdk = join(dirname(tsPkg), 'lib')
  const serverPkg = requireFn.resolve('typescript-language-server/package.json')
  const bin = join(dirname(serverPkg), 'lib', 'cli.mjs')
  if (!existsSync(bin)) {
    throw new Error(`lsp-languages: typescript-language-server CLI missing at ${bin}`)
  }
  if (!existsSync(tsdk)) {
    throw new Error(`lsp-languages: typescript/lib missing at ${tsdk}`)
  }
  return { bin, tsdk }
}

/**
 * Build the no-shell argv for one TypeScript language-server process.
 * @param runtime - resolved bin + tsdk.
 * @param launch - Node command chosen for this host.
 */
export function typescriptServerArgv(runtime: TypescriptRuntime, launch: NodeLaunch): {
  command: string
  args: string[]
  extraEnv: Record<string, string>
  initializationOptions: { tsserver: { path: string } }
} {
  return {
    command: launch.command,
    args: [runtime.bin, '--stdio'],
    extraEnv: launch.extraEnv,
    initializationOptions: { tsserver: { path: join(runtime.tsdk, 'tsserver.js') } },
  }
}

/**
 * Resolve this package's TypeScript language-server and the Node command.
 * @param internals - process-fact overrides for tests.
 * @param requireFn - module resolver; defaults to this package's `createRequire`.
 */
export function typescriptSessionLaunch(
  internals?: NodeLaunchInternals,
  requireFn?: PackageResolver,
): {
  command: string
  args: string[]
  extraEnv: Record<string, string>
  initializationOptions: { tsserver: { path: string } }
} {
  return typescriptServerArgv(resolveTypescriptRuntime(requireFn), nodeLaunch(internals))
}
