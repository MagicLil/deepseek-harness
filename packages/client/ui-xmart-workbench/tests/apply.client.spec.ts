import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { GitAccessError, SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject, XmartWorkbenchController } from '@deepseek-ai/dsh-client-ui-xmart-workbench/client'
import type {
  ActivityBarInjected, BottomPanelInjected, MenuBarInjected, PrimarySidebarInjected,
  WorkbenchColumnInjected, WorkbenchSettingsInjected,
} from '@deepseek-ai/dsh-client-ui-xmart-workbench/client'
import { WorkbenchColumn } from '../src/client/WorkbenchColumn.tsx'
import { ActivityBar } from '../src/client/ActivityBar.tsx'
import { PrimarySidebar } from '../src/client/PrimarySidebar.tsx'
import { MenuBar } from '../src/client/MenuBar.tsx'
import { BottomPanel } from '../src/client/BottomPanel.tsx'
import { WorkbenchSettingsSection } from '../src/client/WorkbenchSettingsSection.tsx'
import { apply as nodeApply } from '@deepseek-ai/dsh-client-ui-xmart-workbench'
import * as invariant from '@deepseek-ai/dsh-client-ui-xmart-workbench/invariant'
import { XMART_ACCENT_TOKENS } from '../src/client/brand-accent.ts'
import { takeReveal } from '../src/client/editor-nav.ts'

usePinnedBrowserLanguages('zh-CN')

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const layout = {
    openWorkbench: vi.fn(),
    closeWorkbench: vi.fn(),
    setWorkbench: vi.fn(),
    toggleWorkbench: vi.fn(),
    toggleBottom: vi.fn(),
    toggleSidebar: vi.fn(),
    toggleConversation: vi.fn(),
    openBottom: vi.fn(),
    closeBottom: vi.fn(),
    setBottomHeight: vi.fn(),
    setPrimarySidebar: vi.fn(),
  }
  ctx.provide('layout', layout)
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const setDraft = vi.fn()
  const sessionById: Record<string, { cwd?: string; running?: boolean; blank?: boolean }> = {
    s1: { cwd: '/ws', running: true },
  }
  const workspaceState = {
    items: [] as { workspaceId: string; path: string; title: string; sessionIds: string[] }[],
    recentWorkspaceId: undefined as string | undefined,
  }
  const sessionList = { current: 's1' as string }
  const sessionListeners = new Set<() => void>()
  const sessions = {
    list: {
      getSnapshot: () => ({
        current: sessionList.current,
        byId: sessionById,
        jobsBySession: {},
        subagentsByParent: {},
      }),
      subscribe: (fn?: () => void) => {
        if (fn !== undefined) sessionListeners.add(fn)
        fn?.()
        return () => { if (fn !== undefined) sessionListeners.delete(fn) }
      },
    },
    scope: (id: string) => id === 's1' ? ({}) : undefined,
    binding: (id: string) => {
      if (id !== 's1') return undefined
      return {
        session: {
          getSnapshot: () => ({}),
          subscribe: () => () => {},
        },
      }
    },
  }
  const workspaces = {
    list: {
      getSnapshot: () => workspaceState,
      subscribe: (fn?: () => void) => {
        fn?.()
        return () => {}
      },
    },
    listEntries: vi.fn(async () => ({
      path: '/ws',
      entries: [] as { name: string; path: string; kind: 'file' | 'directory'; hidden: boolean }[],
      truncated: false,
    })),
    gitStatus: vi.fn(async (_path: string) => ({
      root: '/ws', branch: 'main', ahead: 0, behind: 0, detached: false,
      changes: [] as { path: string; status: string; area: string }[],
    })),
    gitDiff: vi.fn(async () => ({ root: '/ws', side: 'worktree', text: '' })),
    gitStage: vi.fn(async () => {}),
    gitUnstage: vi.fn(async () => {}),
    gitDiscard: vi.fn(async () => {}),
    gitCommit: vi.fn(async () => ({ root: '/ws', hash: 'abc' })),
    gitLog: vi.fn(async () => []),
    gitSync: vi.fn(async () => {}),
    gitBranches: vi.fn(async () => []),
    gitCheckout: vi.fn(async () => {}),
    gitCheckoutCommit: vi.fn(async () => {}),
    gitSuggestCommit: vi.fn(async () => ({ message: 'chore: generated' })),
    gitCommitDiff: vi.fn(async () => ({ root: '/ws', side: 'worktree' as const, text: '' })),
    readFile: vi.fn(async () => 'hi'),
    readFileBytes: vi.fn(async () => ({ bytes: new Uint8Array(), mimeType: 'application/octet-stream' })),
    writeFile: vi.fn(async () => {}),
    renameEntry: vi.fn(async () => '/ws/b.ts'),
    deleteEntry: vi.fn(async () => {}),
    search: vi.fn(async () => ({ root: '/ws', hits: [], fileCount: 0, truncated: false })),
    createDirectory: vi.fn(async () => '/ws/n'),
    openPath: vi.fn(async () => {}),
    startSession: vi.fn(),
    pickDirectory: vi.fn(async () => '/ws/picked'),
    create: vi.fn(async (input: { path: string }) => ({ path: input.path })),
  }
  const conversation = {
    input: {
      for: () => ({
        setDraft,
        state: { getSnapshot: () => ({ draft: 'hello', draftRev: 1 }) },
      }),
    },
  }
  const conversationEvents = { register: vi.fn(() => () => {}) }
  ctx.provide('sessions', sessions)
  ctx.provide('workspaces', workspaces)
  ctx.provide('conversation', conversation)
  ctx.provide('conversationEvents', conversationEvents)
  ctx.provide('connection', { api: { host: {} } })
  ctx.provide('remote', { $on: () => () => {} })
  const overrideTokens = vi.fn(() => () => {})
  const getTheme = vi.fn(() => ({
    preference: 'light' as const,
    active: { id: 'light', colorScheme: 'light' as const, tokens: {} },
    themes: [],
    revision: 1,
  }))
  ctx.provide('theme', { overrideTokens, getTheme })
  return {
    ctx, slots: ctx.get('slots') as SlotRegistry, locale, layout,
    setDraft, conversationEvents, sessions,
    sessionById, workspaceState, overrideTokens, getTheme, sessionList, sessionListeners,
    workspaces,
  }
}

