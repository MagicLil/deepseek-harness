/**
 * Workbench slot contracts: composed props for the column and the overlay toggle.
 */
import type {
  HostObservable, PropsLocale, PropsRuntime, PropsStore, SnapshotSelectorHook,
} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { createWorkbenchStore } from './stores.ts'
import type { WorkbenchKey } from './locales.ts'

/** Injected layout writes and open-state report used by the workbench column. */
export interface WorkbenchColumnInjected {
  /** Close the workbench panel (layout preference → 0). */
  closeWorkbench: () => void
  /**
   * Write the workbench width preference.
   * @param px - requested width in px.
   */
  setWorkbench: (px: number) => void
  /**
   * Publish whether this session's workbench preference is open (overlay hide/show).
   * @param open - true when the stored preference is greater than 0.
   */
  reportOpen: (open: boolean) => void
}

/** Full composed props for the workbench column. */
export type WorkbenchColumnProps =
  & PropsRuntime<'workbench'>
  & PropsStore<ReturnType<typeof createWorkbenchStore>>
  & PropsLocale<'workbench'>
  & WorkbenchColumnInjected

/** Injected open control and open-state hook sources for the overlay toggle. */
export type WorkbenchToggleInjected = {
  /** Open the workbench at the layout contract default (column restores persisted width). */
  openWorkbench: () => void
  hooks: {
    /** True while the current session's workbench preference is open. */
    workbenchOpen: HostObservable<boolean>
  }
}

/** Full composed props for the overlay reopen control. */
export type WorkbenchToggleProps =
  & PropsRuntime<'shell.overlay'>
  & PropsLocale<'workbench'>
  & {
    openWorkbench: () => void
    useWorkbenchOpen: SnapshotSelectorHook<boolean>
  }

export type { WorkbenchKey }
