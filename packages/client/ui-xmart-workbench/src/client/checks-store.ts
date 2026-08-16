/**
 * Checks panel state: discovered scripts, run rows, log, persist, auto-rerun.
 */
import type { CheckKind, DiscoveredCheck, PackageManager } from './discover-scripts.ts'
import type { ProblemItem } from './problem-model.ts'

/** One check row status. */
export type CheckRowStatus = 'idle' | 'running' | 'passed' | 'failed' | 'skipped' | 'stopped'

/** One script row in the Checks panel. */
export type CheckRow = {
  kind: CheckKind
  script: string
  status: CheckRowStatus
  exitCode: number | null
  /** Last argv joined with spaces (empty before the first run). */
  command: string
}

/** Persisted last-run snapshot (localStorage). */
export type ChecksPersist = {
  workspaceRoot: string
  rows: readonly CheckRow[]
  log: string
  problems: readonly ProblemItem[]
  finishedAt: number
}

/** Live panel state for one workspace. */
export type ChecksState = {
  workspaceRoot: string | undefined
  packageRoot: string | undefined
  packageManager: PackageManager
  discovered: readonly DiscoveredCheck[]
  rows: readonly CheckRow[]
  log: string
  problems: readonly ProblemItem[]
  activeRunId: string | null
  activeKind: CheckKind | null
  relatedMode: boolean
  autoRerunFailed: boolean
  busy: boolean
}

const PERSIST_PREFIX = 'dsh.xmart.checks.last.'

/** Empty panel state. */
export function emptyChecksState(): ChecksState {
  return {
    workspaceRoot: undefined,
    packageRoot: undefined,
    packageManager: 'npm',
    discovered: [],
    rows: [],
    log: '',
    problems: [],
    activeRunId: null,
    activeKind: null,
    relatedMode: true,
    autoRerunFailed: true,
    busy: false,
  }
}

/** Create rows from discovered scripts. */
export function rowsFromDiscovered(discovered: readonly DiscoveredCheck[]): CheckRow[] {
  return discovered.map(d => ({
    kind: d.kind,
    script: d.script,
    status: 'idle',
    exitCode: null,
    command: '',
  }))
}

/** localStorage key for one workspace. */
export function checksPersistKey(workspaceRoot: string): string {
  return `${PERSIST_PREFIX}${workspaceRoot}`
}

/** Load last snapshot when present. */
export function loadChecksPersist(workspaceRoot: string): ChecksPersist | undefined {
  try {
    const raw = localStorage.getItem(checksPersistKey(workspaceRoot))
    if (raw === null) return undefined
    const parsed = JSON.parse(raw) as ChecksPersist
    if (parsed.workspaceRoot !== workspaceRoot) return undefined
    return parsed
  } catch {
    return undefined
  }
}

/** Save last snapshot. */
export function saveChecksPersist(snap: ChecksPersist): void {
  try {
    localStorage.setItem(checksPersistKey(snap.workspaceRoot), JSON.stringify(snap))
  } catch {
    // quota / private mode
  }
}

/** Soft-mutable store with subscribe (one per plugin apply). */
export function createChecksStore() {
  let state = emptyChecksState()
  const listeners = new Set<() => void>()
  const notify = (): void => {
    for (const fn of listeners) fn()
  }
  return {
    getSnapshot: (): ChecksState => state,
    subscribe: (fn: () => void): (() => void) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    set: (patch: Partial<ChecksState>): void => {
      state = { ...state, ...patch }
      notify()
    },
    updateRows: (updater: (rows: readonly CheckRow[]) => CheckRow[]): void => {
      state = { ...state, rows: updater(state.rows) }
      notify()
    },
    appendLog: (chunk: string): void => {
      if (chunk.length === 0) return
      state = { ...state, log: `${state.log}${chunk}` }
      notify()
    },
    replaceLog: (log: string): void => {
      state = { ...state, log }
      notify()
    },
  }
}

export type ChecksStore = ReturnType<typeof createChecksStore>

/**
 * Apply a finished persist onto live state (merge with current discovery).
 * @param state - live state.
 * @param persist - disk snapshot.
 */
export function mergePersist(state: ChecksState, persist: ChecksPersist): ChecksState {
  const byKind = new Map(persist.rows.map(r => [r.kind, r]))
  const rows = state.discovered.map((d) => {
    const prev = byKind.get(d.kind)
    return {
      kind: d.kind,
      script: d.script,
      status: prev?.status ?? 'idle',
      exitCode: prev?.exitCode ?? null,
      command: prev?.command ?? '',
    }
  })
  return {
    ...state,
    rows,
    log: persist.log,
    problems: persist.problems,
  }
}

/** Kinds that failed in the last snapshot (for auto re-run). */
export function failedKinds(rows: readonly CheckRow[]): CheckKind[] {
  return rows.filter(r => r.status === 'failed').map(r => r.kind)
}
