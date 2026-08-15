/**
 * Per-session workbench persist store: open flag plus last drag width.
 * The layout store holds the live preference; this store remembers it
 * across session switches and reloads. Module level exports the factory
 * only — a module-level handle would pin identity across plugin reloads.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Default width written when a session first opens the primary sidebar (matches ui-layout WORKBENCH_DEFAULT). */
export const WORKBENCH_PERSIST_DEFAULT = 260

/** Session-scoped workbench persist state. */
export type WorkbenchPersistState = {
  /** True when this session last left the workbench open. */
  open: boolean
  /** Last non-zero width preference in px. */
  width: number
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
