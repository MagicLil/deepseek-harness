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
  fileFind: string
  fileReplace: string
  fileCloseEditor: string
  fileSettings: string
  edit: string
  go: string
  goFile: string
  goLine: string
  goDefinition: string
  goImplementation: string
  goReferences: string
  goHover: string
  view: string
  viewExplorer: string
  viewGit: string
  viewPrimary: string
  viewSessions: string
  viewConversation: string
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
  id: 'file' | 'edit' | 'go' | 'view' | 'terminal' | 'help'
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
    fileFind: zh ? '查找' : 'Find',
    fileReplace: zh ? '替换' : 'Replace',
    fileCloseEditor: zh ? '关闭编辑器' : 'Close Editor',
    fileSettings: zh ? '设置' : 'Settings',
    edit: zh ? '编辑' : 'Edit',
    go: zh ? '转到' : 'Go',
    goFile: zh ? '转到文件' : 'Go to File',
    goLine: zh ? '转到行' : 'Go to Line',
    goDefinition: zh ? '转到定义' : 'Go to Definition',
    goImplementation: zh ? '转到实现' : 'Go to Implementation',
    goReferences: zh ? '查找所有引用' : 'Go to References',
    goHover: zh ? '显示悬停提示' : 'Show Hover',
    view: zh ? '视图' : 'View',
    viewExplorer: zh ? '资源管理器' : 'Explorer',
    viewGit: zh ? '源代码管理' : 'Source Control',
    viewPrimary: zh ? '切换左侧边栏' : 'Toggle Primary Sidebar',
    viewSessions: zh ? '切换会话列表' : 'Toggle Session List',
    viewConversation: zh ? '切换对话' : 'Toggle Chat',
    terminal: zh ? '终端' : 'Terminal',
    terminalNew: zh ? '新建终端' : 'New Terminal',
    terminalToggle: zh ? '切换终端' : 'Toggle Terminal',
    help: zh ? '帮助' : 'Help',
    helpAbout: zh ? '关于万物智汇' : 'About Xmart',
  }
}

/**
 * Top-level menu order: File / Edit / Go / View / Terminal / Help.
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
        { type: 'separator' },
        { type: 'command', id: 'file-find', label: labels.fileFind, accelerator: 'CommandOrControl+F' },
        { type: 'command', id: 'file-replace', label: labels.fileReplace, accelerator: 'CommandOrControl+H' },
      ],
    },
    {
      id: 'go',
      label: labels.go,
      submenu: [
        { type: 'command', id: 'file-quick-open', label: labels.goFile, accelerator: 'CommandOrControl+P' },
        { type: 'command', id: 'file-goto-line', label: labels.goLine, accelerator: 'CommandOrControl+G' },
        { type: 'separator' },
        { type: 'command', id: 'file-goto-definition', label: labels.goDefinition, accelerator: 'F12' },
        { type: 'command', id: 'file-goto-implementation', label: labels.goImplementation, accelerator: 'CommandOrControl+F12' },
        { type: 'command', id: 'file-goto-references', label: labels.goReferences, accelerator: 'Shift+F12' },
        { type: 'command', id: 'file-show-hover', label: labels.goHover },
      ],
    },
    {
      id: 'view',
      label: labels.view,
      submenu: [
        { type: 'command', id: 'activity-explorer', label: labels.viewExplorer },
        { type: 'command', id: 'activity-git', label: labels.viewGit },
        { type: 'separator' },
        { type: 'command', id: 'sidebar-primary', label: labels.viewPrimary, accelerator: 'CommandOrControl+B' },
        { type: 'command', id: 'sidebar-sessions', label: labels.viewSessions, accelerator: 'CommandOrControl+Shift+L' },
        { type: 'command', id: 'sidebar-conversation', label: labels.viewConversation, accelerator: 'CommandOrControl+Alt+B' },
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
