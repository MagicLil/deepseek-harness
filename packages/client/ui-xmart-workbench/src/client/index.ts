/**
 * X-Mart workbench plugin, browser half. Two registrations: WorkbenchColumn
 * fills the frame-declared `workbench` slot, and WorkbenchToggle fills
 * `shell.overlay` so a closed column can be reopened. Both read panel
 * transitions through `ctx.layout`. Export discipline: packages/client/AGENTS.md.
 */
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { WorkbenchColumnInjected, WorkbenchToggleInjected } from './contract.ts'
import { createWorkbenchStore } from './stores.ts'
import { WorkbenchColumn } from './WorkbenchColumn.tsx'
import { WorkbenchToggle } from './WorkbenchToggle.tsx'
import { en, NS, zh } from './locales.ts'

export type {
  WorkbenchColumnInjected, WorkbenchColumnProps, WorkbenchToggleInjected, WorkbenchToggleProps,
} from './contract.ts'
export type { WorkbenchKey } from './locales.ts'
export type { WorkbenchPersistState } from './stores.ts'

/**
 * Required services (cordis fiber inject). The target slots are declared by
 * ui-layout; apply depends on each declaration through `slots.inject()`.
 */
export const inject = ['slots', 'locale', 'layout']

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
 * Register the workbench dictionaries and the two slot contributions.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-xmart-workbench: dictionaries')

  const openFlag = createOpenFlag()
  const persist = createWorkbenchStore()
  const columnInjected = (): WorkbenchColumnInjected => ({
    closeWorkbench: () => { ctx.layout.closeWorkbench() },
    setWorkbench: (px) => { ctx.layout.setWorkbench(px) },
    reportOpen: (open) => { openFlag.set(open) },
  })
  const toggleInjected = (): WorkbenchToggleInjected => ({
    openWorkbench: () => { ctx.layout.openWorkbench() },
    hooks: { workbenchOpen: openFlag.source },
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
}
