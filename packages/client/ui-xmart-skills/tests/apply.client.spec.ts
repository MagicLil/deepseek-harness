import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject, NS } from '../src/client/index.ts'
import { SkillsSettingsSection } from '../src/client/SkillsSettingsSection.tsx'
import type { SkillsSettingsInjected } from '../src/client/contract.ts'

usePinnedBrowserLanguages('zh-CN')
afterEach(() => {})

type ListResult =
  | { readonly ok: true; readonly value: { items: readonly [] } }
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
  const listOwned = vi.fn<() => Promise<ListResult>>()
    .mockResolvedValue({ ok: true, value: { items: [] } })
  const listProject = vi.fn<() => Promise<ListResult>>()
    .mockResolvedValue({ ok: true, value: { items: [] } })
  const setEnabled = vi.fn()
  ctx.provide('remote.skillManager', {
    listOwned, listProject, setEnabled,
  })
  return {
    ctx, slots: ctx.get('slots') as SlotRegistry, locale,
    listOwned, listProject, setEnabled,
  }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-xmart-skills browser plugin', () => {
  it('declares only the services used by the Settings Remote contribution', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.skillManager'])
  })

  it('registers a localized section and unwraps Remote calls', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const entry = b.slots.entries('settings.section')[0]!
    expect(entry.component).toBe(SkillsSettingsSection)
    expect(entry.options).toMatchObject({ id: 'skills', order: 22 })
    expect(entry.locale).toBe(NS)
    expect(resolveSlotLabel(entry.options.label)).toBe('技能')
    expect(b.listOwned).not.toHaveBeenCalled()

    const injected = (entry.inject as unknown as () => SkillsSettingsInjected)()
    await expect(injected.listOwned('personal')).resolves.toEqual([])
    expect(b.listOwned).toHaveBeenCalledWith({ scope: 'personal' })
    await expect(injected.listProject('/p')).resolves.toEqual([])
    expect(b.listProject).toHaveBeenCalledWith({ projectRoot: '/p' })
    b.setEnabled.mockResolvedValueOnce({ ok: true, value: { ok: true } })
    await expect(injected.setEnabled({ name: 'n', enabled: false })).resolves.toEqual({ ok: true })
    b.listOwned.mockResolvedValueOnce({ ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } })
    await expect(injected.listOwned('project', '/p')).rejects.toThrow(
      'skillManager.listOwned failed: REMOTE_ERROR: unavailable',
    )
    await b.ctx.fiber.dispose()
  })

  it('follows locale and recovers across late declaration', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('settings.section')).toHaveLength(0)

    const stop = declare(b.slots)
    await vi.waitFor(() => { expect(b.slots.entries('settings.section')).toHaveLength(1) })
    b.locale.setLocale('en')
    expect(resolveSlotLabel(b.slots.entries('settings.section')[0]!.options.label)).toBe('Skills')

    stop()
    await vi.waitFor(() => { expect(b.slots.entries('settings.section')).toHaveLength(0) })
    declare(b.slots)
    await vi.waitFor(() => { expect(b.slots.entries('settings.section')).toHaveLength(1) })
    await fiber.dispose()
  })
})
