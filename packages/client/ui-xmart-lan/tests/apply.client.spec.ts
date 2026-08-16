import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject, NS } from '../src/client/index.ts'
import { LanSettingsSection } from '../src/client/LanSettingsSection.tsx'
import type { LanSettingsInjected, LanStatus } from '../src/client/contract.ts'

usePinnedBrowserLanguages('zh-CN')
afterEach(() => {})

const STATUS: LanStatus = {
  enabled: false,
  port: 3080,
  loopbackUrl: 'http://127.0.0.1:3080/',
  lanUrl: null,
  token: 'tok',
  bindError: null,
}

type Wire<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

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
  const status = vi.fn<() => Promise<Wire<LanStatus>>>().mockResolvedValue({ ok: true, value: STATUS })
  const setEnabled = vi.fn<(req: { enabled: boolean }) => Promise<Wire<LanStatus>>>()
    .mockResolvedValue({ ok: true, value: { ...STATUS, enabled: true } })
  const setPort = vi.fn<(req: { port: number }) => Promise<Wire<LanStatus>>>()
    .mockResolvedValue({ ok: true, value: STATUS })
  const rotateToken = vi.fn<() => Promise<Wire<LanStatus>>>().mockResolvedValue({ ok: true, value: STATUS })
  ctx.provide('remote.xmartLan', { status, setEnabled, setPort, rotateToken })
  return { ctx, slots: ctx.get('slots') as SlotRegistry, status, setEnabled, setPort, rotateToken }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-xmart-lan browser plugin', () => {
  it('declares only the services used by the Settings Remote contribution', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.xmartLan'])
  })

  it('registers a localized section and unwraps Remote calls', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const entry = b.slots.entries('settings.section')[0]!
    expect(entry.component).toBe(LanSettingsSection)
    expect(entry.options).toMatchObject({ id: 'lan', order: 24 })
    expect(entry.locale).toBe(NS)
    expect(resolveSlotLabel(entry.options.label)).toBe('局域网')

    const injected = (entry.inject as unknown as () => LanSettingsInjected)()
    await expect(injected.status()).resolves.toEqual(STATUS)
    await expect(injected.setEnabled(true)).resolves.toMatchObject({ enabled: true })
    expect(b.setEnabled).toHaveBeenCalledWith({ enabled: true })
    await expect(injected.setPort(4090)).resolves.toEqual(STATUS)
    expect(b.setPort).toHaveBeenCalledWith({ port: 4090 })
    await expect(injected.rotateToken()).resolves.toEqual(STATUS)
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    await injected.copyText('tok')
    expect(writeText).toHaveBeenCalledWith('tok')
    b.status.mockResolvedValueOnce({ ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } })
    await expect(injected.status()).rejects.toThrow('xmartLan.status failed: REMOTE_ERROR: unavailable')
    await b.ctx.fiber.dispose()
  })
})
