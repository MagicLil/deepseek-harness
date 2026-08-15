/**
 * Workbench slot contracts: composed props for the column, overlay toggle,
 * and the Workbench settings section.
 */
import type {
  HostObservable, InjectFace, PropsLocale, PropsRuntime, PropsStore,
} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ComponentType } from 'react'
import type { createWorkbenchStore } from './stores.ts'
import type { WorkbenchKey } from './locales.ts'
import type {
  TabBodyProps, WorkbenchRegistrySnapshot, WorkbenchView,
} from './types.ts'

/** Injected layout writes, tab actions, and live snapshots for the column. */
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
  /**
   * Open or focus a tab type in this session.
   * @param type - registered tab type id.
   */
  openTab: (type: string) => void
  /**
   * Close a tab instance in this session.
   * @param tabId - instance id.
   */
  closeTab: (tabId: string) => void
  /**
   * Focus a tab instance in this session.
   * @param tabId - instance id.
   */
  activateTab: (tabId: string) => void
  /**
   * Look up the registered body for a tab type.
   * @param type - tab type id.
   * @returns the body component, or undefined when the type is not registered.
   */
  resolveBody: (type: string) => ComponentType<TabBodyProps> | undefined
  hooks: {
    /** Per-session tabs, focus, and derived + menu. */
    workbenchSession: HostObservable<WorkbenchView>
    /** Registered types and their settings enable flags. */
    workbenchRegistry: HostObservable<WorkbenchRegistrySnapshot>
  }
}

/** Full composed props for the workbench column. */
export type WorkbenchColumnProps =
  & PropsRuntime<'workbench'>
  & PropsStore<ReturnType<typeof createWorkbenchStore>>
  & PropsLocale<'workbench'>
  & InjectFace<WorkbenchColumnInjected>

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
  & InjectFace<WorkbenchToggleInjected>

/** Injected registry snapshot and enable writes for the settings page. */
export interface WorkbenchSettingsInjected {
  hooks: {
    /** Registered tab/viewer rows plus enable flags. */
    workbenchRegistry: HostObservable<WorkbenchRegistrySnapshot>
  }
  /**
   * Enable or disable a tab type.
   * @param id - tab type id.
   * @param enabled - false hides the type from + and refuses openTab.
   */
  setTabEnabled: (id: string, enabled: boolean) => void
  /**
   * Enable or disable a file viewer.
   * @param id - viewer id.
   * @param enabled - false skips the viewer in matchFileViewer.
   */
  setViewerEnabled: (id: string, enabled: boolean) => void
}

/** Full composed props for the Workbench settings section. */
export type WorkbenchSettingsProps =
  & PropsRuntime<'settings.section'>
  & PropsLocale<'workbench'>
  & InjectFace<WorkbenchSettingsInjected>

export type { WorkbenchKey }
