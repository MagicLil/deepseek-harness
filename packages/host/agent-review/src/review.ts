/** In-memory review engine: capture, settle, accept, revert, diff. */

import { contentHash } from './hash.ts'
import {
  deleteShadow,
  loadIndex,
  makeShadowKey,
  readShadow,
  saveIndex,
  writeShadow,
} from './store.ts'
import type {
  AgentReviewJobResult,
  ReviewDiffResult,
  ReviewFile,
  ReviewFileKind,
  ReviewSession,
} from './types.ts'
import { DEFAULT_MAX_SHADOW_BYTES } from './types.ts'

/** Disk IO the engine needs beyond shadow storage. */
export interface ReviewDisk {
  /**
   * Read UTF-8 file text.
   * @param path - absolute path.
   * @returns text, or null when the file does not exist.
   */
  readText(path: string): Promise<string | null>
  /**
   * Write UTF-8 file text (create parents as needed).
   * @param path - absolute path.
   * @param text - contents.
   */
  writeText(path: string, text: string): Promise<void>
  /**
   * Delete a file.
   * @param path - absolute path.
   */
  remove(path: string): Promise<void>
  /**
   * Byte length of a path when it exists as a regular file.
   * @param path - absolute path.
   */
  sizeOf(path: string): Promise<number | null>
}

/** Engine options. */
export interface ReviewEngineOptions {
  /** Harness home override. */
  dshHome?: string
  /** Max bytes to shadow. */
  maxShadowBytes?: number
  /** Workspace disk IO. */
  disk: ReviewDisk
}

/** Mutable turn row while editing an index in memory. */
type MutableTurn = {
  turn: number
  shellMaybeMutated: boolean
  files: ReviewFile[]
}

/** Mutable session document. */
type MutableSession = {
  sessionId: string
  turns: MutableTurn[]
}

function asMutable(session: ReviewSession): MutableSession {
  return {
    sessionId: session.sessionId,
    turns: session.turns.map(turn => ({
      turn: turn.turn,
      shellMaybeMutated: turn.shellMaybeMutated,
      files: [...turn.files],
    })),
  }
}

/**
 * Mutable per-session review controller backed by `~/.dsh/agent-review`.
 */
export class ReviewEngine {
  private readonly dshHome: string | undefined
  private readonly maxShadowBytes: number
  private readonly disk: ReviewDisk
  /** In-flight captures keyed by session|turn|path so settle can find them. */
  private readonly pendingCapture = new Map<string, true>()

  constructor(options: ReviewEngineOptions) {
    this.dshHome = options.dshHome
    this.maxShadowBytes = options.maxShadowBytes ?? DEFAULT_MAX_SHADOW_BYTES
    this.disk = options.disk
  }

  /**
   * Load the durable projection (newest turns first).
   * @param sessionId - session id.
   */
  async get(sessionId: string): Promise<ReviewSession> {
    return project(asMutable(await loadIndex(sessionId, this.dshHome)))
  }

  /**
   * First touch of a path in a turn: write shadow when possible.
   * @param sessionId - session id.
   * @param turn - open turn.
   * @param path - absolute path about to mutate.
   */
  async captureBefore(sessionId: string, turn: number, path: string): Promise<void> {
    const key = captureKey(sessionId, turn, path)
    if (this.pendingCapture.has(key)) return
    const session = asMutable(await loadIndex(sessionId, this.dshHome))
    const turnRow = ensureTurn(session, turn)
    if (turnRow.files.some(file => file.path === path)) {
      this.pendingCapture.set(key, true)
      return
    }
    const size = await this.disk.sizeOf(path)
    if (size !== null && size > this.maxShadowBytes) {
      turnRow.files.push({
        path,
        kind: 'update',
        status: 'irreversible',
        shadowKey: '',
        beforeHash: null,
        afterHash: null,
      })
      await saveIndex(session, this.dshHome)
      this.pendingCapture.set(key, true)
      return
    }
    const before = await this.disk.readText(path)
    if (before === null) {
      turnRow.files.push({
        path,
        kind: 'create',
        status: 'pending',
        shadowKey: '',
        beforeHash: null,
        afterHash: null,
      })
    } else {
      const shadowKey = makeShadowKey(turn, path)
      try {
        await writeShadow(sessionId, shadowKey, before, this.dshHome)
        turnRow.files.push({
          path,
          kind: 'update',
          status: 'pending',
          shadowKey,
          beforeHash: contentHash(before),
          afterHash: null,
        })
      } catch {
        turnRow.files.push({
          path,
          kind: 'update',
          status: 'irreversible',
          shadowKey: '',
          beforeHash: null,
          afterHash: null,
        })
      }
    }
    await saveIndex(session, this.dshHome)
    this.pendingCapture.set(key, true)
  }

