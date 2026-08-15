import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'
import { spawnSubprocess } from '@deepseek-ai/dsh-subprocess-local/src/spawn.ts'
import { scrubbedParentEnv } from '@deepseek-ai/dsh-subprocess'
import { VueLspSession } from '../src/session.ts'
import type { VueSessionSpec } from '../src/session.ts'
import type { VueRuntime } from '../src/resolve.ts'

export const fixtureServer = fileURLToPath(new URL('./fixture-server.ts', import.meta.url))

/** Fixture runtime so the pool does not resolve the real Vue language server. */
export function fixtureRuntime(): VueRuntime {
  return { bin: fixtureServer, tsdk: fixtureServer }
}

/** Session pointed at the fake stdio server. */
export function makeSession(
  cwd: string,
  env: Record<string, string> = {},
  overrides: Partial<VueSessionSpec> = {},
): VueLspSession {
  return new VueLspSession({
    command: process.execPath,
    args: [fixtureServer],
    cwd,
    workspacePath: cwd,
    workspaceUri: pathToFileURL(cwd).href,
    env: { ...scrubbedParentEnv(), ...env },
    configuration: { setting: 1 },
    initializationOptions: { typescript: { tsdk: fixtureServer } },
    maxMessageBytes: 16_000_000,
    maxStderrBytes: 100_000,
    shutdownTimeoutMs: 400,
    killGraceMs: 200,
    ...overrides,
  }, spawnSubprocess)
}
