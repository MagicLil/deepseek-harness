/**
 * X-Mart workbench plugin, browser half. Provides `ctx.xmartWorkbench`,
 * fills the Cursor-shell slots (menu bar, activity bar, primary sidebar,
 * editor column, bottom panel), and contributes the Workbench settings section.
 * Export discipline: packages/client/AGENTS.md.
 */
import { createElement } from 'react'
import {
  IconBranchOutline16, IconFolderOpenOutline16, IconSearchOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {
  ActivityBarInjected, BottomPanelInjected, MenuBarInjected, PrimarySidebarInjected,
  WorkbenchColumnInjected, WorkbenchSettingsInjected,
} from './contract.ts'
import { XMART_ACCENT_TOKENS } from './brand-accent.ts'
import { projectKeyOf, shouldInheritSameProject } from './same-project.ts'
import {
  createWorkbenchStore, EMPTY_PERSIST_SOURCE, inheritWorkbenchPersist, NOOP_PERSIST_ACTIONS,
  WORKBENCH_PERSIST_DEFAULT,
} from './stores.ts'
import { EMPTY_SESSION_SOURCE, XmartWorkbenchController } from './service.ts'
import { WorkbenchColumn } from './WorkbenchColumn.tsx'
import { ActivityBar } from './ActivityBar.tsx'
import { MenuBar } from './MenuBar.tsx'
import { PrimarySidebar } from './PrimarySidebar.tsx'
import { BottomPanel } from './BottomPanel.tsx'
import { WorkbenchSettingsSection } from './WorkbenchSettingsSection.tsx'
import { DemoTab, FileStubTab } from './built-in-tabs.tsx'
import { ExplorerTab } from './ExplorerTab.tsx'
import { SearchTab } from './SearchTab.tsx'
import { ReviewDock } from './ReviewDock.tsx'
import { ReviewDiffTab } from './ReviewDiffTab.tsx'
import type { AgentReviewRemote } from './review-client.ts'
import { encodeAgentReviewPath } from './agent-review-path.ts'
import { createWorkbenchSearchStore } from './search-store.ts'
import { requestReveal } from './editor-nav.ts'
import { EditorTab } from './EditorTab.tsx'
import { peekEditorRemotes } from './editor-lsp.ts'
import { BinaryTab, ImageTab } from './MediaTabs.tsx'
import { GitTab } from './GitTab.tsx'
import { DiffTab } from './DiffTab.tsx'
import { TerminalTab } from './TerminalTab.tsx'
import { ProblemsTab } from './ProblemsTab.tsx'
import { ChecksTab } from './ChecksTab.tsx'
import { createChecksStore } from './checks-store.ts'
import { commitDiffTitle, encodeCommitDiffPath, encodeDiffPath } from './git-diff-path.ts'
import { editorWorkspaceRoot, resolveExplorerRoots, resolveSessionCwd, resolveTerminalCwd } from './explorer-roots.ts'
import { createWorkbenchFilesStore } from './files-store.ts'
import { createGitBadgeStore, EMPTY_GIT_BADGE, startGitBadgeWatch } from './git-badge.ts'
import { createWorkbenchFsDefinition } from './fs-events.ts'
import { noteFsTouch } from './fs-touch.ts'
import { basename, hasNulByte, IMAGE_EXTS, MARKDOWN_EXTS } from './route-file.ts'
import { activeEditorPath } from './active-file.ts'
import { activeFileTab, dispatchAppMenu, type AppMenuCommand } from './app-menu-dispatch.ts'
import { en, NS, zh } from './locales.ts'
import { canCreateTerminal, countTerminalTabs, shouldCreateOnToggle } from './terminal-actions.ts'
import { hostTerminalsOf, killTerminal } from './terminal-client.ts'
import { clearTerminalSeat } from './terminal-seats.ts'
import { isBottomPanelTabType, type TabBodyProps } from './types.ts'
import { askAgentFix } from './ask-agent-fix.ts'

export { XmartWorkbenchController } from './service.ts'
export type { IXmartWorkbench } from './service.ts'
export type {
  ActivityBarInjected, ActivityBarProps, BottomPanelInjected, BottomPanelProps,
  MenuBarInjected, MenuBarProps, PrimarySidebarInjected, PrimarySidebarProps,
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
  'connection', 'remote', 'theme',
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
  ctx.effect(
    () => ctx.theme.overrideTokens('ui-xmart-workbench', XMART_ACCENT_TOKENS),
    'ui-xmart-workbench: brand accent',
  )

  const workbench = new XmartWorkbenchController()
  const files = createWorkbenchFilesStore()
  const gitBadge = createGitBadgeStore()
  const searchStore = createWorkbenchSearchStore()
  const checksStore = createChecksStore()
  const persist = createWorkbenchStore()
  workbench.attachPanel(() => { ctx.layout.openWorkbench() })
  const projectKey = (sessionId: string): string | undefined => projectKeyOf(
    sessionId,
    ctx.sessions.list.getSnapshot(),
    ctx.workspaces.list.getSnapshot(),
  )
  let lastSession = ctx.sessions.list.getSnapshot().current
  let skipPersistRestoreFor: string | undefined
  ctx.effect(() => ctx.sessions.list.subscribe(() => {
    const snap = ctx.sessions.list.getSnapshot()
    const next = snap.current
    const prev = lastSession
    if (prev === next) return
    lastSession = next
    skipPersistRestoreFor = undefined
    if (prev === undefined || next === undefined) return
    if (!shouldInheritSameProject(prev, next, snap, ctx.workspaces.list.getSnapshot())) return
    workbench.inheritSession(prev, next)
    files.cloneExpanded(prev, next)
    const copied = inheritWorkbenchPersist(persist, prev, next)
    if (copied !== undefined) {
      if (copied.open) ctx.layout.setWorkbench(copied.width)
      else ctx.layout.closeWorkbench()
    }
    skipPersistRestoreFor = next
  }), 'ui-xmart-workbench: same-project inherit')
  ctx.effect(() => {
    const disposeService = ctx.reflect.provide('xmartWorkbench', workbench)
    return () => { void disposeService() }
  }, 'ui-xmart-workbench: service')

  const t = ctx.locale.bind(NS)
  const host = hostTerminalsOf(ctx.get('connection'))
  const remote = ctx.get('remote')
  const workspaceChecksFace = (): unknown => {
    try {
      return ctx.get('remote.workspaceChecks')
    }
    catch {
      return (remote as { workspaceChecks?: unknown }).workspaceChecks
    }
  }
  const workspaceSnap = () => ctx.workspaces.list.getSnapshot()
  const getCwd = (sessionId: string) => {
    const snap = workspaceSnap()
    return resolveSessionCwd(
      sessionId,
      ctx.sessions.list.getSnapshot().byId[sessionId as SessionId]?.cwd,
      snap.items,
      snap.recentWorkspaceId,
    )
  }
  const getRoots = (sessionId: string) => {
    const snap = workspaceSnap()
    return resolveExplorerRoots(
      sessionId,
      ctx.sessions.list.getSnapshot().byId[sessionId as SessionId]?.cwd,
      snap.items,
      snap.recentWorkspaceId,
    )
  }
  const getWorkspacePaths = () => workspaceSnap().items
    .map(workspace => workspace.path)
    .filter(path => path !== '')
  const getTerminalCwd = (sessionId: string) => resolveTerminalCwd(getRoots(sessionId), getCwd(sessionId))
  const watchWorkspaceFacts = (fn: () => void) => {
    const offSessions = ctx.sessions.list.subscribe(fn)
    const offWorkspaces = ctx.workspaces.list.subscribe(fn)
    return () => {
      offSessions()
      offWorkspaces()
    }
  }
  ctx.effect(() => startGitBadgeWatch({
    getSessionId: () => ctx.sessions.list.getSnapshot().current,
    getCwd,
    gitStatus: (path, signal) => ctx.workspaces.gitStatus(path, signal),
    listEntries: (path, signal) => ctx.workspaces.listEntries(path, signal),
    store: gitBadge,
    watch: (fn) => {
      const offFacts = watchWorkspaceFacts(fn)
      const offFiles = files.subscribe(fn)
      return () => {
        offFacts()
        offFiles()
      }
    },
  }), 'ui-xmart-workbench: git badge')
  const getActivePath = (sessionId: string) => activeEditorPath(workbench.getSnapshot(sessionId))
  const watchWorkbench = (fn: () => void) => workbench.subscribe(fn)
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
      getRoots,
      watchSessions: watchWorkspaceFacts,
      listEntries: (path, signal) => ctx.workspaces.listEntries(path, signal),
      gitStatus: (path, signal) => ctx.workspaces.gitStatus(path, signal),
      writeFile: (path, content) => ctx.workspaces.writeFile(path, content),
      createDirectory: (path, name) => ctx.workspaces.createDirectory(path, name),
      openSystem: path => ctx.workspaces.openPath(path),
      openFile: (path) => {
        workbench.bindSession(props.sessionId)
        workbench.openFile(path, { sessionId: props.sessionId })
      },
      mentionFile: (path) => { mentionFile(props.sessionId, path) },
      files,
      getActivePath,
      watchWorkbench,
    })
    const disposeTab = workbench.registerTab({
      id: 'explorer',
      title: () => t('tab.explorer'),
      order: 0,
      hidden: true,
      single: true,
      available: scope => getRoots(scope.sessionId).length > 0,
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
    const component = (props: TabBodyProps) => createElement(SearchTab, {
      ...props,
      t,
      getRoots,
      watchSessions: watchWorkspaceFacts,
      search: (path, query, options, signal) => ctx.workspaces.search(path, query, options, signal),
      openHit: (sessionId, path, reveal) => {
        requestReveal(path, reveal)
        workbench.openFile(path, { sessionId })
      },
      store: searchStore,
    })
    return workbench.registerActivity({
      id: 'search',
      title: () => t('activity.search'),
      order: 5,
      icon: IconSearchOutline16,
      component,
    })
  }, 'ui-xmart-workbench: search')
  ctx.effect(() => {
    const component = (props: TabBodyProps) => createElement(GitTab, {
      ...props,
      t,
      getCwd,
      getWorkspacePaths,
      watchSessions: watchWorkspaceFacts,
      listEntries: (path, signal) => ctx.workspaces.listEntries(path, signal),
      gitStatus: (path, signal) => ctx.workspaces.gitStatus(path, signal),
      gitStage: (path, files) => ctx.workspaces.gitStage(path, files),
      gitUnstage: (path, files) => ctx.workspaces.gitUnstage(path, files),
      gitDiscard: (path, files) => ctx.workspaces.gitDiscard(path, files),
      gitCommit: (path, message) => ctx.workspaces.gitCommit(path, message),
      gitLog: (path, limit, signal, skip) => ctx.workspaces.gitLog(path, limit, signal, skip),
      gitSync: (path, mode) => ctx.workspaces.gitSync(path, mode),
      gitBranches: (path, signal) => ctx.workspaces.gitBranches(path, signal),
      gitCheckout: (path, name, create) => ctx.workspaces.gitCheckout(path, name, create),
      gitCheckoutCommit: (path, hash) => ctx.workspaces.gitCheckoutCommit(path, hash),
      gitSuggestCommit: (path, sid) => ctx.workspaces.gitSuggestCommit(path, sid),
      openFile: (path) => { workbench.openFile(path, { sessionId: props.sessionId }) },
      openDiff: (side, file, root) => {
        workbench.openTab({
          type: 'diff', path: encodeDiffPath(side, file, root), title: file,
        }, { sessionId: props.sessionId })
      },
      openCommit: (hash, subject, root) => {
        workbench.openTab({
          type: 'diff',
          path: encodeCommitDiffPath(hash, root),
          title: commitDiffTitle(hash, subject),
        }, { sessionId: props.sessionId })
      },
      files,
      gitBadge,
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
  ctx.effect(() => workbench.registerTab({
    id: 'terminal',
    title: () => t('tab.terminal'),
    order: 30,
    hidden: true,
    createTab: (state) => {
      if (!canCreateTerminal(state.tabs)) return null
      const seq = state.nextSeq
      return {
        tab: { id: `terminal:${seq}`, type: 'terminal', title: `${t('tab.terminal')} ${String(seq)}` },
        patch: { nextSeq: seq + 1 },
      }
    },
    component: (props) => {
      const cwd = getTerminalCwd(props.sessionId)
      return createElement(TerminalTab, {
        ...props,
        t,
        host,
        remote,
        ...cwd === undefined ? {} : { cwd },
      })
    },
  }), 'ui-xmart-workbench: terminal tab')
  ctx.effect(() => workbench.registerTab({
    id: 'problems',
    title: () => t('tab.problems'),
    order: 10,
    hidden: true,
    single: true,
    component: props => createElement(ProblemsTab, {
      ...props,
      t,
      checks: checksStore,
      openProblem: (path) => {
        workbench.openFile(path, { sessionId: props.sessionId })
        ctx.layout.openWorkbench()
      },
    }),
  }), 'ui-xmart-workbench: problems tab')
  ctx.effect(() => workbench.registerTab({
    id: 'checks',
    title: () => t('tab.checks'),
    order: 20,
    hidden: true,
    single: true,
    component: props => createElement(ChecksTab, {
      ...props,
      t,
      checks: checksStore,
      remote: { workspaceChecks: workspaceChecksFace() },
      getWorkspaceRoot: () => getCwd(props.sessionId),
      listEntries: async (dir) => {
        try {
          const listing = await ctx.workspaces.listEntries(dir)
          return listing.entries.map(e => ({
            name: e.name,
            kind: e.kind === 'directory' ? 'directory' as const : 'file' as const,
          }))
        } catch {
          return []
        }
      },
      readFile: async (path) => {
        try {
          return await ctx.workspaces.readFile(path)
        } catch {
          return undefined
        }
      },
      gitDirtyPaths: async () => {
        const root = getCwd(props.sessionId)
        if (root === undefined) return []
        try {
          const status = await ctx.workspaces.gitStatus(root)
          return [...new Set(status.changes.map(c => c.path))]
        } catch {
          return []
        }
      },
      openProblems: () => { openBottomTab(props.sessionId as SessionId, 'problems') },
      watchRunningFallingEdge: (cb) => {
        let wasRunning = false
        return ctx.sessions.list.subscribe(() => {
          const snap = ctx.sessions.list.getSnapshot()
          const current = snap.current
          const running = current === undefined
            ? false
            : snap.byId[current]?.running === true
          if (wasRunning && !running) cb()
          wasRunning = running
        })
      },
      askAgent: text => askAgentFix(ctx, props.sessionId, text),
    }),
  }), 'ui-xmart-workbench: checks tab')
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
    component: (props) => {
      const lookup = (key: string): unknown => {
        try {
          return ctx.get(key)
        }
        catch {
          return undefined
        }
      }
      const getWorkspaceRoot = (): string | undefined => {
        try {
          return editorWorkspaceRoot(getCwd(props.sessionId), getRoots(props.sessionId), props.tab.path)
        }
        catch {
          return editorWorkspaceRoot(undefined, [], props.tab.path)
        }
      }
      return createElement(EditorTab, {
        ...props,
        t,
        readFile: (path, signal) => ctx.workspaces.readFile(path, signal),
        writeFile: (path, content) => ctx.workspaces.writeFile(path, content),
        files,
        getWorkspaceRoot,
        watchWorkspace: watchWorkspaceFacts,
        getRemotes: () => peekEditorRemotes(remote, lookup),
        openFile: (path) => { workbench.openFile(path, { sessionId: props.sessionId }) },
      })
    },
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
      gitCommitDiff: (path, commit, signal) => ctx.workspaces.gitCommitDiff(path, commit, signal),
    }),
  }), 'ui-xmart-workbench: diff tab')
  ctx.effect(() => {
    const review = ctx.get('remote.agentReview') as AgentReviewRemote | undefined
    if (review === undefined) return () => {}
    return workbench.registerTab({
      id: 'agent-review-diff',
      title: () => t('review.review'),
      hidden: true,
      dedupeKey: tab => tab.path,
      component: props => createElement(ReviewDiffTab, {
        ...props,
        t,
        review,
        onSettled: () => {
          workbench.closeTab(props.tab.id, { sessionId: props.sessionId })
        },
      }),
    })
  }, 'ui-xmart-workbench: agent-review-diff tab')
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

  const dispatchWindow = (name: string, detail?: string): void => {
    const target = globalThis as { dispatchEvent?: (event: Event) => boolean }
    target.dispatchEvent?.(
      detail === undefined ? new Event(name) : new CustomEvent(name, { detail }),
    )
  }
  const openWorkspace = (): void => {
    void ctx.workspaces.pickDirectory()
      .then((path) => {
        if (path === null || path === '') return
        return ctx.workspaces.create({ path })
      })
      .catch((reason: unknown) => { console.warn('open workspace failed:', reason) })
  }
  const closeActiveEditor = (sessionId: SessionId): void => {
    const tab = activeFileTab(workbench.getSnapshot(sessionId))
    if (tab !== undefined) workbench.closeTab(tab.id, { sessionId })
  }
  const showActivity = (sessionId: SessionId, id: 'explorer' | 'search' | 'git'): void => {
    workbench.setActivity(id, { sessionId })
    ctx.layout.openWorkbench()
  }
  const openTerminalTab = (sessionId: SessionId): string | undefined => {
    const id = workbench.openTab({ type: 'terminal' }, { sessionId })
    if (id !== undefined) ctx.layout.openBottom()
    return id
  }
  const closeTerminalTab = (sessionId: SessionId, tabId: string): void => {
    const tab = workbench.getSnapshot(sessionId).tabs.find(t => t.id === tabId)
    if (tab?.type === 'terminal') {
      const ptyId = clearTerminalSeat(sessionId, tabId)
      if (ptyId !== undefined) void killTerminal(host, sessionId, ptyId)
    }
    workbench.closeTab(tabId, { sessionId })
    const remaining = workbench.getSnapshot(sessionId).tabs.filter(t => isBottomPanelTabType(t.type))
    if (remaining.length === 0) ctx.layout.closeBottom()
  }
  const openBottomTab = (sessionId: SessionId, type: 'problems' | 'checks'): void => {
    const id = workbench.openTab({ type }, { sessionId })
    if (id !== undefined) {
      workbench.activateTab(id, { sessionId })
      ctx.layout.openBottom()
    }
  }
  const toggleTerminalPanel = (sessionId: SessionId): void => {
    if (shouldCreateOnToggle(countTerminalTabs(workbench.getSnapshot(sessionId).tabs))) {
      openTerminalTab(sessionId)
      return
    }
    ctx.layout.toggleBottom()
  }
  const runMenu = (sessionId: SessionId | undefined, command: AppMenuCommand): void => {
    dispatchAppMenu(command, {
      sessionId,
      newSession: () => { ctx.workspaces.startSession() },
      openWorkspace,
      closeActiveEditor: (id) => { closeActiveEditor(id as SessionId) },
      showActivity: (id, activity) => { showActivity(id as SessionId, activity) },
      togglePrimary: () => { ctx.layout.toggleWorkbench() },
      toggleSessions: () => { ctx.layout.toggleSidebar() },
      toggleConversation: () => { ctx.layout.toggleConversation() },
      newTerminal: (id) => { openTerminalTab(id as SessionId) },
      toggleTerminal: (id) => { toggleTerminalPanel(id as SessionId) },
      openBottomTab: (id, type) => { openBottomTab(id as SessionId, type) },
      dispatch: dispatchWindow,
    })
  }
  const onAppMenu = (globalThis as {
    __DSH_IPC__?: { onAppMenu?: (listener: (command: AppMenuCommand) => void) => () => void }
  }).__DSH_IPC__?.onAppMenu
  if (onAppMenu !== undefined) {
    ctx.effect(() => onAppMenu((command) => {
      runMenu(ctx.sessions.list.getSnapshot().current, command)
    }), 'ui-xmart-workbench: desktop app menu')
  }
  const columnInjected = (sessionId: SessionId | undefined): WorkbenchColumnInjected => {
    if (sessionId !== undefined) workbench.bindSession(sessionId)
    return {
      openTab: (type) => { if (sessionId !== undefined) workbench.openTab({ type }, { sessionId }) },
      closeTab: (id) => { if (sessionId !== undefined) workbench.closeTab(id, { sessionId }) },
      activateTab: (id) => { if (sessionId !== undefined) workbench.activateTab(id, { sessionId }) },
      resolveBody: type => workbench.getTab(type)?.component,
      listEntries: (path, signal) => ctx.workspaces.listEntries(path, signal),
      getRoots: () => sessionId === undefined ? [] : getRoots(sessionId),
      openFile: (path) => { if (sessionId !== undefined) workbench.openFile(path, { sessionId }) },
      getRemotes: () => peekEditorRemotes(remote, (key) => {
        try {
          return ctx.get(key)
        }
        catch {
          return undefined
        }
      }),
      getWorkspaceRoot: (filePath) => {
        if (sessionId === undefined) return editorWorkspaceRoot(undefined, [], filePath)
        try {
          return editorWorkspaceRoot(getCwd(sessionId), getRoots(sessionId), filePath)
        }
        catch {
          return editorWorkspaceRoot(undefined, [], filePath)
        }
      },
      watchWorkspace: watchWorkspaceFacts,
      readFile: (path, signal) => ctx.workspaces.readFile(path, signal),
      files,
      hooks: {
        workbenchSession: sessionId === undefined ? EMPTY_SESSION_SOURCE : workbench.observeSession(sessionId),
        workbenchRegistry: workbench.observeRegistry(),
      },
    }
  }
  const activityInjected = (sessionId: SessionId | undefined): ActivityBarInjected => ({
    setActivity: (id) => { if (sessionId !== undefined) workbench.setActivity(id, { sessionId }) },
    resolveIcon: id => workbench.getActivity(id)?.icon,
    openPrimary: () => {
      if (sessionId !== undefined) {
        const inst = persist.create(sessionId)
        const remembered = inst.getSnapshot().width
        inst.actions.rememberOpen(remembered > 0 ? remembered : WORKBENCH_PERSIST_DEFAULT)
      }
      ctx.layout.openWorkbench()
    },
    closePrimary: () => { ctx.layout.closeWorkbench() },
    hooks: {
      workbenchSession: sessionId === undefined ? EMPTY_SESSION_SOURCE : workbench.observeSession(sessionId),
      workbenchRegistry: workbench.observeRegistry(),
      gitBadge: {
        getSnapshot: () => sessionId === undefined ? EMPTY_GIT_BADGE : gitBadge.getSnapshot(sessionId),
        subscribe: fn => gitBadge.subscribe(fn),
      },
    },
  })
  const primaryInjected = (sessionId: SessionId | undefined): PrimarySidebarInjected => {
    const inst = sessionId === undefined ? undefined : persist.create(sessionId)
    return {
      closeWorkbench: () => { ctx.layout.closeWorkbench() },
      setWorkbench: (px) => { ctx.layout.setWorkbench(px) },
      resolveBody: type => workbench.getActivity(type)?.component ?? workbench.getTab(type)?.component,
      refreshExplorer: () => { files.bumpRefresh() },
      projectKey,
      keepLiveWidth: () => sessionId !== undefined && skipPersistRestoreFor === sessionId,
      actions: inst?.actions ?? NOOP_PERSIST_ACTIONS,
      hooks: {
        workbenchSession: sessionId === undefined ? EMPTY_SESSION_SOURCE : workbench.observeSession(sessionId),
        workbenchRegistry: workbench.observeRegistry(),
        workbenchPersist: inst ?? EMPTY_PERSIST_SOURCE,
      },
    }
  }
  const menuInjected = (sessionId: SessionId | undefined): MenuBarInjected => ({
    run: (command) => { runMenu(sessionId, command) },
    hooks: {
      workbenchSession: sessionId === undefined ? EMPTY_SESSION_SOURCE : workbench.observeSession(sessionId),
    },
  })
  const bottomInjected = (sessionId: SessionId | undefined): BottomPanelInjected => ({
    resolveBody: type => workbench.getTab(type)?.component,
    activateTab: (id) => { if (sessionId !== undefined) workbench.activateTab(id, { sessionId }) },
    closeTab: (id) => { if (sessionId !== undefined) closeTerminalTab(sessionId, id) },
    newTerminal: () => { if (sessionId !== undefined) openTerminalTab(sessionId) },
    hooks: {
      workbenchSession: sessionId === undefined ? EMPTY_SESSION_SOURCE : workbench.observeSession(sessionId),
    },
  })
  const settingsInjected = (): WorkbenchSettingsInjected => ({
    setTabEnabled: (id, enabled) => { workbench.setTabEnabled(id, enabled) },
    setViewerEnabled: (id, enabled) => { workbench.setViewerEnabled(id, enabled) },
    hooks: { workbenchRegistry: workbench.observeRegistry() },
  })

  ctx.slots.inject('menuBar', () => ctx.slots.register(
    { name: 'menuBar', inject: menuInjected, locale: NS },
    MenuBar,
  ))
  ctx.slots.inject('activityBar', () => ctx.slots.register(
    { name: 'activityBar', inject: activityInjected, locale: NS },
    ActivityBar,
  ))
  ctx.slots.inject('primarySidebar', () => ctx.slots.register(
    { name: 'primarySidebar', inject: primaryInjected, locale: NS },
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

  ctx.effect(() => {
    const review = ctx.get('remote.agentReview') as AgentReviewRemote | undefined
    if (review === undefined) return () => {}
    const openReviewDiff = (sessionId: SessionId, path: string, turn: number) => {
      ctx.layout.openWorkbench()
      workbench.openTab({
        type: 'agent-review-diff',
        path: encodeAgentReviewPath(turn, path),
        title: basename(path),
      }, { sessionId })
    }
    return ctx.slots.register({
      name: 'conversation.input.dock',
      id: 'agent-review-dock',
      order: 50,
      locale: NS,
      inject: (sessionId: SessionId) => ({
        sessionId,
        t,
        review,
        files,
        openReviewDiff: (path: string, turn: number) => {
          openReviewDiff(sessionId, path, turn)
        },
      }),
    }, ReviewDock)
  }, 'ui-xmart-workbench: review-dock')
}
