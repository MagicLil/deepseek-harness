/**
 * X-Mart workbench plugin, browser half. Provides `ctx.xmartWorkbench`,
 * fills the Cursor-shell slots (activity bar, primary sidebar, editor
 * column, bottom panel), and contributes the Workbench settings section.
 * Export discipline: packages/client/AGENTS.md.
 */
import { createElement } from 'react'
import {
  IconBranchOutline16, IconChecklistOutline14, IconFolderOpenOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  ActivityBarInjected, BottomPanelInjected, PrimarySidebarInjected,
  WorkbenchColumnInjected, WorkbenchSettingsInjected,
} from './contract.ts'
import { createWorkbenchStore } from './stores.ts'
import { XmartWorkbenchController } from './service.ts'
import { WorkbenchColumn } from './WorkbenchColumn.tsx'
import { ActivityBar } from './ActivityBar.tsx'
import { PrimarySidebar } from './PrimarySidebar.tsx'
import { BottomPanel } from './BottomPanel.tsx'
import { WorkbenchSettingsSection } from './WorkbenchSettingsSection.tsx'
import { DemoTab, FileStubTab } from './built-in-tabs.tsx'
import { ExplorerTab } from './ExplorerTab.tsx'
import { EditorTab } from './EditorTab.tsx'
import { BinaryTab, ImageTab } from './MediaTabs.tsx'
import { GitTab } from './GitTab.tsx'
import { DiffTab } from './DiffTab.tsx'
import { readTaskTurn, TasksTab } from './TasksTab.tsx'
import { TerminalTab } from './TerminalTab.tsx'
import { encodeDiffPath } from './git-diff-path.ts'
import { createWorkbenchFilesStore } from './files-store.ts'
import { createWorkbenchFsDefinition } from './fs-events.ts'
import { noteFsTouch } from './fs-touch.ts'
import { hasNulByte, IMAGE_EXTS, MARKDOWN_EXTS } from './route-file.ts'
import { en, NS, zh } from './locales.ts'
import { clickSettingsTrigger } from './settings-trigger.ts'
import type { TabBodyProps } from './types.ts'

export { XmartWorkbenchController } from './service.ts'
export type { IXmartWorkbench } from './service.ts'
export type {
  ActivityBarInjected, ActivityBarProps, BottomPanelInjected, BottomPanelProps,
  PrimarySidebarInjected, PrimarySidebarProps,
  WorkbenchColumnInjected, WorkbenchColumnProps, WorkbenchSettingsInjected, WorkbenchSettingsProps,
} from './contract.ts'
export type { WorkbenchKey } from './locales.ts'
export type { WorkbenchPersistState } from './stores.ts'
export type {
  ActivityDescriptor, ActivityId, FileViewerDescriptor, OpenTabSeed, SessionScope, TabBodyProps,
  TabDescriptor, WorkbenchTab, WorkbenchView,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The outward face only; the concrete service stays inside this plugin. */
    xmartWorkbench: import('./service.ts').IXmartWorkbench
  }
}

/**
 * Required services (cordis fiber inject). Target slots are declared by
 * ui-layout and ui-settings-general; apply depends on each declaration
 * through `slots.inject()`.
 */
export const inject = [
  'slots', 'locale', 'layout', 'workspaces', 'sessions', 'conversation', 'conversationEvents',
]

/** Empty viewer body (matching only; hidden tabs render the real UI). */
function ViewerStub() {
  return null
}


