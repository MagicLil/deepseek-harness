/**
 * Per-session workbench persist store: open flag plus last drag width.
 * The layout store holds the live preference; this store remembers it
 * across session switches and reloads. Module level exports the factory
 * only — a module-level handle would pin identity across plugin reloads.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'

/** Default width written when a session first opens the primary sidebar (matches ui-layout WORKBENCH_DEFAULT). */
export const WORKBENCH_PERSIST_DEFAULT = 260

/** Session-scoped workbench persist state. */
export type WorkbenchPersistState = {
  /** True when this session last left the workbench open. */
  open: boolean
  /** Last non-zero width preference in px. */
  width: number
}

/** Bound persist writes (draft is already closed over by defineStore). */
export type WorkbenchPersistBoundActions = {
  rememberOpen: (width: number) => void
  rememberClosed: () => void
}

/** Open-by-default snapshot while session-maybe has no current session. */
export const EMPTY_WORKBENCH_PERSIST: WorkbenchPersistState = {
  open: true,
  width: WORKBENCH_PERSIST_DEFAULT,
}

/**
 * Stable persist source for the session-less chrome incarnation.
 * session-maybe slots cannot use the framework store seat (no session id).
 */
export const EMPTY_PERSIST_SOURCE: HostObservable<WorkbenchPersistState> = {
  getSnapshot: () => EMPTY_WORKBENCH_PERSIST,
  subscribe: () => () => {},
}

/** No-op persist writes while no session is bound. */
export const NOOP_PERSIST_ACTIONS: WorkbenchPersistBoundActions = {
  rememberOpen: () => {},
  rememberClosed: () => {},
}

/**
 * Annotation twin of the actions literal below (the export needs a declared
 * return type); drift fails assignability at the defineStore call.
 */
type WorkbenchPersistActions = {
  rememberOpen: (draft: WorkbenchPersistState, width: number) => void
  rememberClosed: (draft: WorkbenchPersistState) => void
}

/**
 * Create the per-session workbench persist store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createWorkbenchStore(): EngineStoreHandle<WorkbenchPersistState, WorkbenchPersistActions> {
  return defineStore({
    init: (): WorkbenchPersistState => ({ open: true, width: WORKBENCH_PERSIST_DEFAULT }),
    persist: 'dsh.xmart.workbench',
    actions: {
      rememberOpen: (d, width: number) => {
        d.open = true
        d.width = width
      },
      rememberClosed: (d) => {
        d.open = false
      },
    },
  })
}

/**
 * Copy open/width onto another session so a same-project remount
 * restores the live explorer size instead of the destination default.
 * @param persist - workbench persist handle.
 * @param fromId - session that currently has the live width.
 * @param toId - session that should keep that width.
 * @returns the copied snapshot, or undefined when the ids match.
 */
export function inheritWorkbenchPersist(
  persist: EngineStoreHandle<WorkbenchPersistState, WorkbenchPersistActions>,
  fromId: string,
  toId: string,
): WorkbenchPersistState | undefined {
  if (fromId === toId) return undefined
  const from = persist.create(fromId).getSnapshot()
  const to = persist.create(toId)
  to.actions.rememberOpen(from.width)
  if (!from.open) to.actions.rememberClosed()
  return from
}
