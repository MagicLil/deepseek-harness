import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'
import { spawnSubprocess } from '@deepseek-ai/dsh-subprocess-local/src/spawn.ts'
import { scrubbedParentEnv } from '@deepseek-ai/dsh-subprocess'
import { LspProviderId } from '@deepseek-ai/dsh-lsp'
import { PersistentLspSession } from '../src/session.ts'
import type { PersistentSessionSpec } from '../src/session.ts'
import { PersistentLspPool } from '../src/pool.ts'
import type { PersistentLspPoolOptions } from '../src/pool.ts'
import { TS_EXTENSION_TO_LANGUAGE, JAVA_EXTENSION_TO_LANGUAGE } from '../src/protocol.ts'
import type { FileSystem } from '@deepseek-ai/dsh-fs'

export const fixtureServer = fileURLToPath(new URL('./fixture-server.ts', import.meta.url))

/** Session pointed at the fake stdio server. */
export function makeSession(
  cwd: string,
  env: Record<string, string> = {},
  overrides: Partial<PersistentSessionSpec> = {},
): PersistentLspSession {
  return new PersistentLspSession({
    command: process.execPath,
    args: [fixtureServer],
    cwd,
    workspacePath: cwd,
    workspaceUri: pathToFileURL(cwd).href,
    env: { ...scrubbedParentEnv(), ...env },
    configuration: { setting: 1 },
    initializationOptions: { typescript: { tsdk: fixtureServer } },
    extensionToLanguage: TS_EXTENSION_TO_LANGUAGE,
    maxMessageBytes: 16_000_000,
    maxStderrBytes: 100_000,
    shutdownTimeoutMs: 400,
    killGraceMs: 200,
    ...overrides,
  }, spawnSubprocess)
}

/** Pool pointed at the fake stdio server. */
export function makePoolOptions(
  fs: FileSystem,
  env: Record<string, string> = {},
  kind: 'typescript' | 'java' = 'typescript',
): PersistentLspPoolOptions {
  return {
    id: LspProviderId(kind),
    extensionToLanguage: kind === 'java' ? JAVA_EXTENSION_TO_LANGUAGE : TS_EXTENSION_TO_LANGUAGE,
    fs,
    spawn: spawnSubprocess,
    env: { ...scrubbedParentEnv(), ...env },
    launch: async () => ({
      command: process.execPath,
      args: [fixtureServer],
      extraEnv: {},
    }),
  }
}

/** Construct a fixture-backed pool. */
export function makePool(
  fs: FileSystem,
  env: Record<string, string> = {},
  kind: 'typescript' | 'java' = 'typescript',
): PersistentLspPool {
  return new PersistentLspPool(makePoolOptions(fs, env, kind))
}