/**
 * Register dictionaries, provide `ctx.xmartWorkbench`, and contribute the
 * activity bar, primary sidebar, editor column, bottom panel, settings
 * section, and built-in tab types.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-xmart-workbench: dictionaries')

  const workbench = new XmartWorkbenchController()
  const files = createWorkbenchFilesStore()
  workbench.attachPanel(() => { ctx.layout.openWorkbench() })
  ctx.effect(() => {
    const disposeService = ctx.reflect.provide('xmartWorkbench', workbench)
    return () => { void disposeService() }
  }, 'ui-xmart-workbench: service')

  const t = ctx.locale.bind(NS)
  const getCwd = (sessionId: string) => ctx.sessions.list.getSnapshot().byId[sessionId as SessionId]?.cwd
  const mentionFile = (sessionId: string, path: string) => {
    const actx = ctx.sessions.scope(sessionId as SessionId)
    if (actx === undefined) return
    try {
      const input = ctx.conversation.input.for(actx)
      const snap = input.state.getSnapshot()
      const prefix = snap.draft === '' || snap.draft.endsWith(' ') ? '' : ' '
      input.setDraft(`${snap.draft}${prefix}${path} `)
    }
    catch {
      // Composer shell is created when the session scope materializes.
    }
  }

  ctx.effect(() => {
    const component = (props: TabBodyProps) => createElement(ExplorerTab, {
      ...props,
      t,
      getCwd,
      watchSessions: fn => ctx.sessions.list.subscribe(fn),
      listEntries: (path, signal) => ctx.workspaces.listEntries(path, signal),
      gitStatus: (path, signal) => ctx.workspaces.gitStatus(path, signal),
      writeFile: (path, content) => ctx.workspaces.writeFile(path, content),
      createDirectory: (path, name) => ctx.workspaces.createDirectory(path, name),
      openSystem: path => ctx.workspaces.openPath(path),
      openFile: (path) => { workbench.openFile(path, { sessionId: props.sessionId }) },
      mentionFile: (path) => { mentionFile(props.sessionId, path) },
      files,
    })
    const disposeTab = workbench.registerTab({
      id: 'explorer',
      title: () => t('tab.explorer'),
      order: 0,
      hidden: true,
      single: true,
      available: scope => typeof getCwd(scope.sessionId) === 'string' && getCwd(scope.sessionId) !== '',
      component,
    })
    const disposeActivity = workbench.registerActivity({
      id: 'explorer',
      title: () => t('activity.explorer'),
      order: 0,
      icon: IconFolderOpenOutline16,
      component,
    })
    return () => {
      disposeActivity()
      disposeTab()
    }
  }, 'ui-xmart-workbench: explorer')
  ctx.effect(() => {
    const component = (props: TabBodyProps) => createElement(GitTab, {
      ...props,
      t,
      getCwd,
      watchSessions: fn => ctx.sessions.list.subscribe(fn),
      listEntries: (path, signal) => ctx.workspaces.listEntries(path, signal),
      gitStatus: (path, signal) => ctx.workspaces.gitStatus(path, signal),
      gitStage: (path, files) => ctx.workspaces.gitStage(path, files),
      gitUnstage: (path, files) => ctx.workspaces.gitUnstage(path, files),
      gitDiscard: (path, files) => ctx.workspaces.gitDiscard(path, files),
      gitCommit: (path, message) => ctx.workspaces.gitCommit(path, message),
      gitLog: (path, limit) => ctx.workspaces.gitLog(path, limit),
      openFile: (path) => { workbench.openFile(path, { sessionId: props.sessionId }) },
      openDiff: (side, file) => {
        workbench.openTab({
          type: 'diff', path: encodeDiffPath(side, file), title: file,
        }, { sessionId: props.sessionId })
      },
      files,
    })
    const disposeTab = workbench.registerTab({
      id: 'git',
      title: () => t('tab.git'),
      order: 10,
      hidden: true,
      single: true,
      available: scope => typeof getCwd(scope.sessionId) === 'string' && getCwd(scope.sessionId) !== '',
      component,
    })
    const disposeActivity = workbench.registerActivity({
      id: 'git',
      title: () => t('activity.git'),
      order: 10,
      icon: IconBranchOutline16,
      component,
    })
    return () => {
      disposeActivity()
      disposeTab()
    }
  }, 'ui-xmart-workbench: git')
  ctx.effect(() => {
    const component = (props: TabBodyProps) => createElement(TasksTab, {
      ...props,
      t,
      watchSessions: (fn) => {
        let offSession: (() => void) | undefined
        const attachSession = () => {
          offSession?.()
          offSession = ctx.sessions.binding(props.sessionId as SessionId)?.session.subscribe(fn)
        }
        const offList = ctx.sessions.list.subscribe(() => {
          attachSession()
          fn()
        })
        attachSession()
        return () => {
          offList()
          offSession?.()
        }
      },
      listTurn: id => readTaskTurn(
        ctx.sessions.list.getSnapshot().byId[id as SessionId]?.running,
        ctx.sessions.binding(id as SessionId)?.session.getSnapshot(),
      ),
      listJobs: id => ctx.sessions.list.getSnapshot().jobsBySession[id as SessionId] ?? [],
      listSubagents: (id) => {
        const entries = ctx.sessions.list.getSnapshot().subagentsByParent[id as SessionId]?.entries ?? []
        return entries.flatMap((row) => {
          if (row.kind !== 'child') return []
          return row.label === undefined
            ? [{ id: row.id, activity: row.activity }]
            : [{ id: row.id, label: row.label, activity: row.activity }]
        })
      },
      cancelTurn: () => { void ctx.sessions.binding(props.sessionId as SessionId)?.session.cancel() },
      cancelSubagent: (id) => { void ctx.sessions.binding(id as SessionId)?.session.cancel() },
      openSubagent: (id) => {
        const parent = props.sessionId as SessionId
        const entries = ctx.sessions.list.getSnapshot().subagentsByParent[parent]?.entries ?? []
        const row = entries.find(entry => entry.id === id)
        if (row === undefined || row.kind !== 'child') return
        ctx.sessions.openSubagent({
          parentSessionId: parent, childSessionId: row.id, mode: row.mode,
        })
      },
    })
    const disposeTab = workbench.registerTab({
      id: 'tasks',
      title: () => t('tab.tasks'),
      order: 20,
      hidden: true,
      single: true,
      component,
    })
    const disposeActivity = workbench.registerActivity({
      id: 'tasks',
      title: () => t('activity.tasks'),
      order: 20,
      icon: IconChecklistOutline14,
      component,
    })
    return () => {
      disposeActivity()
      disposeTab()
    }
  }, 'ui-xmart-workbench: tasks')
  ctx.effect(() => workbench.registerTab({
    id: 'terminal',
    title: () => t('tab.terminal'),
    order: 30,
    hidden: true,
    component: props => createElement(TerminalTab, { ...props, t }),
  }), 'ui-xmart-workbench: terminal tab')
  ctx.effect(() => workbench.registerTab({
    id: 'demo',
    title: () => t('tab.demo'),
    order: 90,
    single: true,
    component: props => createElement(DemoTab, { ...props, t }),
  }), 'ui-xmart-workbench: demo tab')
  ctx.effect(() => workbench.registerTab({
    id: 'file',
    title: () => t('tab.file'),
    hidden: true,
    dedupeKey: tab => tab.path,
    component: props => createElement(FileStubTab, { ...props, t }),
  }), 'ui-xmart-workbench: file stub')
  ctx.effect(() => workbench.registerTab({
    id: 'editor',
    title: () => t('tab.editor'),
    hidden: true,
    dedupeKey: tab => tab.path,
    component: props => createElement(EditorTab, {
      ...props,
      t,
      readFile: (path, signal) => ctx.workspaces.readFile(path, signal),
      writeFile: (path, content) => ctx.workspaces.writeFile(path, content),
      files,
    }),
  }), 'ui-xmart-workbench: editor tab')
  ctx.effect(() => workbench.registerTab({
    id: 'image',
    title: () => t('tab.image'),
    hidden: true,
    dedupeKey: tab => tab.path,
    component: props => createElement(ImageTab, {
      ...props, t, openSystem: path => ctx.workspaces.openPath(path),
    }),
  }), 'ui-xmart-workbench: image tab')
  ctx.effect(() => workbench.registerTab({
    id: 'diff',
    title: () => t('tab.diff'),
    hidden: true,
    dedupeKey: tab => tab.path,
    component: props => createElement(DiffTab, {
      ...props,
      t,
      getCwd,
      gitDiff: (path, side, file, signal) => ctx.workspaces.gitDiff(path, side, file, signal),
    }),
  }), 'ui-xmart-workbench: diff tab')
  ctx.effect(() => workbench.registerTab({
    id: 'binary',
    title: () => t('tab.binary'),
    hidden: true,
    dedupeKey: tab => tab.path,
    component: props => createElement(BinaryTab, {
      ...props, t, openSystem: path => ctx.workspaces.openPath(path),
    }),
  }), 'ui-xmart-workbench: binary tab')

  ctx.effect(() => workbench.registerFileViewer({
    id: 'binary-download',
    title: () => t('viewer.binary'),
    exts: [],
    priority: 50,
    fetchStrategy: 'binary-download',
    detect: (_path, head) => hasNulByte(head),
    component: ViewerStub,
  }), 'ui-xmart-workbench: binary viewer')
  ctx.effect(() => workbench.registerFileViewer({
    id: 'image',
    title: () => t('viewer.image'),
    exts: IMAGE_EXTS,
    priority: 20,
    fetchStrategy: 'custom',
    component: ViewerStub,
  }), 'ui-xmart-workbench: image viewer')
  ctx.effect(() => workbench.registerFileViewer({
    id: 'markdown',
    title: () => t('viewer.markdown'),
    exts: MARKDOWN_EXTS,
    priority: 10,
    fetchStrategy: 'fsRead',
    component: ViewerStub,
  }), 'ui-xmart-workbench: markdown viewer')
  ctx.effect(() => workbench.registerFileViewer({
    id: 'code',
    title: () => t('viewer.code'),
    exts: [],
    priority: -100,
    fetchStrategy: 'fsRead',
    component: ViewerStub,
  }), 'ui-xmart-workbench: code viewer')

  let lastFsSeq = -1
  ctx.effect(() => ctx.conversationEvents.register(createWorkbenchFsDefinition((seq, refresh, reload) => {
    lastFsSeq = noteFsTouch(files, lastFsSeq, seq, refresh, reload)
  })), 'ui-xmart-workbench: fs events')

  const persist = createWorkbenchStore()
  const columnInjected = (sessionId: SessionId): WorkbenchColumnInjected => {
    workbench.bindSession(sessionId)
    return {
      openTab: (type) => { workbench.openTab({ type }, { sessionId }) },
      closeTab: (id) => { workbench.closeTab(id, { sessionId }) },
      activateTab: (id) => { workbench.activateTab(id, { sessionId }) },
      resolveBody: type => workbench.getTab(type)?.component,
      hooks: {
        workbenchSession: workbench.observeSession(sessionId),
        workbenchRegistry: workbench.observeRegistry(),
      },
    }
  }
  const activityInjected = (sessionId: SessionId): ActivityBarInjected => ({
    setActivity: (id) => { workbench.setActivity(id, { sessionId }) },
    resolveIcon: id => workbench.getActivity(id)?.icon,
    openPrimary: () => { ctx.layout.openWorkbench() },
    closePrimary: () => { ctx.layout.closeWorkbench() },
    toggleBottom: () => { ctx.layout.toggleBottom() },
    openSettings: () => { clickSettingsTrigger(globalThis.document) },
    hooks: {
      workbenchSession: workbench.observeSession(sessionId),
      workbenchRegistry: workbench.observeRegistry(),
    },
  })
  const primaryInjected = (sessionId: SessionId): PrimarySidebarInjected => ({
    closeWorkbench: () => { ctx.layout.closeWorkbench() },
    setWorkbench: (px) => { ctx.layout.setWorkbench(px) },
    resolveBody: type => workbench.getActivity(type)?.component ?? workbench.getTab(type)?.component,
    refreshExplorer: () => { files.bumpRefresh() },
    hooks: {
      workbenchSession: workbench.observeSession(sessionId),
      workbenchRegistry: workbench.observeRegistry(),
    },
  })
  const bottomInjected = (): BottomPanelInjected => ({
    resolveBody: type => workbench.getTab(type)?.component,
  })
  const settingsInjected = (): WorkbenchSettingsInjected => ({
    setTabEnabled: (id, enabled) => { workbench.setTabEnabled(id, enabled) },
    setViewerEnabled: (id, enabled) => { workbench.setViewerEnabled(id, enabled) },
    hooks: { workbenchRegistry: workbench.observeRegistry() },
  })

  ctx.slots.inject('activityBar', () => ctx.slots.register(
    { name: 'activityBar', inject: activityInjected, locale: NS },
    ActivityBar,
  ))
  ctx.slots.inject('primarySidebar', () => ctx.slots.register(
    { name: 'primarySidebar', store: persist, inject: primaryInjected, locale: NS },
    PrimarySidebar,
  ))
  ctx.slots.inject('workbench', () => ctx.slots.register(
    { name: 'workbench', inject: columnInjected, locale: NS },
    WorkbenchColumn,
  ))
  ctx.slots.inject('bottomPanel', () => ctx.slots.register(
    { name: 'bottomPanel', inject: bottomInjected, locale: NS },
    BottomPanel,
  ))
  ctx.slots.inject('settings.section', () => ctx.slots.register(
    {
      name: 'settings.section',
      id: 'workbench',
      order: 25,
      label: () => t('settings.nav'),
      locale: NS,
      inject: settingsInjected,
    },
    WorkbenchSettingsSection,
  ))
}
