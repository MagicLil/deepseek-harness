/** Persist `{ enabled, port, token }` under the harness home. */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { createToken } from './token.ts'
import type { LanPersist } from './types.ts'

const FILE = 'xmart-lan.json'
const DEFAULT_PORT = 3080

/** Absolute path of the persist file. */
export function persistPath(dshHome?: string): string {
  return join(resolveDshHome(dshHome), FILE)
}

/** Default closed switch with a minted token. */
export function defaultPersist(): LanPersist {
  return { enabled: false, port: DEFAULT_PORT, token: createToken() }
}

function asPort(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
    ? value
    : DEFAULT_PORT
}

/**
 * Load persist or mint defaults. Corrupt JSON becomes defaults.
 * @param dshHome - optional harness home override.
 */
export async function loadPersist(dshHome?: string): Promise<LanPersist> {
  try {
    const raw = JSON.parse(await readFile(persistPath(dshHome), 'utf8')) as Partial<LanPersist>
    const token = typeof raw.token === 'string' && raw.token.length > 0 ? raw.token : createToken()
    return {
      enabled: raw.enabled === true,
      port: asPort(raw.port),
      token,
    }
  } catch {
    return defaultPersist()
  }
}

/**
 * Write persist, creating the home directory when needed.
 * @param next - fields to store.
 * @param dshHome - optional harness home override.
 */
export async function savePersist(next: LanPersist, dshHome?: string): Promise<void> {
  const path = persistPath(dshHome)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(next)}\n`, 'utf8')
}
