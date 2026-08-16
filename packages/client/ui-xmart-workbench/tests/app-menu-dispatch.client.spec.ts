import { describe, expect, it } from 'vitest'
import {
  activeFileTab, dispatchAppMenu, OPEN_SETTINGS_EVENT, WORKBENCH_EDITOR_ACTION_EVENT,
  WORKBENCH_FIND_EVENT, WORKBENCH_QUICK_OPEN_EVENT, WORKBENCH_REPLACE_EVENT, WORKBENCH_SAVE_EVENT,
  type AppMenuCommand, type AppMenuDispatchDeps,
} from '../src/client/app-menu-dispatch.ts'
import { EMPTY_WORKBENCH_VIEW } from '../src/client/service.ts'

function deps(overrides: Partial<AppMenuDispatchDeps> = {}): AppMenuDispatchDeps & {
  calls: Record<string, unknown[]>
} {
  const calls: Record<string, unknown[]> = {}
  const record = (name: string) => (...args: unknown[]) => {
    calls[name] = [...(calls[name] ?? []), args]
  }
  return {
    sessionId: 's1',
    newSession: record('newSession'),
    openWorkspace: record('openWorkspace'),
    closeActiveEditor: record('closeActiveEditor'),
    showActivity: record('showActivity'),
    togglePrimary: record('togglePrimary'),
    toggleSessions: record('toggleSessions'),
    toggleConversation: record('toggleConversation'),
    newTerminal: record('newTerminal'),
    toggleTerminal: record('toggleTerminal'),
    dispatch: record('dispatch'),
    calls,
    ...overrides,
  }
}

describe('dispatchAppMenu', () => {
  it('routes commands that do not need a session', () => {
    const d = deps({ sessionId: undefined })
    const rows: AppMenuCommand[] = [
      'settings-open', 'file-save', 'file-find', 'file-replace', 'file-quick-open',
      'file-goto-line', 'file-goto-definition', 'session-new', 'workspace-open',
      'sidebar-primary', 'sidebar-sessions', 'sidebar-conversation',
    ]
    for (const command of rows) dispatchAppMenu(command, d)
    expect(d.calls.dispatch).toEqual([
      [OPEN_SETTINGS_EVENT], [WORKBENCH_SAVE_EVENT], [WORKBENCH_FIND_EVENT], [WORKBENCH_REPLACE_EVENT],
      [WORKBENCH_QUICK_OPEN_EVENT],
      [WORKBENCH_EDITOR_ACTION_EVENT, 'editor.action.gotoLine'],
      [WORKBENCH_EDITOR_ACTION_EVENT, 'editor.action.revealDefinition'],
    ])
    expect(d.calls.newSession).toHaveLength(1)
    expect(d.calls.openWorkspace).toHaveLength(1)
    expect(d.calls.togglePrimary).toHaveLength(1)
    expect(d.calls.toggleSessions).toHaveLength(1)
    expect(d.calls.toggleConversation).toHaveLength(1)
    expect(d.calls.newTerminal).toBeUndefined()
  })

  it('routes session-scoped commands and no-ops without a session', () => {
    const missing = deps({ sessionId: undefined })
    dispatchAppMenu('file-close', missing)
    dispatchAppMenu('activity-explorer', missing)
    dispatchAppMenu('terminal-new', missing)
    dispatchAppMenu('terminal-toggle', missing)
    expect(missing.calls.closeActiveEditor).toBeUndefined()
    expect(missing.calls.newTerminal).toBeUndefined()

    const d = deps()
    dispatchAppMenu('file-close', d)
    dispatchAppMenu('activity-explorer', d)
    dispatchAppMenu('activity-git', d)
    dispatchAppMenu('terminal-new', d)
    dispatchAppMenu('terminal-toggle', d)
    expect(d.calls.closeActiveEditor).toEqual([['s1']])
    expect(d.calls.showActivity).toEqual([
      ['s1', 'explorer'], ['s1', 'git'],
    ])
    expect(d.calls.newTerminal).toEqual([['s1']])
    expect(d.calls.toggleTerminal).toEqual([['s1']])
  })
})

describe('activeFileTab', () => {
  it('skips shell tabs and falls back to the last file tab', () => {
    expect(activeFileTab(EMPTY_WORKBENCH_VIEW)).toBeUndefined()
    const view = {
      ...EMPTY_WORKBENCH_VIEW,
      tabs: [
        { id: 'explorer:1', type: 'explorer', title: '资源管理器' },
        { id: 'editor:1', type: 'editor', title: 'a.ts', path: '/ws/a.ts' },
        { id: 'editor:2', type: 'editor', title: 'b.ts', path: '/ws/b.ts' },
      ],
      activeTabId: 'editor:1',
    }
    expect(activeFileTab(view)?.id).toBe('editor:1')
    expect(activeFileTab({ ...view, activeTabId: 'explorer:1' })?.path).toBe('/ws/b.ts')
  })
})