  /**
   * First touch for a shell (or delete-tool) removal: shadow existing file as `delete`.
   * No-ops when the path is missing or already tracked this turn.
   * @param sessionId - session id.
   * @param turn - open turn.
   * @param path - absolute path about to be deleted.
   */
  async captureDelete(sessionId: string, turn: number, path: string): Promise<void> {
    const key = captureKey(sessionId, turn, path)
    if (this.pendingCapture.has(key)) return
    const session = asMutable(await loadIndex(sessionId, this.dshHome))
    const turnRow = ensureTurn(session, turn)
    if (turnRow.files.some(file => file.path === path)) {
      this.pendingCapture.set(key, true)
      return
    }
    const size = await this.disk.sizeOf(path)
    if (size === null) return
    if (size > this.maxShadowBytes) {
      turnRow.files.push({
        path,
        kind: 'delete',
        status: 'irreversible',
        shadowKey: '',
        beforeHash: null,
        afterHash: null,
      })
      await saveIndex(session, this.dshHome)
      this.pendingCapture.set(key, true)
      return
    }
    const before = await this.disk.readText(path)
    if (before === null) return
    const shadowKey = makeShadowKey(turn, path)
    try {
      await writeShadow(sessionId, shadowKey, before, this.dshHome)
      turnRow.files.push({
        path,
        kind: 'delete',
        status: 'pending',
        shadowKey,
        beforeHash: contentHash(before),
        afterHash: null,
      })
    } catch {
      turnRow.files.push({
        path,
        kind: 'delete',
        status: 'irreversible',
        shadowKey: '',
        beforeHash: null,
        afterHash: null,
      })
    }
    await saveIndex(session, this.dshHome)
    this.pendingCapture.set(key, true)
  }

  /**
   * Mark that a shell-like tool ran in this turn.
   * @param sessionId - session id.
   * @param turn - open turn.
   */
  async markShell(sessionId: string, turn: number): Promise<void> {
    const session = asMutable(await loadIndex(sessionId, this.dshHome))
    const turnRow = ensureTurn(session, turn)
    if (turnRow.shellMaybeMutated) return
    turnRow.shellMaybeMutated = true
    await saveIndex(session, this.dshHome)
  }

  /**
   * Persist dismissal of the shell-only warning for a turn.
   * A later `markShell` on the same turn raises the flag again.
   * @param sessionId - session id.
   * @param turn - turn number.
   */
  async dismissShell(sessionId: string, turn: number): Promise<AgentReviewJobResult> {
    const session = asMutable(await loadIndex(sessionId, this.dshHome))
    const turnRow = session.turns.find(row => row.turn === turn)
    if (turnRow === undefined) return { ok: false, error: 'not-found' }
    turnRow.shellMaybeMutated = false
    await saveIndex(session, this.dshHome)
    return { ok: true, review: project(session) }
  }

  /**
   * Import a mutation discovered after an opaque tool (ACP / subagent) finished.
   * No-ops when the path is already tracked this turn (write/edit won).
   * @param sessionId - session id.
   * @param turn - open turn.
   * @param path - absolute path.
   * @param kind - create / update / delete.
   * @param beforeText - pre-mutation body; null for create, or when unknown.
   */
  async observe(
    sessionId: string,
    turn: number,
    path: string,
    kind: ReviewFileKind,
    beforeText: string | null,
  ): Promise<void> {
    const session = asMutable(await loadIndex(sessionId, this.dshHome))
    const turnRow = ensureTurn(session, turn)
    if (turnRow.files.some(file => file.path === path)) return
    if (kind === 'create') {
      const after = await this.disk.readText(path)
      turnRow.files.push({
        path,
        kind: 'create',
        status: 'pending',
        shadowKey: '',
        beforeHash: null,
        afterHash: after === null ? null : contentHash(after),
      })
      await saveIndex(session, this.dshHome)
      return
    }
    if (beforeText === null || Buffer.byteLength(beforeText, 'utf8') > this.maxShadowBytes) {
      turnRow.files.push({
        path,
        kind,
        status: 'irreversible',
        shadowKey: '',
        beforeHash: null,
        afterHash: kind === 'delete' ? null : await afterHashOf(this.disk, path),
      })
      await saveIndex(session, this.dshHome)
      return
    }
    const shadowKey = makeShadowKey(turn, path)
    try {
      await writeShadow(sessionId, shadowKey, beforeText, this.dshHome)
    } catch {
      turnRow.files.push({
        path,
        kind,
        status: 'irreversible',
        shadowKey: '',
        beforeHash: null,
        afterHash: kind === 'delete' ? null : await afterHashOf(this.disk, path),
      })
      await saveIndex(session, this.dshHome)
      return
    }
    turnRow.files.push({
      path,
      kind,
      status: 'pending',
      shadowKey,
      beforeHash: contentHash(beforeText),
      afterHash: kind === 'delete' ? null : await afterHashOf(this.disk, path),
    })
    await saveIndex(session, this.dshHome)
  }

