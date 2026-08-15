import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { XmartWorkbenchController } from '@deepseek-ai/dsh-client-ui-xmart-workbench/client'
import { apply, inject, NS } from '../src/client/index.ts'
import { apply as nodeApply } from '../src/index.ts'
import * as invariant from '../src/invariant.ts'

usePinnedBrowserLanguages('zh-CN')

afterEach(async () => {
  // fibers disposed in each test
})

const emptyJob = { ok: true, value: { ok: true, logs: '', needsRestart: false } }
const emptyList = { ok: true, value: { query: '', items: [] } }

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  class RemoteService extends Service {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'remote')
    }
  }
  new RemoteService(ctx)
  const marketplace = {
    searchPlugins: vi.fn(async () => emptyList),
    listInstalledPlugins: vi.fn(async () => emptyList),
    installPlugin: vi.fn(async () => emptyJob),
    uninstallPlugin: vi.fn(async () => emptyJob),
    searchExtensions: vi.fn(async () => emptyList),
    listInstalledExtensions: vi.fn(async () => emptyList),
    installExtension: vi.fn(async () => emptyJob),
    uninstallExtension: vi.fn(async () => emptyJob),
  }
  ctx.provide('remote.marketplace', marketplace)
  Object.assign(ctx.get('remote') as object, { marketplace })
  const workbench = new XmartWorkbenchController()
  ctx.provide('xmartWorkbench', workbench)
  return { ctx, locale, marketplace, workbench }
}

describe('ui-xmart-marketplace apply', () => {
  it('declares the services it drives', () => {
    expect(inject).toEqual(['slots', 'locale', 'xmartWorkbench', 'remote', 'remote.marketplace'])
    nodeApply()
    expect(invariant.name).toBe('client-ui-xmart-marketplace-invariant')
  })

  it('registers plugins and extensions activities and unwraps remotes', async () => {
    const b = await bench()
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    expect(b.workbench.getActivity('plugins')?.id).toBe('plugins')
    expect(b.workbench.getActivity('extensions')?.id).toBe('extensions')
    expect(b.locale.bind(NS)('activity.plugins')).toBe('插件')
    const plugins = b.workbench.getActivity('plugins')!
    const extensions = b.workbench.getActivity('extensions')!
    const title = plugins.title
    const extTitle = extensions.title
    expect(typeof title === 'function' ? title() : title).toBe('插件')
    expect(typeof extTitle === 'function' ? extTitle() : extTitle).toBe('扩展')
    expect(extensions.component({
      tab: { id: 'extensions', type: 'extensions', title: 'e' },
      visible: false,
      sessionId: 's1',
    })).toBeTruthy()
    const Body = plugins.component
    expect(Body).toBeTypeOf('function')

    const rpc = {
      searchPlugins: async (q: string) => (
        await (b.ctx.remote as { marketplace: typeof b.marketplace }).marketplace.searchPlugins({ query: q })
      ),
    }
    void rpc
    const injected = plugins.component
    expect(injected).toBeDefined()

    b.marketplace.searchPlugins.mockResolvedValueOnce({
      ok: false, error: { code: 'E', message: 'nope' },
    })
    const paneProps = { id: 'plugins', type: 'plugins', title: 'plugins' }
    const element = injected({ tab: paneProps, visible: false, sessionId: 's1' })
    expect(element).toBeTruthy()

    await b.ctx.fiber.dispose()
  })

  it('unwraps each remote helper through the registered pane props', async () => {
    const b = await bench()
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const plugins = b.workbench.getActivity('plugins')!
    const element = plugins.component({
      tab: { id: 'plugins', type: 'plugins', title: 'p' },
      visible: false,
      sessionId: 's1',
    }) as { props: {
      searchPlugins: (q: string) => Promise<unknown>
      listInstalledPlugins: () => Promise<unknown>
      installPlugin: (spec: string, allow: boolean) => Promise<unknown>
      uninstallPlugin: (name: string) => Promise<unknown>
      searchExtensions: (q: string) => Promise<unknown>
      listInstalledExtensions: () => Promise<unknown>
      installExtension: (id: string, url?: string) => Promise<unknown>
      uninstallExtension: (id: string) => Promise<unknown>
    } }
    const p = element.props
    await expect(p.searchPlugins('q')).resolves.toEqual([])
    await expect(p.listInstalledPlugins()).resolves.toEqual([])
    await expect(p.installPlugin('s', false)).resolves.toMatchObject({ ok: true })
    await expect(p.uninstallPlugin('n')).resolves.toMatchObject({ ok: true })
    await expect(p.searchExtensions('v')).resolves.toEqual([])
    await expect(p.listInstalledExtensions()).resolves.toEqual([])
    await expect(p.installExtension('id', 'https://x')).resolves.toMatchObject({ ok: true })
    await expect(p.installExtension('id')).resolves.toMatchObject({ ok: true })
    await expect(p.uninstallExtension('id')).resolves.toMatchObject({ ok: true })
    b.locale.setLocale('en')
    await expect(p.searchPlugins('q')).resolves.toEqual([])
    expect(b.marketplace.searchPlugins).toHaveBeenCalledWith({ query: 'q', locale: 'en' })
    b.marketplace.searchPlugins.mockResolvedValueOnce({ ok: false, error: { code: 'E', message: 'x' } })
    await expect(p.searchPlugins('q')).rejects.toThrow('marketplace.searchPlugins failed')
    await b.ctx.fiber.dispose()
  })
})
