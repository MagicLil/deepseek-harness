/**
 * Workbench slot contracts: composed props for the editor column, activity
 * bar, primary sidebar, bottom panel, and the Workbench settings section.
 */
import type {
  HostObservable, InjectFace, PropsLocale, PropsRuntime, PropsStore,
} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ComponentType } from 'react'
import type { createWorkbenchStore } from './stores.ts'
import type { WorkbenchKey } from './locales.ts'
import type { AppMenuCommand } from './app-menu-dispatch.ts'
import type {
  ActivityId, TabBodyProps, WorkbenchRegistrySnapshot, WorkbenchView,
} from './types.ts'

/** Activity-bar icon component (primitives or a plugin SVG). */
export type ActivityIcon = ComponentType<{ size?: number }>

/** Injected tab actions and live snapshots for the editor column. */
export interface WorkbenchColumnInjected {
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

/** Full composed props for the editor column. */
export type WorkbenchColumnProps =
  & PropsRuntime<'workbench'>
  & PropsLocale<'workbench'>
  & InjectFace<WorkbenchColumnInjected>

/** Injected activity writes and layout toggles for the activity bar. */
export interface ActivityBarInjected {
  /**
   * Remember the primary-sidebar activity for this session.
   * @param id - registered or built-in activity id.
   */
  setActivity: (id: ActivityId) => void
  /**
   * Look up a registered activity icon.
   * @param id - activity id.
   */
  resolveIcon: (id: string) => ActivityIcon | undefined
  /** Open the primary sidebar (layout preference → default width). */
  openPrimary: () => void
  /** Close the primary sidebar. */
  closePrimary: () => void
  hooks: {
    /** Per-session activity and tab list. */
    workbenchSession: HostObservable<WorkbenchView>
    /** Registered activities (empty until plugins register). */
    workbenchRegistry: HostObservable<WorkbenchRegistrySnapshot>
  }
}

/** Full composed props for the activity bar. */
export type ActivityBarProps =
  & PropsRuntime<'activityBar'>
  & PropsLocale<'workbench'>
  & InjectFace<ActivityBarInjected>

/** Injected layout writes and body lookup for the primary sidebar. */
export interface PrimarySidebarInjected {
  /** Close the primary sidebar (layout preference → 0). */
  closeWorkbench: () => void
  /**
   * Write the primary-sidebar width preference.
   * @param px - requested width in px.
   */
  setWorkbench: (px: number) => void
  /**
   * Look up the registered body for a tab type.
   * @param type - tab type id.
   */
  resolveBody: (type: string) => ComponentType<TabBodyProps> | undefined
  /** Re-list the explorer tree from disk (title-row refresh). */
  refreshExplorer: () => void
  /**
   * Project folder key for a session (workspace path or cwd). Same-project
   * session switches keep the live explorer width instead of restoring
   * the new session's persist default.
   */
  projectKey: (sessionId: string) => string | undefined
  /**
   * True when `apply` just inherited into this session. The session-scoped
   * sidebar remounts, so `projectKey` alone cannot see the previous id;
   * this flag skips persist restore and keeps the live width.
   */
  keepLiveWidth: () => boolean
  hooks: {
    /** Per-session activity and tab list. */
    workbenchSession: HostObservable<WorkbenchView>
    /** Registered activities for the title and pane list. */
    workbenchRegistry: HostObservable<WorkbenchRegistrySnapshot>
  }
}

/** Full composed props for the primary sidebar. */
export type PrimarySidebarProps =
  & PropsRuntime<'primarySidebar'>
  & PropsStore<ReturnType<typeof createWorkbenchStore>>
  & PropsLocale<'workbench'>
  & InjectFace<PrimarySidebarInjected>

/** Injected actions for the product application menu (web HTML bar). */
export interface MenuBarInjected {
  /**
   * Run one renderer-bound menu command.
   * @param command - id shared with the desktop native menu.
   */
  run: (command: AppMenuCommand) => void
  hooks: {
    /** Per-session tabs (quota and Close Editor read this snapshot). */
    workbenchSession: HostObservable<WorkbenchView>
  }
}

/** Full composed props for the top menu bar. */
export type MenuBarProps =
  & PropsRuntime<'menuBar'>
  & PropsLocale<'workbench'>
  & InjectFace<MenuBarInjected>

/** Injected body lookup and tab writes for the bottom panel. */
export interface BottomPanelInjected {
  /**
   * Look up the registered body for a tab type.
   * @param type - tab type id.
   */
  resolveBody: (type: string) => ComponentType<TabBodyProps> | undefined
  /**
   * Focus a terminal tab instance.
   * @param tabId - instance id.
   */
  activateTab: (tabId: string) => void
  /**
   * Close a terminal tab (and its host PTY). The last close also hides the panel.
   * @param tabId - instance id.
   */
  closeTab: (tabId: string) => void
  /** Mint another terminal tab when under the session quota. */
  newTerminal: () => void
  hooks: {
    /** Per-session tabs (bottom panel filters `type === 'terminal'`). */
    workbenchSession: HostObservable<WorkbenchView>
  }
}

/** Full composed props for the bottom panel. */
export type BottomPanelProps =
  & PropsRuntime<'bottomPanel'>
  & PropsLocale<'workbench'>
  & InjectFace<BottomPanelInjected>

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

export type { WorkbenchKey, ActivityId }
