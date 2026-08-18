// @vitest-environment jsdom
/**
 * XmartWorkbenchController: register/dispose, dedupe, createTab, matching,
 * settings gating, persist restore, and the + menu derivation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_SESSION_SOURCE, EMPTY_WORKBENCH_VIEW, XmartWorkbenchController } from '../src/client/service.ts'
import { matchFileViewer } from '../src/client/match-viewer.ts'
import {
  PREFS_PERSIST, TABS_PERSIST, XMART_WORKBENCH_FEATURES, XMART_WORKBENCH_VERSION,
  type FileViewerDescriptor, type TabDescriptor,
} from '../src/client/types.ts'

beforeEach(() => { localStorage.clear() })

const Noop = (): null => null

function tab(partial: Omit<TabDescriptor, 'component'> & { component?: TabDescriptor['component'] }): TabDescriptor {
  return { component: Noop, ...partial }
}

function viewer(
  partial: Omit<FileViewerDescriptor, 'component' | 'fetchStrategy'> & {
    component?: FileViewerDescriptor['component']
    fetchStrategy?: FileViewerDescriptor['fetchStrategy']
  },
): FileViewerDescriptor {
  return { component: Noop, fetchStrategy: 'none', ...partial }
}

describe('XmartWorkbenchController registry', () => {
  it('registerTab adds to the registry and dispose removes it', () => {
    const service = new XmartWorkbenchController()
    expect(service.getTabs()).toHaveLength(0)
    const dispose = service.registerTab(tab({ id: 'test:tab', title: 'Test' }))
    expect(service.getTabs()).toHaveLength(1)
    expect(service.getTab('test:tab')?.id).toBe('test:tab')
    dispose()
    expect(service.getTabs()).toHaveLength(0)
    expect(service.getTab('test:tab')).toBeUndefined()
    dispose()
  })

  it('registerTab throws on duplicate id', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({ id: 'dup', title: 'A' }))
    expect(() => service.registerTab(tab({ id: 'dup', title: 'B' }))).toThrow('tab type "dup" already registered')
  })

  it('registerFileViewer adds and dispose removes', () => {
    const service = new XmartWorkbenchController()
    expect(service.getFileViewers()).toHaveLength(0)
    const dispose = service.registerFileViewer(viewer({ id: 'csv', exts: ['csv'], fetchStrategy: 'custom' }))
    expect(service.getFileViewers()).toHaveLength(1)
    dispose()
    expect(service.getFileViewers()).toHaveLength(0)
    dispose()
  })

  it('registerActivity adds, sorts, dispose removes, and unknown persist falls back', () => {
    const service = new XmartWorkbenchController()
    expect(service.getActivities()).toHaveLength(0)
    const dispose = service.registerActivity({
      id: 'plugins',
      title: () => '插件',
      order: 30,
      icon: Noop,
      component: Noop,
    })
    expect(service.getActivity('plugins')?.id).toBe('plugins')
    expect(service.getActivity('missing')).toBeUndefined()
    expect(service.observeRegistry().getSnapshot().activities).toEqual([
      { id: 'plugins', title: '插件', enabled: true },
    ])
    service.setActivity('plugins', { sessionId: 's1' })
    expect(service.getSnapshot('s1').activity).toBe('plugins')
    expect(() => service.registerActivity({
      id: 'plugins', title: 'Dup', icon: Noop, component: Noop,
    })).toThrow('activity "plugins" already registered')
    dispose()
    expect(service.getActivities()).toHaveLength(0)
    expect(service.getSnapshot('s1').activity).toBe('explorer')
    dispose()
    service.registerActivity({
      id: 'late', title: 'Late', order: 80, icon: Noop, component: Noop,
    })
    service.registerActivity({
      id: 'early', title: 'Early', order: 5, icon: Noop, component: Noop,
    })
    service.registerActivity({
      id: 'mid', title: 'Mid', icon: Noop, component: Noop,
    })
    expect(service.observeRegistry().getSnapshot().activities.map(row => row.id)).toEqual(['early', 'late', 'mid'])
  })

  it('registerFileViewer throws on duplicate id', () => {
    const service = new XmartWorkbenchController()
    service.registerFileViewer(viewer({ id: 'img', exts: ['png'] }))
    expect(() => service.registerFileViewer(viewer({ id: 'img', exts: ['jpg'] }))).toThrow(
      'file viewer "img" already registered',
    )
  })

  it('subscribe fires on register and dispose, then stops after unsubscribe', () => {
    const service = new XmartWorkbenchController()
    const listener = vi.fn()
    const off = service.subscribe(listener)
    const dispose = service.registerTab(tab({ id: 'x', title: 'X' }))
    expect(listener).toHaveBeenCalledTimes(1)
    dispose()
    expect(listener).toHaveBeenCalledTimes(2)
    off()
    service.registerTab(tab({ id: 'y', title: 'Y' }))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('publishes version and features', () => {
    const service = new XmartWorkbenchController()
    expect(service.version).toBe(XMART_WORKBENCH_VERSION)
    expect(service.features).toEqual(XMART_WORKBENCH_FEATURES)
  })
})

describe('enable switches', () => {
  function setup() {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({ id: 'explorer', title: 'Explorer' }))
    service.registerFileViewer(viewer({ id: 'image', exts: ['png'], fetchStrategy: 'mediaUrl' }))
    return service
  }

  it('an absent map key means enabled, including unknown ids', () => {
    const service = setup()
    expect(service.isTabEnabled('explorer')).toBe(true)
    expect(service.isViewerEnabled('image')).toBe(true)
    expect(service.isTabEnabled('whatever')).toBe(true)
  })

  it('only an explicit false disables a tab type', () => {
    const service = setup()
    service.setTabEnabled('explorer', false)
    expect(service.isTabEnabled('explorer')).toBe(false)
    service.setTabEnabled('explorer', false)
    service.setTabEnabled('explorer', true)
    expect(service.isTabEnabled('explorer')).toBe(true)
  })

  it('openTab refuses a disabled tab type and leaves existing tabs', () => {
    const service = setup()
    service.openTab({ type: 'explorer' }, { sessionId: 's1' })
    service.setTabEnabled('explorer', false)
    expect(service.openTab({ type: 'explorer' }, { sessionId: 's1' })).toBeUndefined()
    expect(service.getSnapshot('s1').tabs).toHaveLength(1)
    expect(service.getSnapshot('s1').menu).toEqual([])
  })

  it('matchFileViewer skips a disabled viewer so a catch-all can win', () => {
    const service = setup()
    service.registerFileViewer(viewer({
      id: 'code', exts: [], priority: -100, fetchStrategy: 'fsRead',
    }))
    expect(service.matchFileViewer('photo.png')?.id).toBe('image')
    service.setViewerEnabled('image', false)
    expect(service.matchFileViewer('photo.png')?.id).toBe('code')
    service.setViewerEnabled('code', false)
    expect(service.matchFileViewer('photo.png')).toBeUndefined()
    service.setViewerEnabled('image', true)
    service.setViewerEnabled('code', true)
    expect(service.matchFileViewer('photo.png')?.id).toBe('image')
    service.setViewerEnabled('image', true)
  })
})

describe('matchFileViewer', () => {
  it('matches by extension, case-insensitively', () => {
    const service = new XmartWorkbenchController()
    service.registerFileViewer(viewer({ id: 'img', exts: ['png', 'jpg'], fetchStrategy: 'mediaUrl' }))
    expect(service.matchFileViewer('photo.png')?.id).toBe('img')
    expect(service.matchFileViewer('photo.JPG')?.id).toBe('img')
    expect(service.matchFileViewer('doc.txt')).toBeUndefined()
  })

  it('lets higher priority win on an extension conflict', () => {
    const service = new XmartWorkbenchController()
    service.registerFileViewer(viewer({ id: 'basic', exts: ['png'], priority: 0, fetchStrategy: 'mediaUrl' }))
    service.registerFileViewer(viewer({ id: 'advanced', exts: ['png'], priority: 10, fetchStrategy: 'custom' }))
    expect(service.matchFileViewer('x.png')?.id).toBe('advanced')
  })

  it('uses a catch-all only when no higher-priority extension claims the file', () => {
    const service = new XmartWorkbenchController()
    service.registerFileViewer(viewer({ id: 'catchall', exts: [], priority: -100, fetchStrategy: 'fsRead' }))
    service.registerFileViewer(viewer({ id: 'img', exts: ['png'], priority: 0, fetchStrategy: 'mediaUrl' }))
    expect(service.matchFileViewer('x.png')?.id).toBe('img')
    expect(service.matchFileViewer('x.txt')?.id).toBe('catchall')
  })

  it('lets detect claim a file the viewer would otherwise miss, at its priority', () => {
    const service = new XmartWorkbenchController()
    service.registerFileViewer(viewer({ id: 'by-ext', exts: ['bin'], priority: 5, fetchStrategy: 'fsRead' }))
    service.registerFileViewer(viewer({
      id: 'by-magic',
      exts: ['mag'],
      priority: 10,
      fetchStrategy: 'fsRead',
      detect: (_path, head) => head[0] === 0x89,
    }))
    expect(service.matchFileViewer('file.bin')?.id).toBe('by-ext')
    expect(service.matchFileViewer('file.bin', new Uint8Array([0x89, 0x50]))?.id).toBe('by-magic')
    expect(service.matchFileViewer('file.bin', new Uint8Array([0x00, 0x50]))?.id).toBe('by-ext')
  })

  it('lets a higher-priority extension beat a lower-priority detect', () => {
    const service = new XmartWorkbenchController()
    service.registerFileViewer(viewer({ id: 'by-ext', exts: ['bin'], priority: 10, fetchStrategy: 'fsRead' }))
    service.registerFileViewer(viewer({
      id: 'by-magic',
      exts: ['mag'],
      priority: 5,
      fetchStrategy: 'fsRead',
      detect: (_path, head) => head[0] === 0x89,
    }))
    expect(service.matchFileViewer('file.bin', new Uint8Array([0x89, 0x50]))?.id).toBe('by-ext')
  })

  it('treats a catch-all with detect as sniff-only', () => {
    const service = new XmartWorkbenchController()
    service.registerFileViewer(viewer({ id: 'img', exts: ['png'], priority: 0, fetchStrategy: 'mediaUrl' }))
    service.registerFileViewer(viewer({
      id: 'magic-sniffer',
      exts: [],
      priority: 100,
      fetchStrategy: 'custom',
      detect: (_path, head) => head[0] === 0x89,
    }))
    expect(service.matchFileViewer('photo.png')?.id).toBe('img')
    expect(service.matchFileViewer('photo.png', new Uint8Array([0x89, 0x50]))?.id).toBe('magic-sniffer')
    expect(service.matchFileViewer('photo.png', new Uint8Array([0x00, 0x50]))?.id).toBe('img')
  })

  it('returns undefined when nothing matches and no catch-all exists', () => {
    const service = new XmartWorkbenchController()
    service.registerFileViewer(viewer({ id: 'img', exts: ['png'], fetchStrategy: 'mediaUrl' }))
    expect(service.matchFileViewer('doc.txt')).toBeUndefined()
  })

  it('keeps equal-priority registration order', () => {
    expect(matchFileViewer(
      [
        viewer({ id: 'first', exts: ['png'] }),
        viewer({ id: 'second', exts: ['png'] }),
      ],
      () => true,
      'a.png',
    )?.id).toBe('first')
  })
})

describe('openTab dedupe and minting', () => {
  it('dedupeKey focuses an existing tab instead of duplicating', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({ id: 'singleton', title: 'Singleton', dedupeKey: () => 'singleton' }))
    service.openTab({ type: 'singleton' }, { sessionId: 's1' })
    service.openTab({ type: 'singleton' }, { sessionId: 's1' })
    expect(service.getSnapshot('s1').tabs.filter(t => t.type === 'singleton')).toHaveLength(1)
  })

  it('opens a new tab for each distinct id when there is no dedupeKey', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({ id: 'multi', title: 'Multi' }))
    service.openTab({ type: 'multi', id: 'multi:1' }, { sessionId: 's1' })
    service.openTab({ type: 'multi', id: 'multi:2' }, { sessionId: 's1' })
    expect(service.getSnapshot('s1').tabs.filter(t => t.type === 'multi')).toHaveLength(2)
  })

  it('reopening with the same id focuses the existing tab', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({ id: 'multi', title: 'Multi' }))
    service.openTab({ type: 'multi', id: 'multi:1' }, { sessionId: 's1' })
    service.openTab({ type: 'multi', title: 'Other', id: 'multi:2' }, { sessionId: 's1' })
    service.openTab({ type: 'multi', id: 'multi:1' }, { sessionId: 's1' })
    const snap = service.getSnapshot('s1')
    expect(snap.tabs.filter(t => t.type === 'multi')).toHaveLength(2)
    expect(snap.activeTabId).toBe('multi:1')
  })

  it('createTab mints custom ids and patches nextSeq only when appending', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({
      id: 'counter',
      title: 'Counter',
      createTab: state => ({
        tab: { id: `counter:${state.nextSeq}`, type: 'counter', title: `C${state.nextSeq}` },
        patch: { nextSeq: state.nextSeq + 1 },
      }),
    }))
    service.openTab({ type: 'counter' }, { sessionId: 's1' })
    service.openTab({ type: 'counter' }, { sessionId: 's1' })
    const snap = service.getSnapshot('s1')
    const tabs = snap.tabs.filter(t => t.type === 'counter')
    expect(tabs.map(t => t.id)).toEqual(['counter:1', 'counter:2'])
    expect(snap.nextSeq).toBe(3)
    service.openTab({ type: 'counter', id: 'counter:1' }, { sessionId: 's1' })
    expect(service.getSnapshot('s1').nextSeq).toBe(3)
    expect(service.getSnapshot('s1').tabs).toHaveLength(2)
  })

  it('createTab that reuses an id focuses the existing tab', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({
      id: 'fixed',
      title: 'Fixed',
      createTab: () => ({ tab: { id: 'fixed:1', type: 'fixed', title: 'Fixed' } }),
    }))
    service.openTab({ type: 'fixed' }, { sessionId: 's1' })
    service.openTab({ type: 'fixed' }, { sessionId: 's1' })
    expect(service.getSnapshot('s1').tabs).toHaveLength(1)
  })

  it('createTab returning null refuses the open', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({ id: 'nope', title: 'Nope', createTab: () => null }))
    expect(service.openTab({ type: 'nope' }, { sessionId: 's1' })).toBeUndefined()
    expect(service.getSnapshot('s1').tabs).toHaveLength(0)
  })

  it('lets a caller title win, and uses the descriptor title otherwise', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({ id: 'editor', title: () => 'Editor' }))
    service.openTab({ type: 'editor', title: 'main.ts', path: '/p/main.ts' }, { sessionId: 's1' })
    expect(service.getSnapshot('s1').tabs[0]?.title).toBe('main.ts')
    service.registerTab(tab({ id: 'plain', title: () => 'Plain' }))
    service.openTab({ type: 'plain' }, { sessionId: 's1' })
    expect(service.getSnapshot('s1').tabs.find(t => t.type === 'plain')?.title).toBe('Plain')
  })

  it('applies a url seed to a createTab mint without using the seed id', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({
      id: 'browser',
      title: () => 'Browser',
      createTab: state => ({
        tab: { id: `browser:${state.nextSeq}`, type: 'browser', title: 'Browser' },
        patch: { nextSeq: state.nextSeq + 1 },
      }),
    }))
    service.openTab(
      { type: 'browser', url: 'https://example.com/x', title: 'example.com', id: 'ignored' },
      { sessionId: 's1' },
    )
    const opened = service.getSnapshot('s1').tabs[0]
    expect(opened).toEqual({
      id: 'browser:1', type: 'browser', title: 'example.com', path: 'https://example.com/x',
    })
  })

  it('treats single: true as one instance per type, not across types', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({ id: 'singleton', title: 'Singleton', single: true }))
    service.registerTab(tab({ id: 'other', title: 'Other', single: true }))
    service.openTab({ type: 'singleton' }, { sessionId: 's1' })
    service.openTab({ type: 'singleton', id: 'singleton:extra' }, { sessionId: 's1' })
    expect(service.getSnapshot('s1').tabs).toHaveLength(1)
    service.openTab({ type: 'other' }, { sessionId: 's1' })
    expect(service.getSnapshot('s1').tabs.map(row => row.type)).toEqual(['singleton', 'other'])
  })

  it('lets an explicit dedupeKey win over single: true', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({
      id: 'multi',
      title: 'Multi',
      single: true,
      dedupeKey: opened => opened.id,
    }))
    service.openTab({ type: 'multi', id: 'multi:1' }, { sessionId: 's1' })
    service.openTab({ type: 'multi', id: 'multi:2' }, { sessionId: 's1' })
    expect(service.getSnapshot('s1').tabs).toHaveLength(2)
    service.openTab({ type: 'multi', id: 'multi:1' }, { sessionId: 's1' })
    expect(service.getSnapshot('s1').tabs).toHaveLength(2)
  })

  it('skips dedupe when the incoming key is undefined', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({
      id: 'multi',
      title: 'Multi',
      dedupeKey: opened => opened.path,
    }))
    service.openTab({ type: 'multi', id: 'a' }, { sessionId: 's1' })
    service.openTab({ type: 'multi', id: 'b' }, { sessionId: 's1' })
    expect(service.getSnapshot('s1').tabs).toHaveLength(2)
  })

  it('refuses an unknown type and a missing session', () => {
    const service = new XmartWorkbenchController()
    expect(service.openTab({ type: 'missing' }, { sessionId: 's1' })).toBeUndefined()
    service.registerTab(tab({ id: 'plain', title: 'Plain' }))
    expect(service.openTab({ type: 'plain' })).toBeUndefined()
  })

  it('uses the column-bound session when scope is omitted', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({ id: 'plain', title: 'Plain' }))
    service.bindSession('bound')
    expect(service.openTab({ type: 'plain' })).toBe('plain:1')
    expect(service.getSnapshot().tabs[0]?.id).toBe('plain:1')
  })
})

describe('closeTab, activateTab, menu, and panel', () => {
  it('closeTab is a no-op for unknown ids and missing sessions', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({ id: 'plain', title: 'Plain' }))
    service.closeTab('nope')
    service.openTab({ type: 'plain', id: 'a' }, { sessionId: 's1' })
    service.closeTab('missing', { sessionId: 's1' })
    expect(service.getSnapshot('s1').tabs).toHaveLength(1)
  })

  it('closes the active tab and focuses the neighbor to the left', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({ id: 'multi', title: 'Multi' }))
    service.openTab({ type: 'multi', id: 'a' }, { sessionId: 's1' })
    service.openTab({ type: 'multi', id: 'b' }, { sessionId: 's1' })
    service.openTab({ type: 'multi', id: 'c' }, { sessionId: 's1' })
    service.closeTab('c', { sessionId: 's1' })
    expect(service.getSnapshot('s1').activeTabId).toBe('b')
    service.activateTab('a', { sessionId: 's1' })
    service.closeTab('a', { sessionId: 's1' })
    expect(service.getSnapshot('s1').tabs.map(t => t.id)).toEqual(['b'])
    expect(service.getSnapshot('s1').activeTabId).toBe('b')
    service.closeTab('b', { sessionId: 's1' })
    expect(service.getSnapshot('s1')).toMatchObject({ tabs: [], activeTabId: null })
  })

  it('closeTab on a background tab leaves the active id alone', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({ id: 'multi', title: 'Multi' }))
    service.openTab({ type: 'multi', id: 'a' }, { sessionId: 's1' })
    service.openTab({ type: 'multi', id: 'b' }, { sessionId: 's1' })
    service.closeTab('a', { sessionId: 's1' })
    expect(service.getSnapshot('s1').activeTabId).toBe('b')
  })

  it('activateTab is a no-op for unknown ids, missing sessions, and the current tab', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({ id: 'plain', title: 'Plain', single: true }))
    service.activateTab('x')
    service.openTab({ type: 'plain' }, { sessionId: 's1' })
    const listener = vi.fn()
    service.subscribe(listener)
    service.activateTab('plain:1', { sessionId: 's1' })
    service.activateTab('missing', { sessionId: 's1' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('builds the + menu by order, hides hidden/disabled types, and disables available() misses', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({ id: 'late', title: 'Late', order: 50 }))
    service.registerTab(tab({ id: 'early', title: () => 'Early', order: 10 }))
    service.registerTab(tab({ id: 'hidden', title: 'Hidden', hidden: true }))
    service.registerTab(tab({
      id: 'gated',
      title: 'Gated',
      order: 20,
      available: () => false,
    }))
    service.registerTab(tab({
      id: 'boom',
      title: 'Boom',
      order: 30,
      available: () => { throw new Error('nope') },
    }))
    const menu = service.getSnapshot('s1').menu
    expect(menu.map(row => row.id)).toEqual(['early', 'gated', 'boom', 'late'])
    expect(menu.find(row => row.id === 'gated')?.disabled).toBe(true)
    expect(menu.find(row => row.id === 'boom')?.disabled).toBe(true)
    expect(menu.find(row => row.id === 'early')?.disabled).toBe(false)
    expect(service.openTab({ type: 'gated' }, { sessionId: 's1' })).toBeDefined()
    expect(service.openTab({ type: 'hidden' }, { sessionId: 's1' })).toBeDefined()
  })

  it('opens the column only for a content seed', () => {
    const service = new XmartWorkbenchController()
    const open = vi.fn()
    service.attachPanel(open)
    service.registerTab(tab({ id: 'plain', title: 'Plain' }))
    service.openTab({ type: 'plain' }, { sessionId: 's1' })
    expect(open).not.toHaveBeenCalled()
    service.openTab({ type: 'plain', id: 'p', path: '/a.ts' }, { sessionId: 's1' })
    expect(open).toHaveBeenCalledTimes(1)
    service.openTab({ type: 'plain', url: 'https://x.test' }, { sessionId: 's1' })
    expect(open).toHaveBeenCalledTimes(2)
  })
})

describe('openFile, persist, and observers', () => {
  it('openFile routes by viewer, dedupes by path, and uses the basename', () => {
    const service = new XmartWorkbenchController()
    const open = vi.fn()
    service.attachPanel(open)
    service.registerTab(tab({ id: 'editor', title: 'Editor', hidden: true, dedupeKey: opened => opened.path }))
    service.registerTab(tab({ id: 'image', title: 'Image', hidden: true, dedupeKey: opened => opened.path }))
    service.registerTab(tab({ id: 'binary', title: 'Binary', hidden: true, dedupeKey: opened => opened.path }))
    service.registerFileViewer(viewer({ id: 'image', exts: ['png'], priority: 20 }))
    service.registerFileViewer(viewer({
      id: 'binary-download', exts: [], priority: 50, detect: (_path, head) => head.includes(0),
    }))
    const first = service.openFile('C:\\proj\\main.ts', { sessionId: 's1' })
    const again = service.openFile('C:\\proj\\main.ts', { sessionId: 's1' })
    expect(first).toBe(again)
    expect(service.getSnapshot('s1').tabs).toEqual([
      { id: first, type: 'editor', title: 'main.ts', path: 'C:\\proj\\main.ts' },
    ])
    expect(service.openFile('/pic.png', { sessionId: 's1' })?.startsWith('image:')).toBe(true)
    expect(service.openFile('/a.bin', { sessionId: 's1' }, new Uint8Array([0, 1]))?.startsWith('binary:')).toBe(true)
    expect(open).toHaveBeenCalled()
    expect(service.openFile('/z.ts')).toBeUndefined()
    service.bindSession('s1')
    expect(service.openFile('/')?.slice(0, 7)).toBe('editor:')
    expect(service.getSnapshot('s1').tabs.some(opened => opened.title === '/')).toBe(true)
  })

  it('retargets or drops file tabs after explorer rename and delete', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({ id: 'editor', title: 'Editor', hidden: true, dedupeKey: opened => opened.path }))
    service.openFile('/ws/src/a.ts', { sessionId: 's1' })
    service.openFile('/ws/keep.ts', { sessionId: 's1' })
    service.retargetPaths('/ws/src', '/ws/lib', { sessionId: 's1' })
    expect(service.getSnapshot('s1').tabs.map(row => row.path)).toEqual(['/ws/lib/a.ts', '/ws/keep.ts'])
    expect(service.getSnapshot('s1').tabs[0]?.title).toBe('a.ts')
    const afterRename = service.getSnapshot('s1')
    expect(afterRename.tabs.map(row => row.path)).toEqual(['/ws/lib/a.ts', '/ws/keep.ts'])
    service.retargetPaths('/ws/keep.ts', undefined, { sessionId: 's1' })
    const afterDropActive = service.getSnapshot('s1')
    expect(afterDropActive.tabs.map(row => row.path)).toEqual(['/ws/lib/a.ts'])
    expect(afterDropActive.activeTabId).toBe(afterDropActive.tabs[0]?.id)
    service.retargetPaths('/ws', undefined, { sessionId: 's1' })
    expect(service.getSnapshot('s1').tabs).toEqual([])
    expect(service.getSnapshot('s1').activeTabId).toBeNull()
    service.retargetPaths('/ws', undefined)
  })

  it('restores tabs from localStorage on a new controller', () => {
    const first = new XmartWorkbenchController()
    first.registerTab(tab({ id: 'plain', title: 'Plain', single: true }))
    first.openTab({ type: 'plain' }, { sessionId: 'keep' })
    const second = new XmartWorkbenchController()
    expect(second.getSnapshot('keep').tabs).toEqual([
      { id: 'plain:1', type: 'plain', title: 'Plain' },
    ])
    expect(second.getSnapshot('keep').activeTabId).toBe('plain:1')
  })

  it('inheritSession copies editor and terminal tabs and overwrites a filled target', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({ id: 'editor', title: 'Editor', hidden: true, dedupeKey: opened => opened.path }))
    service.registerTab(tab({ id: 'terminal', title: 'Terminal', hidden: true }))
    service.openFile('/ws/a.ts', { sessionId: 's1' })
    service.openTab({ type: 'terminal' }, { sessionId: 's1' })
    service.setActivity('git', { sessionId: 's1' })
    service.openFile('/ws/old.ts', { sessionId: 's2' })
    expect(service.inheritSession('s1', 's1')).toBe(false)
    expect(service.inheritSession('s1', 's2')).toBe(true)
    expect(service.getSnapshot('s2').tabs.map(row => row.type)).toEqual(['editor', 'terminal'])
    expect(service.getSnapshot('s2').tabs.map(row => row.path)).toEqual(['/ws/a.ts', undefined])
    expect(service.getSnapshot('s2').activeTabId).toBe(service.getSnapshot('s1').activeTabId)
    expect(service.getSnapshot('s2').activity).toBe('git')
    expect(service.inheritSession('s1', 's2')).toBe(true)
  })

  it('scope resolver shares one store across sessions in the same project', () => {
    const service = new XmartWorkbenchController()
    service.setScopeResolver(id => id === 's1' || id === 's2' ? '/ws' : undefined)
    service.registerTab(tab({ id: 'editor', title: 'Editor', hidden: true, dedupeKey: opened => opened.path }))
    service.registerTab(tab({ id: 'terminal', title: 'Terminal', hidden: true }))
    service.openFile('/ws/a.ts', { sessionId: 's1' })
    service.openTab({ type: 'terminal' }, { sessionId: 's1' })
    expect(service.scopeOf('s1')).toBe('/ws')
    expect(service.scopeOf('s2')).toBe('/ws')
    expect(service.observeSession('s1')).toBe(service.observeSession('s2'))
    expect(service.getSnapshot('s2').tabs.map(row => row.type)).toEqual(['editor', 'terminal'])
    expect(service.inheritSession('s1', 's2')).toBe(true)
    expect(service.getSnapshot('s2').tabs).toHaveLength(2)
    service.openFile('/ws/b.ts', { sessionId: 's2' })
    expect(service.getSnapshot('s1').tabs.map(row => row.path)).toEqual(['/ws/a.ts', undefined, '/ws/b.ts'])
  })

  it('returns the frozen empty view when no session is bound', () => {
    const service = new XmartWorkbenchController()
    expect(service.getSnapshot()).toBe(EMPTY_WORKBENCH_VIEW)
    expect(EMPTY_SESSION_SOURCE.getSnapshot()).toBe(EMPTY_WORKBENCH_VIEW)
    expect(EMPTY_SESSION_SOURCE.subscribe(() => {})()).toBeUndefined()
  })

  it('returns a stable observeSession source and a stable observeRegistry source', () => {
    const service = new XmartWorkbenchController()
    const a = service.observeSession('s1')
    const b = service.observeSession('s1')
    expect(a).toBe(b)
    expect(service.observeRegistry()).toBe(service.observeRegistry())
    expect(a.getSnapshot().tabs).toEqual([])
    const listener = vi.fn()
    const off = a.subscribe(listener)
    service.registerTab(tab({ id: 'plain', title: 'Plain', single: true }))
    service.openTab({ type: 'plain' }, { sessionId: 's1' })
    expect(listener).toHaveBeenCalled()
    expect(a.getSnapshot().tabs).toHaveLength(1)
    off()
  })
})

describe('persist sanitization', () => {
  it('drops garbage tab persist and keeps a well-formed row', () => {
    localStorage.setItem(`${TABS_PERSIST}.junk`, JSON.stringify({
      tabs: [{ id: 'a', type: 't', title: 'A', path: '/a' }, { id: 1 }, { id: 'b', type: 't', title: 'B' }],
      activeTabId: 'missing',
      nextSeq: 0,
    }))
    const service = new XmartWorkbenchController()
    expect(service.getSnapshot('junk')).toMatchObject({
      tabs: [
        { id: 'a', type: 't', title: 'A', path: '/a' },
        { id: 'b', type: 't', title: 'B' },
      ],
      activeTabId: 'b',
      nextSeq: 1,
      activity: 'explorer',
    })
    localStorage.setItem(`${TABS_PERSIST}.ok`, JSON.stringify({
      tabs: [{ id: 'a', type: 't', title: 'A' }],
      activeTabId: 'a',
      nextSeq: 4,
    }))
    expect(new XmartWorkbenchController().getSnapshot('ok').nextSeq).toBe(4)
    localStorage.setItem(`${TABS_PERSIST}.bad`, JSON.stringify(null))
    expect(new XmartWorkbenchController().getSnapshot('bad').tabs).toEqual([])
    localStorage.setItem(`${TABS_PERSIST}.nota`, JSON.stringify({ tabs: 'nope' }))
    expect(new XmartWorkbenchController().getSnapshot('nota').tabs).toEqual([])
    localStorage.setItem(`${TABS_PERSIST}.nulls`, JSON.stringify({
      tabs: [null, { id: 'a', type: 't', title: 'A', path: 1 }],
    }))
    expect(new XmartWorkbenchController().getSnapshot('nulls').tabs).toEqual([])
  })

  it('createTab without a patch still appends, and a content open without attachPanel is safe', () => {
    const service = new XmartWorkbenchController()
    service.registerTab(tab({
      id: 'mint',
      title: 'Mint',
      createTab: () => ({ tab: { id: 'mint:x', type: 'mint', title: 'Mint' } }),
    }))
    expect(service.openTab({ type: 'mint', url: 'https://x.test' }, { sessionId: 's1' })).toBe('mint:x')
    expect(service.getSnapshot('s1').tabs[0]?.path).toBe('https://x.test')
  })

  it('records a function viewer title and matches a Windows PNG path', () => {
    const service = new XmartWorkbenchController()
    service.registerFileViewer(viewer({
      id: 'image',
      title: () => 'Image',
      exts: ['png'],
      fetchStrategy: 'mediaUrl',
    }))
    expect(service.observeRegistry().getSnapshot().viewers[0]?.title).toBe('Image')
    expect(service.matchFileViewer('C:\\a\\Photo.PNG')?.id).toBe('image')
    expect(service.matchFileViewer('/a/file')).toBeUndefined()
    expect(service.matchFileViewer('/a/.env')).toBeUndefined()
  })

  it('setActivity writes, no-ops without a session, and sanitizes persist garbage', () => {
    const service = new XmartWorkbenchController()
    service.setActivity('git')
    expect(service.getSnapshot()).toBe(EMPTY_WORKBENCH_VIEW)
    service.setActivity('git', { sessionId: 's1' })
    expect(service.getSnapshot('s1').activity).toBe('git')
    service.setActivity('git', { sessionId: 's1' })
    expect(service.getSnapshot('s1').activity).toBe('git')
    service.setActivity('explorer', { sessionId: 's1' })
    expect(service.getSnapshot('s1').activity).toBe('explorer')
    localStorage.setItem(`${TABS_PERSIST}.act`, JSON.stringify({
      tabs: [], activeTabId: null, nextSeq: 1, activity: 'NOPE',
    }))
    expect(new XmartWorkbenchController().getSnapshot('act').activity).toBe('explorer')
    localStorage.setItem(`${TABS_PERSIST}.legacy-tasks`, JSON.stringify({
      tabs: [], activeTabId: null, nextSeq: 1, activity: 'tasks',
    }))
    expect(new XmartWorkbenchController().getSnapshot('legacy-tasks').activity).toBe('explorer')
    localStorage.setItem(`${TABS_PERSIST}.act2`, JSON.stringify({
      tabs: [], activeTabId: null, nextSeq: 1, activity: 'git',
    }))
    expect(new XmartWorkbenchController().getSnapshot('act2').activity).toBe('git')
  })

  it('drops leftover split fields from persist', () => {
    localStorage.setItem(`${TABS_PERSIST}.split`, JSON.stringify({
      tabs: [{ id: 'a', type: 't', title: 'A' }, { id: 'b', type: 't', title: 'B' }],
      activeTabId: 'a',
      nextSeq: 3,
      splitTabId: 'b',
      splitRatio: 0.3,
    }))
    const snap = new XmartWorkbenchController().getSnapshot('split')
    expect(snap).toMatchObject({
      tabs: [
        { id: 'a', type: 't', title: 'A' },
        { id: 'b', type: 't', title: 'B' },
      ],
      activeTabId: 'a',
      nextSeq: 3,
      activity: 'explorer',
    })
    expect(snap).not.toHaveProperty('splitTabId')
    expect(snap).not.toHaveProperty('splitRatio')
  })

  it('setActivity writes, no-ops the same value, and sanitizes persist', () => {
    const service = new XmartWorkbenchController()
    service.setActivity('git')
    expect(service.getSnapshot()).toBe(EMPTY_WORKBENCH_VIEW)
    service.setActivity('git', { sessionId: 's1' })
    expect(service.getSnapshot('s1').activity).toBe('git')
    const listener = vi.fn()
    service.subscribe(listener)
    service.setActivity('git', { sessionId: 's1' })
    expect(listener).not.toHaveBeenCalled()
    service.setActivity('explorer', { sessionId: 's1' })
    expect(service.getSnapshot('s1').activity).toBe('explorer')
    localStorage.setItem(`${TABS_PERSIST}.act`, JSON.stringify({
      tabs: [], activeTabId: null, nextSeq: 1, activity: 'git',
    }))
    expect(new XmartWorkbenchController().getSnapshot('act').activity).toBe('git')
    localStorage.setItem(`${TABS_PERSIST}.badact`, JSON.stringify({
      tabs: [], activeTabId: null, nextSeq: 1, activity: 'NOPE',
    }))
    expect(new XmartWorkbenchController().getSnapshot('badact').activity).toBe('explorer')
  })

  it('drops garbage prefs and honors an explicit false', () => {
    localStorage.setItem(PREFS_PERSIST, JSON.stringify({
      tabsEnabled: { explorer: false, other: 'no' },
      viewersEnabled: 1,
    }))
    const service = new XmartWorkbenchController()
    expect(service.isTabEnabled('explorer')).toBe(false)
    expect(service.isTabEnabled('other')).toBe(true)
    expect(service.isViewerEnabled('image')).toBe(true)
    localStorage.setItem(PREFS_PERSIST, JSON.stringify(null))
    expect(new XmartWorkbenchController().isTabEnabled('x')).toBe(true)
  })
})
