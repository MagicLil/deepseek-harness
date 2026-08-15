/**
 * Application-menu spec for the desktop window. Top-level labels are product
 * copy (万物智汇), not Electron stock File/Edit/View/Window/Help. Role rows
 * stay only where the OS already owns the gesture (edit, zoom, quit, DevTools).
 * @module @deepseek-ai/dsh-desktop/app-menu
 */

import type { AppMenuCommand } from './ipc-protocol.ts'

export type { AppMenuCommand }

/** Localized application-menu copy. */
export interface DesktopAppMenuLabels {
  file: string
  fileNewSession: string
  fileOpenWorkspace: string
  fileSave: string
  fileCloseEditor: string
  fileSettings: string
  edit: string
  view: string
  viewExplorer: string
  viewGit: string
  viewTasks: string
  viewPrimary: string
  viewSessions: string
  terminal: string
  terminalNew: string
  terminalToggle: string
  help: string
  helpAbout: string
}

/** One submenu row: a renderer command, an Electron role, About, or a separator. */
export type DesktopAppMenuAction =
  | { type: 'command'; id: AppMenuCommand; label: string; accelerator?: string }
  | {
    type: 'role'
    role:
      | 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll'
      | 'resetZoom' | 'zoomIn' | 'zoomOut' | 'togglefullscreen'
      | 'toggleDevTools' | 'quit'
  }
  | { type: 'about'; label: string }
  | { type: 'separator' }

/** One top-level application-menu column. */
export type DesktopAppMenuItem = {
  id: 'file' | 'edit' | 'view' | 'terminal' | 'help'
  label: string
  submenu: DesktopAppMenuAction[]
}

/**
 * Application-menu labels from the OS locale Electron reports.
 * @param locale - `app.getLocale()`, e.g. `zh-CN`.
 */
export function desktopAppMenuLabels(locale: string): DesktopAppMenuLabels {
  const zh = locale.toLowerCase().startsWith('zh')
  return {
    file: zh ? '文件' : 'File',
    fileNewSession: zh ? '新会话' : 'New Session',
    fileOpenWorkspace: zh ? '打开工作区…' : 'Open Workspace…',
    fileSave: zh ? '保存' : 'Save',
    fileCloseEditor: zh ? '关闭编辑器' : 'Close Editor',
    fileSettings: zh ? '设置' : 'Settings',
    edit: zh ? '编辑' : 'Edit',
    view: zh ? '视图' : 'View',
    viewExplorer: zh ? '资源管理器' : 'Explorer',
    viewGit: zh ? '源代码管理' : 'Source Control',
    viewTasks: zh ? '任务' : 'Tasks',
    viewPrimary: zh ? '切换左侧边栏' : 'Toggle Primary Sidebar',
    viewSessions: zh ? '切换会话列表' : 'Toggle Session List',
    terminal: zh ? '终端' : 'Terminal',
    terminalNew: zh ? '新建终端' : 'New Terminal',
    terminalToggle: zh ? '切换终端' : 'Toggle Terminal',
    help: zh ? '帮助' : 'Help',
    helpAbout: zh ? '关于万物智汇' : 'About Xmart',
  }
}

/**
 * Top-level menu order: File / Edit / View / Terminal / Help.
 * @param labels - {@link desktopAppMenuLabels}.
 */
export function desktopAppMenuSpec(labels: DesktopAppMenuLabels): DesktopAppMenuItem[] {
  return [
    {
      id: 'file',
      label: labels.file,
      submenu: [
        { type: 'command', id: 'session-new', label: labels.fileNewSession, accelerator: 'CommandOrControl+N' },
        { type: 'command', id: 'workspace-open', label: labels.fileOpenWorkspace, accelerator: 'CommandOrControl+O' },
        { type: 'separator' },
        { type: 'command', id: 'file-save', label: labels.fileSave, accelerator: 'CommandOrControl+S' },
        { type: 'command', id: 'file-close', label: labels.fileCloseEditor, accelerator: 'CommandOrControl+W' },
        { type: 'separator' },
        { type: 'command', id: 'settings-open', label: labels.fileSettings, accelerator: 'CommandOrControl+,' },
        { type: 'separator' },
        { type: 'role', role: 'quit' },
      ],
    },
    {
      id: 'edit',
      label: labels.edit,
      submenu: [
        { type: 'role', role: 'undo' },
        { type: 'role', role: 'redo' },
        { type: 'separator' },
        { type: 'role', role: 'cut' },
        { type: 'role', role: 'copy' },
        { type: 'role', role: 'paste' },
        { type: 'role', role: 'selectAll' },
      ],
    },
    {
      id: 'view',
      label: labels.view,
      submenu: [
        { type: 'command', id: 'activity-explorer', label: labels.viewExplorer },
        { type: 'command', id: 'activity-git', label: labels.viewGit },
        { type: 'command', id: 'activity-tasks', label: labels.viewTasks },
        { type: 'separator' },
        { type: 'command', id: 'sidebar-primary', label: labels.viewPrimary, accelerator: 'CommandOrControl+B' },
        { type: 'command', id: 'sidebar-sessions', label: labels.viewSessions, accelerator: 'CommandOrControl+Shift+L' },
        { type: 'separator' },
        { type: 'role', role: 'resetZoom' },
        { type: 'role', role: 'zoomIn' },
        { type: 'role', role: 'zoomOut' },
        { type: 'separator' },
        { type: 'role', role: 'togglefullscreen' },
      ],
    },
    {
      id: 'terminal',
      label: labels.terminal,
      submenu: [
        { type: 'command', id: 'terminal-new', label: labels.terminalNew },
        {
          type: 'command',
          id: 'terminal-toggle',
          label: labels.terminalToggle,
          accelerator: 'CommandOrControl+`',
        },
      ],
    },
    {
      id: 'help',
      label: labels.help,
      submenu: [
        { type: 'about', label: labels.helpAbout },
        { type: 'separator' },
        { type: 'role', role: 'toggleDevTools' },
      ],
    },
  ]
}
