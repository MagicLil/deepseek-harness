import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject, XmartWorkbenchController } from '@deepseek-ai/dsh-client-ui-xmart-workbench/client'
import type {
  WorkbenchColumnInjected, WorkbenchSettingsInjected, WorkbenchToggleInjected,
} from '@deepseek-ai/dsh-client-ui-xmart-workbench/client'
import { WorkbenchColumn } from '../src/client/WorkbenchColumn.tsx'
import { WorkbenchToggle } from '../src/client/WorkbenchToggle.tsx'
import { WorkbenchSettingsSection } from '../src/client/WorkbenchSettingsSection.tsx'
import { apply as nodeApply } from '@deepseek-ai/dsh-client-ui-xmart-workbench'
import * as invariant from '@deepseek-ai/dsh-client-ui-xmart-workbench/invariant'

usePinnedBrowserLanguages('zh-CN')

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const layout = {
    openWorkbench: vi.fn(),
    closeWorkbench: vi.fn(),
    setWorkbench: vi.fn(),
    toggleWorkbench: vi.fn(),
  }
  ctx.provide('layout', layout)
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const setDraft = vi.fn()
  const sessions = {
    list: {
      getSnapshot: () => ({ byId: { s1: { cwd: '/ws' } } }),
      subscribe: () => () => {},
    },
    scope: (id: string) => id === 's1' ? ({}) : undefined,
  }
  const workspaces = {
    listEntries: vi.fn(async () => ({ path: '/ws', entries: [], truncated: false })),
    gitStatus: vi.fn(async () => ({
      root: '/ws', branch: 'main', ahead: 0, behind: 0, detached: false, changes: [],
    })),
    readFile: vi.fn(async () => 'hi'),
    writeFile: vi.fn(async () => {}),
    createDirectory: vi.fn(async () => '/ws/n'),
    openPath: vi.fn(async () => {}),
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
  return {
    ctx, slots: ctx.get('slots') as SlotRegistry, locale, layout,
    setDraft, conversationEvents, sessions,
  }
}

function workbench(ctx: Context): XmartWorkbenchController {
  return ctx.get('xmartWorkbench') as XmartWorkbenchController
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: {
      workbench: { kind: 'single', scope: 'session' },
      'shell.overlay': { kind: 'list', scope: 'root' },
      'settings.section': { kind: 'list', scope: 'root' },
    },
  } as never, () => null)
}

describe('ui-xmart-workbench apply', () => {
  it('declares the services it drives', () => {
    expect(inject).toEqual([
      'slots', 'locale', 'layout', 'workspaces', 'sessions', 'conversation', 'conversationEvents',
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
    expect(file?.hidden).toBe(true)
    expect(editor?.hidden).toBe(true)
    expect(explorer?.available?.({ sessionId: 's1' }, { tabs: [], activeTabId: null, nextSeq: 1 })).toBe(true)
    expect(explorer?.available?.({ sessionId: 'missing' }, { tabs: [], activeTabId: null, nextSeq: 1 })).toBe(false)
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
  })

  it('registers the column, overlay toggle, and settings section', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    expect(b.slots.entries('workbench')[0]!.component).toBe(WorkbenchColumn)
    expect(b.slots.entries('workbench')[0]!.locale).toBe('workbench')
    expect(b.locale.bind('workbench')('column.title')).toBe('工作台')
    expect(b.slots.entries('shell.overlay')[0]!.component).toBe(WorkbenchToggle)
    const section = b.slots.entries('settings.section')[0]
    expect(section?.component).toBe(WorkbenchSettingsSection)
    expect(section?.options.id).toBe('workbench')
    expect(section?.options.order).toBe(25)
    const label = section?.options.label
    expect(typeof label === 'function' ? label() : label).toBe('工作台')
  })

  it('routes column and toggle inject callbacks to ctx.layout and the service', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const column = (
      b.slots.entries('workbench')[0]!.inject as unknown as (id: string) => WorkbenchColumnInjected
    )('s1')
    column.closeWorkbench()
    column.setWorkbench(480)
    column.reportOpen(true)
    expect(b.layout.closeWorkbench).toHaveBeenCalledOnce()
    expect(b.layout.setWorkbench).toHaveBeenCalledWith(480)
    column.openTab('demo')
    const service = workbench(b.ctx)
    const opened = service.getSnapshot('s1').tabs[0]
    expect(opened?.type).toBe('demo')
    expect(opened).toBeDefined()
    if (opened === undefined) return
    column.activateTab(opened.id)
    column.closeTab(opened.id)
    expect(service.getSnapshot('s1').tabs).toHaveLength(0)
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
      openSystem: (path: string) => Promise<void>
      openFile: (path: string) => void
      watchSessions: (fn: () => void) => () => void
      getCwd: (id: string) => string | undefined
    } }
    await explorerEl.props.listEntries('/ws')
    await explorerEl.props.gitStatus('/ws')
    await explorerEl.props.writeFile('/ws/a.ts', '')
    await explorerEl.props.createDirectory('/ws', 'n')
    await explorerEl.props.openSystem('/ws/a.ts')
    explorerEl.props.openFile('/ws/a.ts')
    explorerEl.props.watchSessions(() => {})()
    expect(explorerEl.props.getCwd('s1')).toBe('/ws')
    const editorEl = (Editor as typeof renderFile)({
      tab: { id: 'ed', type: 'editor', title: 'a.ts', path: '/p/a.ts' }, visible: true, sessionId: 's1',
    }) as { props: { readFile: (path: string) => Promise<string>; writeFile: (path: string, content: string) => Promise<void> } }
    await editorEl.props.readFile('/p/a.ts')
    await editorEl.props.writeFile('/p/a.ts', 'x')
    const imageEl = (Image as typeof renderFile)({
      tab: { id: 'im', type: 'image', title: 'a.png', path: '/p/a.png' }, visible: true, sessionId: 's1',
    }) as { props: { openSystem: (path: string) => Promise<void> } }
    await imageEl.props.openSystem('/p/a.png')
    const binaryEl = (Binary as typeof renderFile)({
      tab: { id: 'bi', type: 'binary', title: 'a.bin', path: '/p/a.bin' }, visible: true, sessionId: 's1',
    }) as { props: { openSystem: (path: string) => Promise<void> } }
    await binaryEl.props.openSystem('/p/a.bin')
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
    const toggle = (b.slots.entries('shell.overlay')[0]!.inject as unknown as () => WorkbenchToggleInjected)()
    toggle.openWorkbench()
    expect(b.layout.openWorkbench).toHaveBeenCalledTimes(5)
    expect(toggle.hooks.workbenchOpen.getSnapshot()).toBe(true)
    const notified = vi.fn()
    const off = toggle.hooks.workbenchOpen.subscribe(notified)
    column.reportOpen(false)
    expect(notified).toHaveBeenCalledOnce()
    expect(toggle.hooks.workbenchOpen.getSnapshot()).toBe(false)
    column.reportOpen(false)
    expect(notified).toHaveBeenCalledOnce()
    off()
    column.reportOpen(true)
    expect(notified).toHaveBeenCalledOnce()
    expect(toggle.hooks.workbenchOpen.getSnapshot()).toBe(true)
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

  it('unregisters slot entries on teardown', async () => {
    const b = await bench()
    declare(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await fiber.dispose()
    expect(b.slots.entries('workbench')).toHaveLength(0)
    expect(b.slots.entries('shell.overlay')).toHaveLength(0)
    expect(b.slots.entries('settings.section')).toHaveLength(0)
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