  /**
   * After a successful write/edit/delete, refresh afterHash (null when gone).
   * Failed first settles (or failed deletes that left the file) drop the row.
   * @param sessionId - session id.
   * @param turn - turn number.
   * @param path - absolute path.
   * @param ok - whether the tool succeeded.
   */
  async settle(sessionId: string, turn: number, path: string, ok: boolean): Promise<void> {
    const session = asMutable(await loadIndex(sessionId, this.dshHome))
    const turnRow = session.turns.find(row => row.turn === turn)
    if (turnRow === undefined) return
    const index = turnRow.files.findIndex(file => file.path === path)
    if (index < 0) return
    const file = turnRow.files[index]
    if (file === undefined) return
    if (!ok) {
      if (file.afterHash === null && (file.status === 'pending' || file.status === 'irreversible')) {
        turnRow.files.splice(index, 1)
        await deleteShadow(sessionId, file.shadowKey, this.dshHome)
        await saveIndex(session, this.dshHome)
      }
      this.pendingCapture.delete(captureKey(sessionId, turn, path))
      return
    }
    if (file.status === 'irreversible') {
      this.pendingCapture.delete(captureKey(sessionId, turn, path))
      return
    }
    const after = await this.disk.readText(path)
    if (file.kind === 'delete') {
      if (after !== null) {
        // Declared delete but file still on disk — drop the speculative row.
        turnRow.files.splice(index, 1)
        await deleteShadow(sessionId, file.shadowKey, this.dshHome)
        await saveIndex(session, this.dshHome)
        this.pendingCapture.delete(captureKey(sessionId, turn, path))
        return
      }
      turnRow.files[index] = { ...file, status: 'pending', afterHash: null }
      await saveIndex(session, this.dshHome)
      this.pendingCapture.delete(captureKey(sessionId, turn, path))
      return
    }
    turnRow.files[index] = {
      ...file,
      status: 'pending',
      afterHash: after === null ? null : contentHash(after),
    }
    await saveIndex(session, this.dshHome)
    this.pendingCapture.delete(captureKey(sessionId, turn, path))
  }

  /**
   * Accept one pending file (keep disk, drop shadow).
   * @param sessionId - session id.
   * @param turn - turn number.
   * @param path - absolute path.
   */
  async accept(sessionId: string, turn: number, path: string): Promise<AgentReviewJobResult> {
    const session = asMutable(await loadIndex(sessionId, this.dshHome))
    const file = findFile(session, turn, path)
    if (file === undefined) return { ok: false, error: 'not-found' }
    if (file.status !== 'pending' && file.status !== 'irreversible') {
      return { ok: false, error: 'not-pending' }
    }
    await deleteShadow(sessionId, file.shadowKey, this.dshHome)
    replaceFile(session, turn, path, { ...file, status: 'accepted', shadowKey: '' })
    await saveIndex(session, this.dshHome)
    return { ok: true, review: project(session) }
  }

  /**
   * Accept every pending/irreversible file in a turn.
   * @param sessionId - session id.
   * @param turn - turn number.
   */
  async acceptAll(sessionId: string, turn: number): Promise<AgentReviewJobResult> {
    const session = asMutable(await loadIndex(sessionId, this.dshHome))
    const turnRow = session.turns.find(row => row.turn === turn)
    if (turnRow === undefined) return { ok: false, error: 'not-found' }
    for (const file of [...turnRow.files]) {
      if (file.status !== 'pending' && file.status !== 'irreversible') continue
      await deleteShadow(sessionId, file.shadowKey, this.dshHome)
      replaceFile(session, turn, file.path, { ...file, status: 'accepted', shadowKey: '' })
    }
    await saveIndex(session, this.dshHome)
    return { ok: true, review: project(session) }
  }

