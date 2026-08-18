/**
 * Shared explorer/editor state: expanded directories, drafts, refresh, and
 * reload tokens. Created in `apply` and closed over by built-in tab bodies.
 */
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { isUnder, rewritePath } from './route-file.ts'

/** localStorage key for drafts + expanded directories. */
export const FILES_PERSIST = 'dsh.xmart.workbench.files'

/** Durable + ephemeral file-chrome state. */
export type WorkbenchFilesState = {
  /** Expanded directories per session (absolute path → true). */
  expanded: Record<string, Record<string, boolean>>
  /** Unsaved buffers by absolute path (entry exists only while dirty). */
  drafts: Record<string, string>
  /** Bumped when the explorer tree should reload. */
  refreshNonce: number
  /** Per-path token bumped when an agent mutation touches that file. */
  reloadAt: Record<string, number>
}

const EMPTY: WorkbenchFilesState = {
  expanded: {},
  drafts: {},
  refreshNonce: 0,
  reloadAt: {},
}

/**
 * Drop persist garbage at the localStorage boundary.
 * @param raw - value just read from the snapshot store.
 */
export function sanitizeFilesState(raw: unknown): WorkbenchFilesState {
  if (raw === null || typeof raw !== 'object') return { ...EMPTY, expanded: {}, drafts: {}, reloadAt: {} }
  const rec = raw as Record<string, unknown>
  return {
    expanded: stringBoolMaps(rec.expanded),
    drafts: stringMap(rec.drafts),
    refreshNonce: 0,
    reloadAt: {},
  }
}

function stringMap(raw: unknown): Record<string, string> {
  if (raw === null || typeof raw !== 'object') return {}
  /* v8 ignore next -- persist garbage already rejected by the null/object guard above. */
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

function stringBoolMaps(raw: unknown): Record<string, Record<string, boolean>> {
  if (raw === null || typeof raw !== 'object') return {}
  const out: Record<string, Record<string, boolean>> = {}
  for (const [sessionId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null || typeof value !== 'object') continue
    const inner: Record<string, boolean> = {}
    for (const [path, flag] of Object.entries(value as Record<string, unknown>)) {
      if (flag === true) inner[path] = true
    }
    out[sessionId] = inner
  }
  return out
}

function omitKey<V>(record: Record<string, V>, key: string): Record<string, V> {
  const next: Record<string, V> = {}
  for (const [entry, value] of Object.entries(record)) {
    if (entry !== key) next[entry] = value
  }
  return next
}

/** Files store closed over by explorer/editor tab bodies. */
export type WorkbenchFilesStore = {
  getSnapshot: () => WorkbenchFilesState
  subscribe: (fn: () => void) => () => void
  expandedOf: (sessionId: string) => Record<string, boolean>
  setExpanded: (sessionId: string, path: string, expanded: boolean) => void
  /** Copy expanded directories onto another session (same-project switch). */
  cloneExpanded: (fromId: string, toId: string) => void
  bumpRefresh: () => void
  markReload: (paths: readonly string[]) => void
  reloadToken: (path: string) => number
  draftOf: (path: string) => string | undefined
  setDraft: (path: string, content: string | undefined) => void
  /** Move drafts / expanded / reload tokens from `from` onto `to`. */
  moveUnder: (from: string, to: string) => void
  /** Drop drafts / expanded / reload tokens at or under `path`. */
  forgetUnder: (path: string) => void
}

/**
 * Create the files store (one per plugin apply).
 * @returns the store face.
 */
export function createWorkbenchFilesStore(): WorkbenchFilesStore {
  const store: SnapshotStore<WorkbenchFilesState> = createSnapshotStore(
    { ...EMPTY, expanded: {}, drafts: {}, reloadAt: {} },
    { persist: { name: FILES_PERSIST } },
  )
  store.set(sanitizeFilesState(store.getSnapshot()))

  return {
    getSnapshot: () => store.getSnapshot(),
    subscribe: fn => store.subscribe(fn),
    expandedOf: sessionId => store.getSnapshot().expanded[sessionId] ?? {},
    setExpanded: (sessionId, path, expanded) => {
      store.update((draft) => {
        const current = draft.expanded[sessionId] ?? {}
        draft.expanded[sessionId] = expanded
          ? { ...current, [path]: true }
          : omitKey(current, path)
      })
    },
    cloneExpanded: (fromId, toId) => {
      if (fromId === toId) return
      store.update((draft) => {
        const src = draft.expanded[fromId]
        draft.expanded[toId] = src === undefined ? {} : { ...src }
      })
    },
    bumpRefresh: () => {
      store.update((draft) => {
        draft.refreshNonce += 1
      })
    },
    markReload: (paths) => {
      if (paths.length === 0) return
      const unique = [...new Set(paths)]
      store.update((draft) => {
        for (const path of unique) {
          draft.reloadAt[path] = (draft.reloadAt[path] ?? 0) + 1
        }
      })
    },
    reloadToken: path => store.getSnapshot().reloadAt[path] ?? 0,
    draftOf: path => store.getSnapshot().drafts[path],
    setDraft: (path, content) => {
      store.update((draft) => {
        draft.drafts = content === undefined
          ? omitKey(draft.drafts, path)
          : { ...draft.drafts, [path]: content }
      })
    },
    moveUnder: (from, to) => {
      if (from === to) return
      store.update((draft) => {
        draft.drafts = rewriteRecord(draft.drafts, from, to)
        draft.reloadAt = rewriteRecord(draft.reloadAt, from, to)
        const expanded: Record<string, Record<string, boolean>> = {}
        for (const [sessionId, map] of Object.entries(draft.expanded)) {
          expanded[sessionId] = rewriteRecord(map, from, to)
        }
        draft.expanded = expanded
      })
    },
    forgetUnder: (path) => {
      store.update((draft) => {
        draft.drafts = omitUnder(draft.drafts, path)
        draft.reloadAt = omitUnder(draft.reloadAt, path)
        const expanded: Record<string, Record<string, boolean>> = {}
        for (const [sessionId, map] of Object.entries(draft.expanded)) {
          expanded[sessionId] = omitUnder(map, path)
        }
        draft.expanded = expanded
      })
    },
  }
}

function rewriteRecord<V>(record: Record<string, V>, from: string, to: string): Record<string, V> {
  const next: Record<string, V> = {}
  for (const [key, value] of Object.entries(record)) {
    next[rewritePath(key, from, to)] = value
  }
  return next
}

function omitUnder<V>(record: Record<string, V>, root: string): Record<string, V> {
  const next: Record<string, V> = {}
  for (const [key, value] of Object.entries(record)) {
    if (!isUnder(key, root)) next[key] = value
  }
  return next
}
