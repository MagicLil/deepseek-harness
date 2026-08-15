/**
 * Desktop / web application-menu commands. Desktop mints these on the native
 * menu; web MenuBar calls the same handler. Window events keep Settings and
 * the active editor off this plugin's public service face.
 */
import { isShellTabType, type WorkbenchTab, type WorkbenchView } from './types.ts'

/** Renderer-bound menu command (About stays in the desktop main process). */
export type AppMenuCommand =
  | 'session-new'
  | 'workspace-open'
  | 'file-save'
  | 'file-close'
  | 'settings-open'
  | 'activity-explorer'
  | 'activity-git'
  | 'activity-tasks'
  | 'sidebar-primary'
  | 'sidebar-sessions'
  | 'terminal-new'
  | 'terminal-toggle'

/** Window event that asks the mounted editor tab to save. */
export const WORKBENCH_SAVE_EVENT = 'dsh:workbench-save'

/** Window event that asks the settings shell to open its modal. */
export const OPEN_SETTINGS_EVENT = 'dsh:open-settings'

/** Dependencies the menu handler closes over from `apply`. */
export type AppMenuDispatchDeps = {
  sessionId: string | undefined
  newSession: () => void
  openWorkspace: () => void
  closeActiveEditor: (sessionId: string) => void
  showActivity: (sessionId: string, id: 'explorer' | 'git' | 'tasks') => void
  togglePrimary: () => void
  toggleSessions: () => void
  newTerminal: (sessionId: string) => void
  toggleTerminal: (sessionId: string) => void
  dispatch: (name: string) => void
}

/**
 * Focused file tab, or the last file tab when focus is on a shell type.
 * @param view - per-session workbench snapshot.
 */
export function activeFileTab(view: WorkbenchView): WorkbenchTab | undefined {
  const tabs = view.tabs.filter(tab => !isShellTabType(tab.type))
  return tabs.find(tab => tab.id === view.activeTabId) ?? tabs[tabs.length - 1]
}

/**
 * Route one application-menu command. Session-scoped rows no-op without a current session.
 * @param command - renderer-bound menu id.
 * @param deps - closed-over host actions.
 */
export function dispatchAppMenu(command: AppMenuCommand, deps: AppMenuDispatchDeps): void {
  if (command === 'settings-open') {
    deps.dispatch(OPEN_SETTINGS_EVENT)
    return
  }
  if (command === 'file-save') {
    deps.dispatch(WORKBENCH_SAVE_EVENT)
    return
  }
  if (command === 'session-new') {
    deps.newSession()
    return
  }
  if (command === 'workspace-open') {
    deps.openWorkspace()
    return
  }
  if (command === 'sidebar-primary') {
    deps.togglePrimary()
    return
  }
  if (command === 'sidebar-sessions') {
    deps.toggleSessions()
    return
  }
  const sessionId = deps.sessionId
  if (sessionId === undefined) return
  if (command === 'file-close') {
    deps.closeActiveEditor(sessionId)
    return
  }
  if (command === 'activity-explorer') {
    deps.showActivity(sessionId, 'explorer')
    return
  }
  if (command === 'activity-git') {
    deps.showActivity(sessionId, 'git')
    return
  }
  if (command === 'activity-tasks') {
    deps.showActivity(sessionId, 'tasks')
    return
  }
  if (command === 'terminal-new') {
    deps.newTerminal(sessionId)
    return
  }
  deps.toggleTerminal(sessionId)
}
