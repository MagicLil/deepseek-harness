/**
 * Give the Electron main process a real Node binary and a PATH `dsh` shim.
 *
 * Unpackaged `dsh desktop` records both in `relaunch.ts`. A double-clicked
 * NSIS/portable exe never runs that path, so this module is the packaged
 * source of truth: bundled `resources/node` plus the compiled CLI entry.
 * @module @deepseek-ai/dsh-desktop/runtime-node
 */

import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { prependPath, writeCliShim, type CliShimSpec } from './cli-shim.ts'

/** Facts {@link installDesktopRuntime} needs to find Node and write the shim. */
export interface DesktopRuntimeFacts {
  /** Process env to mutate (`DSH_NODE_EXEC_PATH` and PATH). */
  readonly env: NodeJS.ProcessEnv
  /** Electron `process.resourcesPath`. */
  readonly resourcesPath: string
  /** Host platform (selects `node.exe` vs `node`). */
  readonly platform: NodeJS.Platform
  /** Already-recorded Node (`DSH_NODE_EXEC_PATH` from relaunch). */
  readonly existingNode?: string | undefined
  /** Absolute compiled CLI entry (`@deepseek-ai/dsh` → `lib/bin.js`). */
  readonly cliEntry?: string | undefined
  /** `existsSync` stand-in for tests. */
  readonly exists?: (path: string) => boolean
  /** `writeCliShim` stand-in for tests. */
  readonly writeShim?: (spec: CliShimSpec) => string
}

/** Node + shim directory after {@link installDesktopRuntime}. */
export interface DesktopRuntime {
  /** Absolute Node path, or `undefined` when none exists. */
  readonly node: string | undefined
  /** Directory prepended to PATH, or `undefined` when the shim was skipped. */
  readonly shimDir: string | undefined
}

/**
 * Absolute path of the Node binary shipped next to the Electron resources.
 * @param resourcesPath - Electron `process.resourcesPath`.
 * @param platform - host platform.
 */
export function bundledNodePath(resourcesPath: string, platform: NodeJS.Platform): string {
  return join(resourcesPath, 'node', platform === 'win32' ? 'node.exe' : 'node')
}

/**
 * Prefer a still-present recorded Node; otherwise the bundled installer Node.
 * @param facts - recorded path, resources root, and an exists probe.
 */
export function resolveDesktopNodePath(facts: {
  readonly existingNode?: string | undefined
  readonly resourcesPath: string
  readonly platform: NodeJS.Platform
  readonly exists: (path: string) => boolean
}): string | undefined {
  const recorded = facts.existingNode
  if (typeof recorded === 'string' && recorded !== '' && facts.exists(recorded)) {
    return recorded
  }
  const bundled = bundledNodePath(facts.resourcesPath, facts.platform)
  return facts.exists(bundled) ? bundled : undefined
}

/**
 * Resolve the compiled `dsh` CLI entry from a module URL that can see the
 * `@deepseek-ai/dsh` dependency (desktop `electron-main` or its tests).
 * @param fromUrl - `import.meta.url` of the caller.
 */
export function resolveDesktopCliEntry(fromUrl: string): string | undefined {
  try {
    return createRequire(fromUrl).resolve('@deepseek-ai/dsh')
  } catch {
    return undefined
  }
}

/**
 * Set `DSH_NODE_EXEC_PATH` and prepend a PATH `dsh` shim when Node + CLI exist.
 * @param facts - env, resources, optional recorded Node, and CLI entry.
 */
export function installDesktopRuntime(facts: DesktopRuntimeFacts): DesktopRuntime {
  const exists = facts.exists ?? existsSync
  const node = resolveDesktopNodePath({
    existingNode: facts.existingNode ?? facts.env.DSH_NODE_EXEC_PATH,
    resourcesPath: facts.resourcesPath,
    platform: facts.platform,
    exists,
  })
  if (node === undefined) return { node: undefined, shimDir: undefined }
  facts.env.DSH_NODE_EXEC_PATH = node
  const cliEntry = facts.cliEntry
  if (cliEntry === undefined || cliEntry === '' || !exists(cliEntry)) {
    return { node, shimDir: undefined }
  }
  const write = facts.writeShim ?? ((spec: CliShimSpec) => writeCliShim(spec))
  const shimDir = write({ node, execArgv: [], entry: cliEntry })
  prependPath(facts.env, shimDir)
  return { node, shimDir }
}
