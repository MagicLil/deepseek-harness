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
  | 'file-find'
  | 'file-replace'
  | 'file-close'
  | 'file-quick-open'
  | 'file-goto-line'
  | 'file-goto-definition'
  | 'file-goto-implementation'
  | 'file-goto-references'
  | 'file-show-hover'
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

/** Window event that asks the mounted editor to open the find widget. */
export const WORKBENCH_FIND_EVENT = 'dsh:workbench-find'

/** Window event that asks the mounted editor to open find-and-replace. */
export const WORKBENCH_REPLACE_EVENT = 'dsh:workbench-replace'

/** Window event that asks the editor column to open the file palette. */
export const WORKBENCH_QUICK_OPEN_EVENT = 'dsh:workbench-quick-open'

/** Window event whose `detail` is a Monaco action id. */
export const WORKBENCH_EDITOR_ACTION_EVENT = 'dsh:workbench-editor-action'

/** Window event that asks the settings shell to open its modal. */
export const OPEN_SETTINGS_EVENT = 'dsh:open-settings'

/** Menu commands that run a Monaco action on the focused editor. */
export const EDITOR_ACTION_BY_COMMAND: Partial<Record<AppMenuCommand, string>> = {
  'file-goto-line': 'editor.action.gotoLine',
  'file-goto-definition': 'editor.action.revealDefinition',
  'file-goto-implementation': 'editor.action.goToImplementation',
  'file-goto-references': 'editor.action.goToReferences',
  'file-show-hover': 'editor.action.showHover',
}

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
  dispatch: (name: string, detail?: string) => void
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
  if (command === 'file-find') {
    deps.dispatch(WORKBENCH_FIND_EVENT)
    return
  }
  if (command === 'file-replace') {
    deps.dispatch(WORKBENCH_REPLACE_EVENT)
    return
  }
  if (command === 'file-quick-open') {
    deps.dispatch(WORKBENCH_QUICK_OPEN_EVENT)
    return
  }
  const editorAction = EDITOR_ACTION_BY_COMMAND[command]
  if (editorAction !== undefined) {
    deps.dispatch(WORKBENCH_EDITOR_ACTION_EVENT, editorAction)
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
