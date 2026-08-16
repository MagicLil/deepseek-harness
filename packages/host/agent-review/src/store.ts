/** Persist review indexes and shadow file bodies under the harness home. */

import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type { ReviewSession, ReviewTurn } from './types.ts'

const ROOT = 'agent-review'

/** Absolute directory for one session's review artifacts. */
export function sessionDir(sessionId: string, dshHome?: string): string {
  return join(resolveDshHome(dshHome), ROOT, sanitizeId(sessionId))
}

/** Absolute path of the session index JSON. */
export function indexPath(sessionId: string, dshHome?: string): string {
  return join(sessionDir(sessionId, dshHome), 'index.json')
}

/** Absolute path of one shadow body. */
export function shadowPath(sessionId: string, shadowKey: string, dshHome?: string): string {
  return join(sessionDir(sessionId, dshHome), 'shadows', shadowKey)
}

/**
 * Stable relative key for a path in a turn.
 * @param turn - turn number.
 * @param path - absolute path.
 */
export function makeShadowKey(turn: number, path: string): string {
  const digest = createHash('sha256').update(path, 'utf8').digest('hex').slice(0, 24)
  return `${turn}/${digest}.txt`
}

function sanitizeId(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9._-]+/g, '_')
}

/**
 * Load the durable index, or an empty session when missing/corrupt.
 * @param sessionId - session id.
 * @param dshHome - optional home override.
 */
export async function loadIndex(sessionId: string, dshHome?: string): Promise<ReviewSession> {
  try {
    const raw = JSON.parse(await readFile(indexPath(sessionId, dshHome), 'utf8')) as Partial<ReviewSession>
    const turns = Array.isArray(raw.turns) ? raw.turns.filter(isTurn) : []
    return { sessionId, turns }
  } catch {
    return { sessionId, turns: [] }
  }
}

function isTurn(value: unknown): value is ReviewTurn {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return typeof row.turn === 'number' && typeof row.shellMaybeMutated === 'boolean' && Array.isArray(row.files)
}

/**
 * Write the index atomically (best-effort mkdir).
 * @param session - full session document.
 * @param dshHome - optional home override.
 */
export async function saveIndex(session: ReviewSession, dshHome?: string): Promise<void> {
  const path = indexPath(session.sessionId, dshHome)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(session)}\n`, 'utf8')
}

/**
 * Persist shadow text for one key.
 * @param sessionId - session id.
 * @param shadowKey - relative key.
 * @param text - before contents.
 * @param dshHome - optional home override.
 */
export async function writeShadow(
  sessionId: string,
  shadowKey: string,
  text: string,
  dshHome?: string,
): Promise<void> {
  const path = shadowPath(sessionId, shadowKey, dshHome)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, text, 'utf8')
}

/**
 * Read shadow text, or null when missing.
 * @param sessionId - session id.
 * @param shadowKey - relative key.
 * @param dshHome - optional home override.
 */
export async function readShadow(
  sessionId: string,
  shadowKey: string,
  dshHome?: string,
): Promise<string | null> {
  if (shadowKey.length === 0) return ''
  try {
    return await readFile(shadowPath(sessionId, shadowKey, dshHome), 'utf8')
  } catch {
    return null
  }
}

/**
 * Delete one shadow file if present.
 * @param sessionId - session id.
 * @param shadowKey - relative key.
 * @param dshHome - optional home override.
 */
export async function deleteShadow(
  sessionId: string,
  shadowKey: string,
  dshHome?: string,
): Promise<void> {
  if (shadowKey.length === 0) return
  try {
    await rm(shadowPath(sessionId, shadowKey, dshHome), { force: true })
  } catch {
    // ignore
  }
}
