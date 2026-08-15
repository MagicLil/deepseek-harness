/**
 * X-Mart workbench plugin, browser half. Provides `ctx.xmartWorkbench`,
 * fills the frame-declared `workbench` slot with a tabbed column, fills
 * `shell.overlay` with the reopen control, and contributes the Workbench
 * settings section. Export discipline: packages/client/AGENTS.md.
 */
import { createElement } from 'react'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  WorkbenchColumnInjected, WorkbenchSettingsInjected, WorkbenchToggleInjected,
} from './contract.ts'
import { createWorkbenchStore } from './stores.ts'
import { XmartWorkbenchController } from './service.ts'
import { WorkbenchColumn } from './WorkbenchColumn.tsx'
import { WorkbenchToggle } from './WorkbenchToggle.tsx'
import { WorkbenchSettingsSection } from './WorkbenchSettingsSection.tsx'
import { DemoTab, FileStubTab } from './built-in-tabs.tsx'
import { ExplorerTab } from './ExplorerTab.tsx'
import { EditorTab } from './EditorTab.tsx'
import { BinaryTab, ImageTab } from './MediaTabs.tsx'
import { createWorkbenchFilesStore } from './files-store.ts'
import { createWorkbenchFsDefinition } from './fs-events.ts'
import { noteFsTouch } from './fs-touch.ts'
import { hasNulByte, IMAGE_EXTS, MARKDOWN_EXTS } from './route-file.ts'
import { en, NS, zh } from './locales.ts'

export { XmartWorkbenchController } from './service.ts'
export type { IXmartWorkbench } from './service.ts'
export type {
  WorkbenchColumnInjected, WorkbenchColumnProps, WorkbenchSettingsInjected, WorkbenchSettingsProps,
  WorkbenchToggleInjected, WorkbenchToggleProps,
} from './contract.ts'
export type { WorkbenchKey } from './locales.ts'
export type { WorkbenchPersistState } from './stores.ts'
export type {
  FileViewerDescriptor, OpenTabSeed, SessionScope, TabBodyProps, TabDescriptor, WorkbenchTab,
  WorkbenchView,
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
 * Stable open-flag source plus a same-identity setter. The source object
 * stays stable so the renderer can cache the hook binding.
 * @returns the observable and its setter.
 */
function createOpenFlag(): { source: HostObservable<boolean>; set: (next: boolean) => void } {
  let value = false
  const listeners = new Set<() => void>()
  return {
    source: {
      getSnapshot: () => value,
      subscribe: (fn) => {
        listeners.add(fn)
        return () => { listeners.delete(fn) }
      },
    },
    set: (next) => {
      if (value === next) return
      value = next
      for (const listener of listeners) listener()
    },
  }
}

/**
 * Register dictionaries, provide `ctx.xmartWorkbench`, and contribute the
 * column, overlay toggle, settings section, and built-in tab types.
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

  ctx.effect(() => workbench.registerTab({
    id: 'explorer',
    title: () => t('tab.explorer'),
    order: 0,
    single: true,
    available: scope => typeof getCwd(scope.sessionId) === 'string' && getCwd(scope.sessionId) !== '',
    component: props => createElement(ExplorerTab, {
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
    }),
  }), 'ui-xmart-workbench: explorer tab')
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

  const openFlag = createOpenFlag()
  const persist = createWorkbenchStore()
  const columnInjected = (sessionId: SessionId): WorkbenchColumnInjected => {
    workbench.bindSession(sessionId)
    return {
      closeWorkbench: () => { ctx.layout.closeWorkbench() },
      setWorkbench: (px) => { ctx.layout.setWorkbench(px) },
      reportOpen: (open) => { openFlag.set(open) },
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
  const toggleInjected = (): WorkbenchToggleInjected => ({
    openWorkbench: () => { ctx.layout.openWorkbench() },
    hooks: { workbenchOpen: openFlag.source },
  })
  const settingsInjected = (): WorkbenchSettingsInjected => ({
    setTabEnabled: (id, enabled) => { workbench.setTabEnabled(id, enabled) },
    setViewerEnabled: (id, enabled) => { workbench.setViewerEnabled(id, enabled) },
    hooks: { workbenchRegistry: workbench.observeRegistry() },
  })

  ctx.slots.inject('workbench', () => ctx.slots.register(
    {
      name: 'workbench',
      store: persist,
      inject: columnInjected,
      locale: NS,
    },
    WorkbenchColumn,
  ))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    {
      name: 'shell.overlay',
      id: 'xmart-workbench-toggle',
      inject: toggleInjected,
      locale: NS,
    },
    WorkbenchToggle,
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