function workbench(ctx: Context): XmartWorkbenchController {
  return ctx.get('xmartWorkbench') as XmartWorkbenchController
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: {
      menuBar: { kind: 'single', scope: 'session-maybe' },
      activityBar: { kind: 'single', scope: 'session-maybe' },
      primarySidebar: { kind: 'single', scope: 'session-maybe' },
      workbench: { kind: 'single', scope: 'session-maybe' },
      bottomPanel: { kind: 'single', scope: 'session-maybe' },
      'settings.section': { kind: 'list', scope: 'root' },
      'conversation.input.dock': { kind: 'list', scope: 'session' },
      'tool.call.toolview': { kind: 'keyed', scope: 'session' },
    },
  } as never, () => null)
}

describe('ui-xmart-workbench apply', () => {
  it('declares the services it drives', () => {
    expect(inject).toEqual([
      'slots', 'locale', 'layout', 'workspaces', 'sessions', 'conversation', 'conversationEvents',
      'connection', 'remote', 'theme',
    ])
  })

  it('provides ctx.xmartWorkbench and registers the built-in tab types', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const service = workbench(b.ctx)
    expect(service).toBeInstanceOf(XmartWorkbenchController)
    expect(b.conversationEvents.register).toHaveBeenCalledOnce()
    const explorer = service.getTab('explorer')
    const demo = service.getTab('demo')
    const file = service.getTab('file')
    const editor = service.getTab('editor')
    expect(explorer?.single).toBe(true)
    expect(demo?.single).toBe(true)
    expect(demo?.hidden).toBe(true)
    expect(file?.hidden).toBe(true)
    expect(editor?.hidden).toBe(true)
    expect(service.getTab('git')?.single).toBe(true)
    expect(service.getTab('diff')?.hidden).toBe(true)
    expect(service.getTab('git')?.hidden).toBe(true)
    expect(service.getTab('explorer')?.hidden).toBe(true)
    expect(service.getTab('tasks')).toBeUndefined()
    expect(service.getTab('terminal')?.hidden).toBe(true)
    expect(service.getTab('git')?.available?.({ sessionId: 's1' }, { tabs: [], activeTabId: null, nextSeq: 1, activity: 'explorer' })).toBe(true)
    expect(service.getTab('git')?.available?.({ sessionId: 'missing' }, { tabs: [], activeTabId: null, nextSeq: 1, activity: 'explorer' })).toBe(false)
    expect(service.getTab('diff')?.dedupeKey?.({ id: 'd', type: 'diff', title: 'a', path: 'worktree:a.ts' }))
      .toBe('worktree:a.ts')
    const chatOpen = b.ctx.get('chatFileOpen')
    expect(chatOpen?.open('/ws/a.ts')).toBe(true)
    expect(service.getSnapshot('s1').tabs.some(tab => tab.path === '/ws/a.ts')).toBe(true)
    expect(explorer?.available?.({ sessionId: 's1' }, { tabs: [], activeTabId: null, nextSeq: 1, activity: 'explorer' })).toBe(true)
    expect(explorer?.available?.({ sessionId: 'missing' }, { tabs: [], activeTabId: null, nextSeq: 1, activity: 'explorer' })).toBe(false)
    const explorerTitle = explorer?.title
    expect(typeof explorerTitle === 'function' ? explorerTitle() : explorerTitle).toBe('资源管理器')
    const demoTitle = demo?.title
    const fileTitle = file?.title
    expect(typeof demoTitle === 'function' ? demoTitle() : demoTitle).toBe('演示')
    expect(typeof fileTitle === 'function' ? fileTitle() : fileTitle).toBe('文件')
    expect(file?.dedupeKey?.({ id: 'f', type: 'file', title: 'a', path: '/p' })).toBe('/p')
    expect(editor?.dedupeKey?.({ id: 'e', type: 'editor', title: 'a', path: '/p' })).toBe('/p')
    expect(service.getFileViewers().map(row => row.id)).toEqual([
      'binary-download', 'image', 'markdown', 'code',
    ])
    expect(service.matchFileViewer('a.md')?.id).toBe('markdown')
    expect(service.matchFileViewer('a.bin', new Uint8Array([0]))?.id).toBe('binary-download')
    expect(b.locale.bind('workbench')('tab.demo')).toBe('演示')
    expect(b.overrideTokens).toHaveBeenCalledWith('ui-xmart-workbench', XMART_ACCENT_TOKENS)
  })

  it('pushes the resolved scheme to the desktop caption overlay', async () => {
    const setTitleBarOverlay = vi.fn()
    const g = globalThis as { __DSH_IPC__?: { setTitleBarOverlay: typeof setTitleBarOverlay } }
    const previous = g.__DSH_IPC__
    g.__DSH_IPC__ = { setTitleBarOverlay }
    try {
      const b = await bench()
      declare(b.slots)
      const fiber = b.ctx.plugin({ inject: [...inject], apply })
      await fiber.await()
      expect(setTitleBarOverlay).toHaveBeenCalledWith('light')
      b.ctx.emit('theme/change', {
        preference: 'dark',
        active: { id: 'dark', colorScheme: 'dark', tokens: {} },
        themes: [],
        revision: 2,
      })
      expect(setTitleBarOverlay).toHaveBeenCalledWith('dark')
      await fiber.dispose()
    } finally {
      if (previous === undefined) delete g.__DSH_IPC__
      else g.__DSH_IPC__ = previous
    }
  })

  it('registers the column, activity bar, primary sidebar, bottom panel, and settings section', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    expect(b.slots.entries('workbench')[0]!.component).toBe(WorkbenchColumn)
    expect(b.slots.entries('workbench')[0]!.locale).toBe('workbench')
    expect(b.locale.bind('workbench')('column.title')).toBe('工作台')
    expect(b.slots.entries('menuBar')[0]!.component).toBe(MenuBar)
    expect(b.slots.entries('activityBar')[0]!.component).toBe(ActivityBar)
    expect(b.slots.entries('primarySidebar')[0]!.component).toBe(PrimarySidebar)
    expect(b.slots.entries('bottomPanel')[0]!.component).toBe(BottomPanel)
    const section = b.slots.entries('settings.section')[0]
    expect(section?.component).toBe(WorkbenchSettingsSection)
    expect(section?.options.id).toBe('workbench')
    expect(section?.options.order).toBe(25)
    const label = section?.options.label
    expect(typeof label === 'function' ? label() : label).toBe('工作台')
  })

  it('uses the current session folder as the only explorer root when cwd is missing', async () => {
    const b = await bench()
    const session = b.sessionById.s1
    expect(session).toBeDefined()
    delete session!.cwd
    b.workspaceState.items = [
      { workspaceId: 'w1', path: 'D:\\hmdp', title: 'hmdp', sessionIds: ['s1'] },
      { workspaceId: 'w2', path: 'D:\\tool', title: 'tool', sessionIds: [] },
    ]
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const service = workbench(b.ctx)
    const empty = { tabs: [], activeTabId: null, nextSeq: 1, activity: 'explorer' as const }
    expect(service.getTab('explorer')?.available?.({ sessionId: 's1' }, empty)).toBe(true)
    expect(service.getTab('git')?.available?.({ sessionId: 's1' }, empty)).toBe(true)
    const column = (
      b.slots.entries('workbench')[0]!.inject as unknown as (id: string) => WorkbenchColumnInjected
    )('s1')
    expect(column.getRoots?.()).toEqual([{ path: 'D:\\hmdp', title: 'hmdp' }])
    await column.listEntries?.('/ws')
    column.openFile?.('/ws/a.ts')
    const Explorer = column.resolveBody('explorer')
    expect(Explorer).toBeTypeOf('function')
    if (typeof Explorer !== 'function') return
    const explorerEl = (Explorer as (props: {
      tab: { id: string; type: string; title: string }
      visible: boolean
      sessionId: string
    }) => { props: { getRoots: (id: string) => { path: string; title: string }[] } })({
      tab: { id: 'e', type: 'explorer', title: '资源管理器' }, visible: true, sessionId: 's1',
    })
    expect(explorerEl.props.getRoots('s1')).toEqual([
      { path: 'D:\\hmdp', title: 'hmdp' },
    ])
  })

  it('keeps editor and terminal tabs when switching chats in the same project', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const service = workbench(b.ctx)
    service.openFile('/ws/a.ts', { sessionId: 's1' })
    service.openTab({ type: 'terminal' }, { sessionId: 's1' })
    service.setActivity('git', { sessionId: 's1' })
    b.sessionById.s2 = { cwd: '/ws', blank: false }
    b.sessionList.current = 's2'
    for (const fn of b.sessionListeners) fn()
    expect(service.getSnapshot('s2').tabs.map(row => row.type)).toEqual(['editor', 'terminal'])
    expect(service.getSnapshot('s2').tabs.map(row => row.path)).toEqual(['/ws/a.ts', undefined])
    expect(service.getSnapshot('s2').activity).toBe('git')
    expect(service.observeSession('s1')).toBe(service.observeSession('s2'))
    const primary = (
      b.slots.entries('primarySidebar')[0]!.inject as unknown as (id: string) => PrimarySidebarInjected
    )('s2')
    expect(primary.keepLiveWidth()).toBe(true)
  })

  it('keeps the live workbench when a new same-project session has no cwd yet', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const service = workbench(b.ctx)
    service.openFile('/ws/a.ts', { sessionId: 's1' })
    service.openTab({ type: 'terminal' }, { sessionId: 's1' })
    b.sessionById.s3 = { blank: true }
    b.sessionList.current = 's3'
    for (const fn of b.sessionListeners) fn()
    expect(service.scopeOf('s3')).toBe('/ws')
    expect(service.getSnapshot('s3').tabs.map(row => row.type)).toEqual(['editor', 'terminal'])
  })

  it('does not inherit into another project', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const service = workbench(b.ctx)
    service.openFile('/ws/a.ts', { sessionId: 's1' })
    b.sessionById.s2 = { cwd: '/other', blank: true }
    b.sessionList.current = 's2'
    for (const fn of b.sessionListeners) fn()
    expect(service.getSnapshot('s2').tabs).toEqual([])
    expect(b.layout.setWorkbench).not.toHaveBeenCalled()
    const primary = (
      b.slots.entries('primarySidebar')[0]!.inject as unknown as (id: string) => PrimarySidebarInjected
    )('s2')
    expect(primary.keepLiveWidth()).toBe(false)
  })

  it('routes column and toggle inject callbacks to ctx.layout and the service', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const column = (
      b.slots.entries('workbench')[0]!.inject as unknown as (id: string) => WorkbenchColumnInjected
    )('s1')
    expect(column.getWorkspaceRoot?.('/ws/a.ts')).toBe('/ws')
    expect(column.getRemotes?.()).toEqual({})
    expect(column.readFile).toBeTypeOf('function')
    const primary = (
      b.slots.entries('primarySidebar')[0]!.inject as unknown as (id: string) => PrimarySidebarInjected
    )('s1')
    const activity = (
      b.slots.entries('activityBar')[0]!.inject as unknown as (id: string) => ActivityBarInjected
    )('s1')
    const menu = (
      b.slots.entries('menuBar')[0]!.inject as unknown as (id: string) => MenuBarInjected
    )('s1')
    const bottom = (
      b.slots.entries('bottomPanel')[0]!.inject as unknown as (id: string) => BottomPanelInjected
    )('s1')
    expect(primary.hooks.workbenchPersist.getSnapshot()).toMatchObject({ open: true, width: 260 })
    const blankPrimary = (
      b.slots.entries('primarySidebar')[0]!.inject as unknown as (
        id: string | undefined,
      ) => PrimarySidebarInjected
    )(undefined)
    expect(blankPrimary.hooks.workbenchPersist.getSnapshot()).toMatchObject({ open: true, width: 260 })
    blankPrimary.actions.rememberOpen(400)
    blankPrimary.actions.rememberClosed()
    primary.closeWorkbench()
    primary.setWorkbench(480)
    expect(b.layout.closeWorkbench).toHaveBeenCalledOnce()
    expect(b.layout.setWorkbench).toHaveBeenCalledWith(480)
    activity.setActivity('git')
    activity.openPrimary()
    expect(b.layout.openWorkbench).toHaveBeenCalledOnce()
    activity.closePrimary()
    const offBadge = activity.hooks.gitBadge.subscribe(() => {})
    offBadge()
    expect(activity.hooks.gitBadge.getSnapshot()).toMatchObject({ staged: 0, unstaged: 0 })
    await vi.waitFor(() => {
      expect(b.workspaces.gitStatus).toHaveBeenCalled()
    })
    menu.run('terminal-toggle')
    menu.run('terminal-toggle')
    expect(b.layout.toggleBottom).toHaveBeenCalledOnce()
    menu.run('terminal-new')
    menu.run('terminal-new')
    expect(workbench(b.ctx).getSnapshot('s1').tabs.filter(row => row.type === 'terminal')).toHaveLength(3)
    const firstTerm = workbench(b.ctx).getSnapshot('s1').tabs.find(row => row.type === 'terminal')
    expect(firstTerm).toBeDefined()
    if (firstTerm !== undefined) {
      bottom.activateTab(firstTerm.id)
      bottom.closeTab(firstTerm.id)
    }
    bottom.newTerminal()
    expect(activity.resolveIcon('explorer')).toBeTypeOf('function')
    expect(activity.resolveIcon('missing')).toBeUndefined()
    expect(activity.hooks.workbenchRegistry.getSnapshot().activities.map(row => row.id))
      .toEqual(['explorer', 'search', 'git'])
    expect(column.hooks.workbenchRegistry.getSnapshot().tabs.some(row => row.id === 'explorer')).toBe(true)
    expect(primary.hooks.workbenchRegistry.getSnapshot().activities).toHaveLength(3)
    expect(primary.resolveBody('missing')).toBeUndefined()
    primary.refreshExplorer()
    expect(workbench(b.ctx).getSnapshot('s1').activity).toBe('git')
    expect(b.layout.openWorkbench).toHaveBeenCalled()
    expect(b.layout.closeWorkbench).toHaveBeenCalledTimes(2)
    expect(b.layout.openBottom).toHaveBeenCalled()
    expect(activity.resolveIcon('git')).toBeTypeOf('function')
    expect(activity.resolveIcon('missing')).toBeUndefined()
    expect(primary.resolveBody('explorer')).toBeTypeOf('function')
    expect(primary.resolveBody('search')).toBeTypeOf('function')
    expect(primary.resolveBody('demo')).toBeTypeOf('function')
    const Search = primary.resolveBody('search')
    if (typeof Search === 'function') {
      const searchEl = (Search as (props: {
        tab: { id: string; type: string; title: string }
        visible: boolean
        sessionId: string
      }) => { props: {
        search: (path: string, query: string, options: object, signal?: AbortSignal) => Promise<unknown>
        openHit: (sessionId: string, path: string, reveal: { line: number; character: number }) => void
      } })({
        tab: { id: 'se', type: 'search', title: '搜索' }, visible: true, sessionId: 's1',
      })
      await searchEl.props.search('/ws', 'js', { regex: false })
      expect(b.workspaces.search).toHaveBeenCalledWith('/ws', 'js', { regex: false }, undefined)
      searchEl.props.openHit('s1', '/ws/found.ts', { line: 2, character: 0 })
      expect(workbench(b.ctx).getSnapshot('s1').tabs.some(row => row.path === '/ws/found.ts')).toBe(true)
    }
    expect(bottom.resolveBody('terminal')).toBeTypeOf('function')
    column.openTab('demo')
    const service = workbench(b.ctx)
    const opened = service.getSnapshot('s1').tabs.find(row => row.type === 'demo')
    expect(opened?.type).toBe('demo')
    expect(opened).toBeDefined()
    if (opened === undefined) return
    column.activateTab(opened.id)
    column.closeTab(opened.id)
    expect(service.getSnapshot('s1').tabs.some(row => row.type === 'demo')).toBe(false)
    const Demo = column.resolveBody('demo')
    const File = column.resolveBody('file')
    const Explorer = column.resolveBody('explorer')
    const Editor = column.resolveBody('editor')
    const Image = column.resolveBody('image')
    const Binary = column.resolveBody('binary')
    expect(Demo).toBeTypeOf('function')
    expect(File).toBeTypeOf('function')
    if (
      typeof Demo !== 'function' || typeof File !== 'function'
      || typeof Explorer !== 'function' || typeof Editor !== 'function'
      || typeof Image !== 'function' || typeof Binary !== 'function'
    ) return
    type TabProps = { tab: { id: string; type: string; title: string; path?: string }; visible: boolean; sessionId: string }
    const renderDemo = Demo as (props: TabProps) => unknown
    const renderFile = File as (props: TabProps) => unknown
    const renderBody = Explorer as typeof renderFile
    expect(renderDemo({
      tab: { id: 'd', type: 'demo', title: '演示' }, visible: true, sessionId: 's1',
    })).toBeTruthy()
    expect(renderFile({
      tab: { id: 'f', type: 'file', title: 'a.ts', path: '/p/a.ts' }, visible: true, sessionId: 's1',
    })).toBeTruthy()
    expect(renderBody({
      tab: { id: 'e', type: 'explorer', title: '资源管理器' }, visible: true, sessionId: 's1',
    })).toBeTruthy()
    expect((Editor as typeof renderFile)({
      tab: { id: 'ed', type: 'editor', title: 'a.ts', path: '/p/a.ts' }, visible: true, sessionId: 's1',
    })).toBeTruthy()
    const lspRemote = {
      open: async () => ({ ok: true as const, value: undefined }),
      change: async () => ({ ok: true as const, value: undefined }),
      close: async () => ({ ok: true as const, value: undefined }),
      complete: async () => ({ ok: true as const, value: { items: [] } }),
      diagnostics: async () => ({ ok: true as const, value: { items: [] } }),
      definition: async () => ({ ok: true as const, value: { items: [] } }),
      hover: async () => ({ ok: true as const, value: {} }),
      references: async () => ({ ok: true as const, value: { items: [] } }),
      implementation: async () => ({ ok: true as const, value: { items: [] } }),
    }
    Object.assign(b.ctx.get('remote') as object, {
      vueLsp: lspRemote, tsLsp: lspRemote, javaLsp: lspRemote,
    })
    const withBag = (Editor as typeof renderFile)({
      tab: { id: 'ed', type: 'editor', title: 'a.ts', path: '/p/a.ts' }, visible: true, sessionId: 's1',
    }) as { props: { getRemotes: () => { tsLsp?: unknown }; getWorkspaceRoot: () => string | undefined } }
    expect(withBag.props.getRemotes().tsLsp).toBe(lspRemote)
    expect(withBag.props.getWorkspaceRoot()).toBe('/p')
    b.ctx.provide('remote.javaLsp', lspRemote)
    const withService = (Editor as typeof renderFile)({
      tab: { id: 'ed', type: 'editor', title: 'F.java', path: '/ws/src/main/java/F.java' },
      visible: true, sessionId: 's1',
    }) as { props: { getRemotes: () => { javaLsp?: unknown } } }
    expect(withService.props.getRemotes().javaLsp).toBe(lspRemote)
    expect((Image as typeof renderFile)({
      tab: { id: 'im', type: 'image', title: 'a.png', path: '/p/a.png' }, visible: true, sessionId: 's1',
    })).toBeTruthy()
    expect((Binary as typeof renderFile)({
      tab: { id: 'bi', type: 'binary', title: 'a.bin', path: '/p/a.bin' }, visible: true, sessionId: 's1',
    })).toBeTruthy()
    const explorerEl = renderBody({
      tab: { id: 'e', type: 'explorer', title: '资源管理器' }, visible: true, sessionId: 's1',
    }) as { props: {
      mentionFile: (path: string) => void
      listEntries: (path: string) => Promise<unknown>
      gitStatus: (path: string) => Promise<unknown>
      writeFile: (path: string, content: string) => Promise<void>
      createDirectory: (path: string, name: string) => Promise<string>
      renameEntry: (path: string, name: string) => Promise<string>
      deleteEntry: (path: string) => Promise<void>
      onRenamed: (from: string, to: string) => void
      onDeleted: (path: string) => void
      openSystem: (path: string) => Promise<void>
      openFile: (path: string) => void
      watchSessions: (fn: () => void) => () => void
      getRoots: (id: string) => { path: string; title: string }[]
      getActivePath: (id: string) => string | undefined
      watchWorkbench: (fn: () => void) => () => void
    } }
    await explorerEl.props.listEntries('/ws')
    await explorerEl.props.gitStatus('/ws')
    await explorerEl.props.writeFile('/ws/a.ts', '')
    await explorerEl.props.createDirectory('/ws', 'n')
    await explorerEl.props.renameEntry('/ws/a.ts', 'b.ts')
    await explorerEl.props.deleteEntry('/ws/b.ts')
    explorerEl.props.onRenamed('/ws/a.ts', '/ws/b.ts')
    explorerEl.props.onDeleted('/ws/gone.ts')
    await explorerEl.props.openSystem('/ws/a.ts')
    explorerEl.props.openFile('/ws/a.ts')
    explorerEl.props.watchSessions(() => {})()
    expect(explorerEl.props.getRoots('s1')).toEqual([{ path: '/ws', title: 'ws' }])
    expect(workbench(b.ctx).getSnapshot('s1').tabs.some(row => row.path === '/ws/a.ts' && row.type === 'editor')).toBe(true)
    expect(explorerEl.props.getActivePath('s1')).toBe('/ws/a.ts')
    explorerEl.props.watchWorkbench(() => {})()
    const editorEl = (Editor as typeof renderFile)({
      tab: { id: 'ed', type: 'editor', title: 'a.ts', path: '/p/a.ts' }, visible: true, sessionId: 's1',
    }) as { props: {
      readFile: (path: string) => Promise<string>
      writeFile: (path: string, content: string) => Promise<void>
      openFile: (path: string) => void
    } }
    await editorEl.props.readFile('/p/a.ts')
    await editorEl.props.writeFile('/p/a.ts', 'x')
    editorEl.props.openFile('/p/Other.java')
    expect(service.getSnapshot('s1').tabs.some(row => row.path === '/p/Other.java')).toBe(true)
    const imageEl = (Image as typeof renderFile)({
      tab: { id: 'im', type: 'image', title: 'a.png', path: '/p/a.png' }, visible: true, sessionId: 's1',
    }) as { props: {
      openSystem: (path: string) => Promise<void>
      readFileBytes: (path: string) => Promise<{ bytes: Uint8Array; mimeType: string }>
    } }
    await imageEl.props.openSystem('/p/a.png')
    await imageEl.props.readFileBytes('/p/a.png')
    const binaryEl = (Binary as typeof renderFile)({
      tab: { id: 'bi', type: 'binary', title: 'a.bin', path: '/p/a.bin' }, visible: true, sessionId: 's1',
    }) as { props: { openSystem: (path: string) => Promise<void> } }
    await binaryEl.props.openSystem('/p/a.bin')
    const Git = column.resolveBody('git')
    const Diff = column.resolveBody('diff')
    const Terminal = column.resolveBody('terminal')
    expect(Git).toBeTypeOf('function')
    expect(Diff).toBeTypeOf('function')
    expect(column.resolveBody('tasks')).toBeUndefined()
    expect(Terminal).toBeTypeOf('function')
    if (
      typeof Git !== 'function' || typeof Diff !== 'function'
      || typeof Terminal !== 'function'
    ) return
    expect((Terminal as typeof renderFile)({
      tab: { id: 'tm', type: 'terminal', title: '终端' }, visible: true, sessionId: 's1',
    })).toBeTruthy()
    const gitEl = (Git as typeof renderFile)({
      tab: { id: 'g', type: 'git', title: 'Git' }, visible: true, sessionId: 's1',
    }) as { props: {
      listEntries: (path: string) => Promise<unknown>
      gitStatus: (path: string) => Promise<unknown>
      gitStage: (path: string, files: string[]) => Promise<void>
      gitUnstage: (path: string, files: string[]) => Promise<void>
      gitDiscard: (path: string, files: string[]) => Promise<void>
      gitCommit: (path: string, message: string) => Promise<unknown>
      gitLog: (path: string, limit?: number, signal?: AbortSignal, skip?: number) => Promise<unknown>
      gitSync: (path: string, mode: 'fetch' | 'pull' | 'push') => Promise<void>
      gitBranches: (path: string) => Promise<unknown>
      gitCheckout: (path: string, name: string, create?: boolean) => Promise<void>
      gitCheckoutCommit: (path: string, hash: string) => Promise<void>
      gitSuggestCommit: (path: string, sessionId: string) => Promise<{ message: string }>
      openFile: (path: string) => void
      openDiff: (side: 'worktree' | 'staged', file: string, root?: string) => void
      openCommit: (hash: string, subject: string, root?: string) => void
      watchSessions: (fn: () => void) => () => void
      getCwd: (id: string) => string | undefined
      getWorkspacePaths: () => readonly string[]
    } }
    await gitEl.props.listEntries('/ws')
    await gitEl.props.gitStatus('/ws')
    await gitEl.props.gitStage('/ws', ['a.ts'])
    await gitEl.props.gitUnstage('/ws', ['a.ts'])
    await gitEl.props.gitDiscard('/ws', ['a.ts'])
    await gitEl.props.gitCommit('/ws', 'm')
    await gitEl.props.gitLog('/ws', 5)
    await gitEl.props.gitLog('/ws', 80, undefined, 80)
    await gitEl.props.gitSync('/ws', 'fetch')
    await gitEl.props.gitBranches('/ws')
    await gitEl.props.gitCheckout('/ws', 'feat', true)
    await gitEl.props.gitCheckoutCommit('/ws', 'abcdef1')
    await gitEl.props.gitSuggestCommit('/ws', 's1')
    gitEl.props.openFile('/ws/a.ts')
    gitEl.props.openDiff('worktree', 'a.ts')
    gitEl.props.openDiff('worktree', 'a.ts', '/child')
    gitEl.props.openCommit('abcdef1', 'init')
    gitEl.props.openCommit('abcdef1', 'init', '/child')
    gitEl.props.watchSessions(() => {})()
    expect(gitEl.props.getCwd('s1')).toBe('/ws')
    b.workspaceState.items = [
      { workspaceId: 'w1', path: '/ws', title: 'ws', sessionIds: ['s1'] },
      { workspaceId: 'w2', path: '/other', title: 'other', sessionIds: [] },
    ]
    expect(gitEl.props.getWorkspacePaths()).toEqual(['/ws'])
    expect(service.getSnapshot('s1').tabs.some(row => row.type === 'diff')).toBe(true)
    expect(service.getSnapshot('s1').tabs.some(row => row.path === 'commit:abcdef1')).toBe(true)
    expect(service.getSnapshot('s1').tabs.some(row => row.path === 'worktree:a.ts\x1e/child')).toBe(true)
    expect(service.getSnapshot('s1').tabs.some(row => row.path === 'commit:abcdef1\x1e/child')).toBe(true)
    const diffEl = (Diff as typeof renderFile)({
      tab: { id: 'df', type: 'diff', title: 'a.ts', path: 'worktree:a.ts' }, visible: true, sessionId: 's1',
    }) as { props: {
      gitDiff: (path: string, side: 'worktree', file?: string) => Promise<unknown>
      gitCommitDiff: (path: string, commit: string) => Promise<unknown>
    } }
    await diffEl.props.gitDiff('/ws', 'worktree', 'a.ts')
    await diffEl.props.gitCommitDiff('/ws', 'abcdef1')
    explorerEl.props.mentionFile('/ws/a.ts')
    expect(b.setDraft).toHaveBeenCalledWith('hello /ws/a.ts ')
    const conversation = b.ctx.get('conversation') as unknown as {
      input: { for: () => { setDraft: typeof b.setDraft; state: { getSnapshot: () => { draft: string } } } }
    }
    conversation.input.for = () => ({
      setDraft: b.setDraft,
      state: { getSnapshot: () => ({ draft: '' }) },
    })
    explorerEl.props.mentionFile('/ws/b.ts')
    expect(b.setDraft).toHaveBeenCalledWith('/ws/b.ts ')
    conversation.input.for = () => ({
      setDraft: b.setDraft,
      state: { getSnapshot: () => ({ draft: 'x ' }) },
    })
    explorerEl.props.mentionFile('/ws/c.ts')
    expect(b.setDraft).toHaveBeenCalledWith('x /ws/c.ts ')
    conversation.input.for = () => { throw new Error('composer missing') }
    explorerEl.props.mentionFile('/ws/d.ts')
    const missingEl = renderBody({
      tab: { id: 'e2', type: 'explorer', title: '资源管理器' }, visible: true, sessionId: 'missing',
    }) as { props: { mentionFile: (path: string) => void } }
    missingEl.props.mentionFile('/ws/a.ts')
    const registered = b.conversationEvents.register.mock.calls[0] as unknown as [{
      start: (ctx: unknown, match: unknown, reader?: unknown) => unknown
      update: (ctx: { state: unknown }, match: unknown) => unknown
    }]
    const def = registered[0]
    const started = def.start({}, {
      event: { type: 'turn/start', data: { turn: 1 } },
    })
    def.update({ state: started }, {
      event: { type: 'tool/call', seq: 3, data: { name: 'write', arguments: '{"path":"/ws/a.ts"}' } },
      view: { for: 'call', view: { locations: [{ path: '/ws/a.ts' }] } },
    })
    def.update({ state: started }, {
      event: { type: 'tool/call', seq: 2, data: { name: 'write', arguments: '{"path":"/ws/old.ts"}' } },
    })
    const viewer = service.getFileViewers()[0]?.component
    const renderViewer = viewer as ((props: Record<string, never>) => unknown) | undefined
    expect(typeof renderViewer === 'function' ? renderViewer({}) : renderViewer).toBeNull()
    service.openFile('/p/a.ts', { sessionId: 's1' })
    service.openFile('/p/a.png', { sessionId: 's1' })
    service.openFile('/p/a.bin', { sessionId: 's1' }, new Uint8Array([0, 1, 2]))
    expect(service.getSnapshot('s1').tabs.some(row => row.type === 'editor')).toBe(true)
    expect(service.getSnapshot('s1').tabs.some(row => row.type === 'image')).toBe(true)
    expect(service.getSnapshot('s1').tabs.some(row => row.type === 'binary')).toBe(true)
    expect(b.layout.openWorkbench).toHaveBeenCalled()
  })

  it('loads the git icon badge from a child repo when cwd is not a work tree', async () => {
    const b = await bench()
    b.workspaces.gitStatus.mockImplementation(async (path: string) => {
      if (path === '/ws') {
        throw new GitAccessError({ code: 'git-unavailable', message: 'not a repo' } as never)
      }
      return {
        root: path, branch: 'main', ahead: 0, behind: 0, detached: false,
        changes: path.endsWith('lib')
          ? [{ path: 'b.ts', status: 'modified', area: 'index' }]
          : [{ path: 'a.ts', status: 'modified', area: 'worktree' }],
      }
    })
    b.workspaces.listEntries.mockResolvedValue({
      path: '/ws',
      entries: [
        { name: 'app', path: '/ws/app', kind: 'directory', hidden: false },
        { name: 'lib', path: '/ws/lib', kind: 'directory', hidden: false },
      ],
      truncated: false,
    })
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const activity = (
      b.slots.entries('activityBar')[0]!.inject as unknown as (id: string) => ActivityBarInjected
    )('s1')
    await vi.waitFor(() => {
      expect(activity.hooks.gitBadge.getSnapshot()).toEqual({
        staged: 1, unstaged: 1, root: '/ws/app',
      })
    })
  })

  it('routes settings inject writes onto the service', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const settings = (
      b.slots.entries('settings.section')[0]!.inject as unknown as () => WorkbenchSettingsInjected
    )()
    const off = settings.hooks.workbenchRegistry.subscribe(() => {})
    expect(settings.hooks.workbenchRegistry.getSnapshot().tabs.some(row => row.id === 'demo')).toBe(true)
    off()
    settings.setTabEnabled('demo', false)
    expect(workbench(b.ctx).isTabEnabled('demo')).toBe(false)
    settings.setViewerEnabled('missing', false)
    expect(workbench(b.ctx).isViewerEnabled('missing')).toBe(false)
  })

  it('opens and toggles the terminal from the desktop application menu', async () => {
    let listener: ((command: 'terminal-new' | 'terminal-toggle') => void) | undefined
    const onAppMenu = vi.fn((fn: (command: 'terminal-new' | 'terminal-toggle') => void) => {
      listener = fn
      return () => { listener = undefined }
    })
    const previous = (globalThis as { __DSH_IPC__?: unknown }).__DSH_IPC__
    ;(globalThis as { __DSH_IPC__?: unknown }).__DSH_IPC__ = { onAppMenu }
    try {
      const b = await bench()
      declare(b.slots)
      const fiber = b.ctx.plugin({ inject: [...inject], apply })
      await fiber.await()
      expect(onAppMenu).toHaveBeenCalledOnce()
      listener?.('terminal-new')
      expect(b.layout.openBottom).toHaveBeenCalledOnce()
      expect(workbench(b.ctx).getSnapshot('s1').tabs.some(row => row.type === 'terminal')).toBe(true)
      listener?.('terminal-toggle')
      expect(b.layout.toggleBottom).toHaveBeenCalledOnce()
      await fiber.dispose()
      expect(listener).toBeUndefined()
    } finally {
      if (previous === undefined) delete (globalThis as { __DSH_IPC__?: unknown }).__DSH_IPC__
      else (globalThis as { __DSH_IPC__?: unknown }).__DSH_IPC__ = previous
    }
  })

  it('routes product menu commands from the desktop application menu', async () => {
    let listener: ((command: string) => void) | undefined
    ;(globalThis as { __DSH_IPC__?: unknown }).__DSH_IPC__ = {
      onAppMenu: (fn: (command: string) => void) => {
        listener = fn
        return () => {}
      },
    }
    const dispatched: string[] = []
    const previousDispatch = (globalThis as { dispatchEvent?: (event: Event) => boolean }).dispatchEvent
    ;(globalThis as { dispatchEvent: (event: Event) => boolean }).dispatchEvent = (event) => {
      dispatched.push(event.type)
      return true
    }
    try {
      const b = await bench()
      declare(b.slots)
      await b.ctx.plugin({ inject: [...inject], apply }).await()
      workbench(b.ctx).openFile('/ws/a.ts', { sessionId: 's1' })
      listener?.('session-new')
      listener?.('workspace-open')
      listener?.('file-save')
      listener?.('file-quick-open')
      listener?.('file-goto-line')
      listener?.('file-close')
      listener?.('settings-open')
      listener?.('activity-git')
      listener?.('sidebar-primary')
      listener?.('sidebar-sessions')
      listener?.('sidebar-conversation')
      const workspaces = b.ctx.get('workspaces')
      expect(workspaces).toBeDefined()
      expect(workspaces!.startSession).toHaveBeenCalledOnce()
      expect(workspaces!.pickDirectory).toHaveBeenCalledOnce()
      await Promise.resolve()
      expect(workspaces!.create).toHaveBeenCalledWith({ path: '/ws/picked' })
      expect(dispatched).toEqual([
        'dsh:workbench-save', 'dsh:workbench-quick-open', 'dsh:workbench-editor-action', 'dsh:open-settings',
      ])
      expect(workbench(b.ctx).getSnapshot('s1').tabs.some(row => row.path === '/ws/a.ts')).toBe(false)
      expect(workbench(b.ctx).getSnapshot('s1').activity).toBe('git')
      expect(b.layout.openWorkbench).toHaveBeenCalled()
      expect(b.layout.toggleWorkbench).toHaveBeenCalledOnce()
      expect(b.layout.toggleSidebar).toHaveBeenCalledOnce()
      expect(b.layout.toggleConversation).toHaveBeenCalledOnce()
      listener?.('activity-explorer')
      expect(workbench(b.ctx).getSnapshot('s1').activity).toBe('explorer')
    } finally {
      if (previousDispatch === undefined) delete (globalThis as { dispatchEvent?: unknown }).dispatchEvent
      else (globalThis as { dispatchEvent: (event: Event) => boolean }).dispatchEvent = previousDispatch
      delete (globalThis as { __DSH_IPC__?: unknown }).__DSH_IPC__
    }
  })

  it('skips or warns when Open Workspace is cancelled or the picker fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const menu = (
      b.slots.entries('menuBar')[0]!.inject as unknown as (id: string) => MenuBarInjected
    )('s1')
    const workspaces = b.ctx.get('workspaces') as unknown as {
      pickDirectory: ReturnType<typeof vi.fn>
      create: ReturnType<typeof vi.fn>
    }
    workspaces.pickDirectory.mockResolvedValueOnce(null)
    menu.run('workspace-open')
    await Promise.resolve()
    workspaces.pickDirectory.mockResolvedValueOnce('')
    menu.run('workspace-open')
    await Promise.resolve()
    expect(workspaces.create).not.toHaveBeenCalled()
    workspaces.pickDirectory.mockRejectedValueOnce(new Error('no chooser'))
    menu.run('workspace-open')
    await Promise.resolve()
    await Promise.resolve()
    expect(warn).toHaveBeenCalled()
    workspaces.pickDirectory.mockResolvedValueOnce('/ws/x')
    workspaces.create.mockRejectedValueOnce(new Error('exists'))
    menu.run('workspace-open')
    await Promise.resolve()
    await Promise.resolve()
    expect(warn).toHaveBeenCalled()
    menu.run('file-close')
    const previousDispatch = (globalThis as { dispatchEvent?: unknown }).dispatchEvent
    delete (globalThis as { dispatchEvent?: unknown }).dispatchEvent
    menu.run('file-save')
    menu.run('settings-open')
    if (previousDispatch === undefined) delete (globalThis as { dispatchEvent?: unknown }).dispatchEvent
    else (globalThis as { dispatchEvent: typeof previousDispatch }).dispatchEvent = previousDispatch
    warn.mockRestore()
  })

  it('ignores session-scoped desktop menu commands when no session is current', async () => {
    let listener: ((command: 'terminal-new' | 'terminal-toggle') => void) | undefined
    ;(globalThis as { __DSH_IPC__?: unknown }).__DSH_IPC__ = {
      onAppMenu: (fn: (command: 'terminal-new' | 'terminal-toggle') => void) => {
        listener = fn
        return () => {}
      },
    }
    try {
      const b = await bench()
      b.sessions.list.getSnapshot = () => ({ current: undefined, byId: {} }) as never
      declare(b.slots)
      await b.ctx.plugin({ inject: [...inject], apply }).await()
      listener?.('terminal-new')
      listener?.('terminal-toggle')
      expect(b.layout.openBottom).not.toHaveBeenCalled()
      expect(b.layout.toggleBottom).not.toHaveBeenCalled()
    } finally {
      delete (globalThis as { __DSH_IPC__?: unknown }).__DSH_IPC__
    }
  })

  it('still builds the editor tab when cwd or a language Remote throws', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const column = (
      b.slots.entries('workbench')[0]!.inject as unknown as (id: string) => WorkbenchColumnInjected
    )('s1')
    const Editor = column.resolveBody('editor')
    expect(Editor).toBeTypeOf('function')
    if (typeof Editor !== 'function') return
    const renderEditor = Editor as (props: {
      tab: { id: string; type: string; title: string; path?: string }
      visible: boolean
      sessionId: string
    }) => unknown
    const snap = b.sessions.list.getSnapshot
    b.sessions.list.getSnapshot = () => {
      throw new Error('snap')
    }
    expect(column.getWorkspaceRoot?.('/F.java')).toBe('/')
    const broken = renderEditor({
      tab: { id: 'ed', type: 'editor', title: 'F.java', path: '/F.java' },
      visible: true,
      sessionId: 's1',
    }) as { props: { getWorkspaceRoot: () => string | undefined; getRemotes: () => { javaLsp?: unknown } } }
    expect(broken.props.getWorkspaceRoot()).toBe('/')
    b.sessions.list.getSnapshot = snap
    Object.defineProperty(b.ctx.get('remote') as object, 'javaLsp', {
      configurable: true,
      get() { throw new Error('jdt down') },
    })
    const live = renderEditor({
      tab: { id: 'ed', type: 'editor', title: 'F.java', path: '/F.java' },
      visible: true,
      sessionId: 's1',
    }) as { props: { getRemotes: () => { javaLsp?: unknown } } }
    expect(live.props.getRemotes().javaLsp).toBeUndefined()
    const get = b.ctx.get.bind(b.ctx)
    vi.spyOn(b.ctx, 'get').mockImplementation((key: string) => {
      if (String(key).startsWith('remote.')) throw new Error('lookup')
      return get(key)
    })
    expect(live.props.getRemotes().javaLsp).toBeUndefined()
  })

  it('unregisters slot entries on teardown', async () => {
    const b = await bench()
    declare(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await fiber.dispose()
    expect(b.slots.entries('workbench')).toHaveLength(0)
    expect(b.slots.entries('menuBar')).toHaveLength(0)
    expect(b.slots.entries('activityBar')).toHaveLength(0)
    expect(b.slots.entries('primarySidebar')).toHaveLength(0)
    expect(b.slots.entries('bottomPanel')).toHaveLength(0)
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    expect(b.slots.entries('tool.call.toolview')).toHaveLength(0)
  })

  it('shadows edit/write tool rows with the file-change card and opens the workbench', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const entries = b.slots.entries('tool.call.toolview')
    expect(entries).toHaveLength(2)
    expect(entries.map(entry => entry.options.key).sort()).toEqual(['edit', 'write'])
    expect(entries.every(entry => entry.options.priority === -1)).toBe(true)
    const injected = entries.map(entry => (
      entry.inject as (sessionId: string) => {
        openInWorkbench: (path: string, reveal?: { line: number; character?: number }) => void
        readFile: (path: string) => Promise<string | undefined>
        openReviewDiff?: (path: string) => void
      }
    )('s1'))
    expect(injected[0]!.openReviewDiff).toBeUndefined()
    injected[0]!.openInWorkbench('/ws/a.ts')
    injected[1]!.openInWorkbench('/ws/b.ts', { line: 3 })
    expect(takeReveal('/ws/b.ts')).toEqual({ line: 3, character: 0 })
    injected[1]!.openInWorkbench('/ws/c.ts', { line: 1, character: 4 })
    expect(takeReveal('/ws/c.ts')).toEqual({ line: 1, character: 4 })
    expect(b.layout.openWorkbench).toHaveBeenCalled()
    const paths = workbench(b.ctx).getSnapshot('s1').tabs.map(tab => tab.path)
    expect(paths).toContain('/ws/a.ts')
    expect(paths).toContain('/ws/b.ts')
    expect(await injected[0]!.readFile('notes/a.ts')).toBe('hi')
    expect(b.workspaces.readFile).toHaveBeenCalledWith('/ws/notes/a.ts')
    b.workspaces.readFile.mockRejectedValueOnce(new Error('missing'))
    expect(await injected[0]!.readFile('/ws/missing.ts')).toBeUndefined()
  })

  it('registers the review dock when agentReview is present', async () => {
    const b = await bench()
    const reviewGet = vi.fn(async () => ({
      sessionId: 's1',
      turns: [{
        turn: 4,
        shellMaybeMutated: false,
        files: [{ path: '/ws/rev.ts', kind: 'update' as const, status: 'pending' as const }],
      }],
    }))
    b.ctx.provide('remote.agentReview', { get: reviewGet })
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    expect(workbench(b.ctx).getTab('agent-review-diff')?.hidden).toBe(true)
    const dock = b.slots.entries('conversation.input.dock')[0]
    const face = (dock!.inject as (id: string) => {
      openReviewDiff: (path: string, turn: number) => void
    })('s1')
    face.openReviewDiff('/ws/rev.ts', 2)
    expect(b.layout.openWorkbench).toHaveBeenCalled()
    const Review = workbench(b.ctx).getTab('agent-review-diff')!.component
    const el = (Review as (props: {
      tab: { id: string; type: string; title: string; path: string }
      visible: boolean
      sessionId: string
    }) => { props: { onSettled: () => void } })({
      tab: { id: 'rd', type: 'agent-review-diff', title: 'Review', path: '2:/ws/rev.ts' },
      visible: true,
      sessionId: 's1',
    })
    el.props.onSettled()
    expect(workbench(b.ctx).getSnapshot('s1').tabs.some(tab => tab.id === 'rd')).toBe(false)
    const card = (b.slots.entries('tool.call.toolview')[0]!.inject as (id: string) => {
      openReviewDiff?: (path: string) => void
    })('s1')
    card.openReviewDiff!('/ws/rev.ts')
    await vi.waitFor(() => {
      expect(workbench(b.ctx).getSnapshot('s1').tabs.some(tab => tab.path === '4|/ws/rev.ts')).toBe(true)
    })
    card.openReviewDiff!('/ws/other.ts')
    await vi.waitFor(() => {
      expect(workbench(b.ctx).getSnapshot('s1').tabs.some(tab => tab.path === '/ws/other.ts')).toBe(true)
    })
  })
})

describe('node half + invariant companion', () => {
  it('node apply is an intentional no-op (loader-managed lifecycle only)', () => {
    nodeApply()
    expect(true).toBe(true)
  })

  it('invariant companion registers under the package name', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const ctx = { invariants: { register } } as never
    const dispose = await (invariant as { apply: (ctx: never) => Promise<() => void> }).apply(ctx)
    expect(invariant.name).toBe('client-ui-xmart-workbench-invariant')
    expect(invariant.inject).toEqual(['invariants'])
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-client-ui-xmart-workbench', expect.any(Function))
    expect(() => { (register.mock.calls[0]![1] as (c: never) => void)(undefined as never) }).not.toThrow()
    expect(dispose).toBeTypeOf('function')
  })
})
