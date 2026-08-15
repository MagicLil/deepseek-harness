import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-xmart-workbench/client'
import type { WorkbenchColumnInjected, WorkbenchToggleInjected } from '@deepseek-ai/dsh-client-ui-xmart-workbench/client'
import { WorkbenchColumn } from '../src/client/WorkbenchColumn.tsx'
import { WorkbenchToggle } from '../src/client/WorkbenchToggle.tsx'
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
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, layout }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: {
      workbench: { kind: 'single', scope: 'session' },
      'shell.overlay': { kind: 'list', scope: 'root' },
    },
  } as never, () => null)
}

describe('ui-xmart-workbench apply', () => {
  it('declares the services it drives', () => {
    expect(inject).toEqual(['slots', 'locale', 'layout'])
  })

  it('registers the column and overlay toggle once the layout slots exist', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    expect(b.slots.entries('workbench')[0]!.component).toBe(WorkbenchColumn)
    expect(b.slots.entries('workbench')[0]!.locale).toBe('workbench')
    expect(b.locale.bind('workbench')('column.title')).toBe('工作台')
    expect(b.slots.entries('shell.overlay')[0]!.component).toBe(WorkbenchToggle)
  })

  it('routes column and toggle inject callbacks to ctx.layout', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const column = (b.slots.entries('workbench')[0]!.inject as unknown as () => WorkbenchColumnInjected)()
    column.closeWorkbench()
    column.setWorkbench(480)
    column.reportOpen(true)
    expect(b.layout.closeWorkbench).toHaveBeenCalledOnce()
    expect(b.layout.setWorkbench).toHaveBeenCalledWith(480)
    const toggle = (b.slots.entries('shell.overlay')[0]!.inject as unknown as () => WorkbenchToggleInjected)()
    toggle.openWorkbench()
    expect(b.layout.openWorkbench).toHaveBeenCalledOnce()
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

  it('unregisters both entries on teardown', async () => {
    const b = await bench()
    declare(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await fiber.dispose()
    expect(b.slots.entries('workbench')).toHaveLength(0)
    expect(b.slots.entries('shell.overlay')).toHaveLength(0)
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