  /**
   * Revert one file to its shadow (or delete a create).
   * @param sessionId - session id.
   * @param turn - turn number.
   * @param path - absolute path.
   * @param force - overwrite conflicting disk content.
   * @param dirtyPaths - absolute paths with unsaved editor drafts.
   */
  async revert(
    sessionId: string,
    turn: number,
    path: string,
    force: boolean = false,
    dirtyPaths: readonly string[] = [],
  ): Promise<AgentReviewJobResult> {
    const session = asMutable(await loadIndex(sessionId, this.dshHome))
    const file = findFile(session, turn, path)
    if (file === undefined) return { ok: false, error: 'not-found' }
    if (file.status !== 'pending') {
      return { ok: false, error: file.status === 'irreversible' ? 'irreversible' : 'not-pending' }
    }
    if (dirtyPaths.includes(path)) return { ok: false, error: 'dirty-editor' }
    const current = await this.disk.readText(path)
    const currentHash = current === null ? null : contentHash(current)
    if (
      (file.kind === 'create' && current === null)
      || (file.kind === 'delete' && current !== null && currentHash === file.beforeHash)
      || (file.kind !== 'create' && file.kind !== 'delete'
        && file.beforeHash !== null && currentHash === file.beforeHash)
    ) {
      await deleteShadow(sessionId, file.shadowKey, this.dshHome)
      replaceFile(session, turn, path, { ...file, status: 'reverted', shadowKey: '' })
      await saveIndex(session, this.dshHome)
      return { ok: true, review: project(session) }
    }
    const matchesAfter = file.kind === 'delete'
      ? current === null
      : file.afterHash !== null && currentHash === file.afterHash
    if (!force && !matchesAfter) {
      return { ok: false, error: 'conflict' }
    }
    try {
      if (file.kind === 'create') {
        if (current !== null) await this.disk.remove(path)
      } else {
        const before = await readShadow(sessionId, file.shadowKey, this.dshHome)
        if (before === null) return { ok: false, error: 'irreversible' }
        await this.disk.writeText(path, before)
      }
    } catch {
      return { ok: false, error: 'io-error' }
    }
    await deleteShadow(sessionId, file.shadowKey, this.dshHome)
    replaceFile(session, turn, path, { ...file, status: 'reverted', shadowKey: '' })
    await saveIndex(session, this.dshHome)
    return { ok: true, review: project(session) }
  }

  /**
   * Revert every pending file in a turn; skip conflicts unless force.
   * @param sessionId - session id.
   * @param turn - turn number.
   * @param force - overwrite conflicts.
   * @param dirtyPaths - unsaved editor paths.
   */
  async revertAll(
    sessionId: string,
    turn: number,
    force: boolean = false,
    dirtyPaths: readonly string[] = [],
  ): Promise<AgentReviewJobResult> {
    const session = asMutable(await loadIndex(sessionId, this.dshHome))
    const turnRow = session.turns.find(row => row.turn === turn)
    if (turnRow === undefined) return { ok: false, error: 'not-found' }
    const skipped: string[] = []
    for (const file of [...turnRow.files]) {
      if (file.status !== 'pending') continue
      const result = await this.revert(sessionId, turn, file.path, force, dirtyPaths)
      if (!result.ok) skipped.push(file.path)
    }
    return { ok: true, review: await this.get(sessionId), skipped }
  }

  /**
   * before/after texts for the UI diff.
   * @param sessionId - session id.
   * @param turn - turn number.
   * @param path - absolute path.
   */
  async diff(sessionId: string, turn: number, path: string): Promise<ReviewDiffResult> {
    const session = asMutable(await loadIndex(sessionId, this.dshHome))
    const file = findFile(session, turn, path)
    if (file === undefined) {
      return { path, before: '', after: '', ok: false, error: 'not-found' }
    }
    const after = (await this.disk.readText(path)) ?? ''
    if (file.kind === 'create') {
      return { path, before: '', after, ok: true }
    }
    if (file.shadowKey.length === 0) {
      return { path, before: '', after, ok: false, error: 'irreversible' }
    }
    const shadow = await readShadow(sessionId, file.shadowKey, this.dshHome)
    if (shadow === null) {
      return { path, before: '', after, ok: false, error: 'irreversible' }
    }
    // delete: before = shadow, after = current (usually empty when gone)
    return { path, before: shadow, after, ok: true }
  }
}

async function afterHashOf(disk: ReviewDisk, path: string): Promise<string | null> {
  const after = await disk.readText(path)
  return after === null ? null : contentHash(after)
}

function captureKey(sessionId: string, turn: number, path: string): string {
  return `${sessionId}\0${turn}\0${path}`
}

function ensureTurn(session: MutableSession, turn: number): MutableTurn {
  const existing = session.turns.find(row => row.turn === turn)
  if (existing !== undefined) return existing
  const created: MutableTurn = { turn, shellMaybeMutated: false, files: [] }
  session.turns.push(created)
  return created
}

function findFile(session: MutableSession, turn: number, path: string): ReviewFile | undefined {
  return session.turns.find(row => row.turn === turn)?.files.find(file => file.path === path)
}

function replaceFile(session: MutableSession, turn: number, path: string, next: ReviewFile): void {
  const turnRow = session.turns.find(row => row.turn === turn)
  if (turnRow === undefined) return
  const index = turnRow.files.findIndex(file => file.path === path)
  if (index >= 0) turnRow.files[index] = next
}

function project(session: MutableSession): ReviewSession {
  const turns = [...session.turns].sort((a, b) => b.turn - a.turn)
  return { sessionId: session.sessionId, turns }
}
