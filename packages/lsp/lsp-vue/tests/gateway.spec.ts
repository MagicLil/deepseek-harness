import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import Lsp from '@deepseek-ai/dsh-lsp'
import VueLspGateway from '../src/index.ts'
import type { VueLspPool } from '../src/provider.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

function fakePool(): {
  pool: VueLspPool
  open: ReturnType<typeof vi.fn>
  change: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  query: ReturnType<typeof vi.fn>
} {
  const open = vi.fn(async () => {})
  const change = vi.fn(async () => {})
  const close = vi.fn(async () => {})
  const query = vi.fn(async () => ({ kind: 'hover', hover: { contents: 'h' } }))
  const pool = {
    id: 'vue',
    extensionToLanguage: { '.vue': 'vue' },
    open,
    change,
    close,
    complete: vi.fn(async () => [{ label: 'A' }]),
    diagnostics: vi.fn(async () => [{
      message: 'm',
      severity: 1,
      startLine: 0,
      startCharacter: 0,
      endLine: 0,
      endCharacter: 1,
    }]),
    query,
    disposeAll: vi.fn(async () => {}),
    asProvider: vi.fn(),
  } as unknown as VueLspPool
  return { pool, open, change, close, query }
}

async function harness(): Promise<{
  gw: VueLspGateway
  pool: VueLspPool
  open: ReturnType<typeof vi.fn>
  change: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  query: ReturnType<typeof vi.fn>
}> {
  const ctx = new Context()
  contexts.push(ctx)
  ctx.provide('fs', {})
  ctx.provide('subprocess', { spawn: vi.fn() })
  await ctx.plugin(Lsp)
  await ctx.plugin(VueLspGateway)
  const gw = ctx.get('vueLsp') as VueLspGateway
  const created = fakePool()
  gw.poolOverride = created.pool
  return { gw, ...created }
}

describe('VueLspGateway', () => {
  it('publishes the vueLsp remotes', async () => {
    const { gw } = await harness()
    expect(gw.typertRemote).toMatchObject({ serviceKey: 'vueLsp', namespace: 'vueLsp' })
    expect(remoteMethods(gw).map(item => item.method)).toEqual([
      'open', 'change', 'close', 'complete', 'diagnostics',
    ])
  })

  it('forwards editor remotes to the pool', async () => {
    const { gw, open, change, close } = await harness()
    const signal = new AbortController().signal
    await gw.open({ workspaceRoot: '/ws', path: 'A.vue', text: '<template />' }, signal)
    await gw.change({ workspaceRoot: '/ws', path: 'A.vue', text: '<p />' }, signal)
    await gw.close({ workspaceRoot: '/ws', path: 'A.vue' }, signal)
    expect(await gw.complete({
      workspaceRoot: '/ws', path: 'A.vue', line: 0, character: 1,
    }, signal)).toEqual({ items: [{ label: 'A' }] })
    expect(await gw.diagnostics({ workspaceRoot: '/ws', path: 'A.vue' }, signal)).toEqual({
      items: [{
        message: 'm',
        severity: 1,
        startLine: 0,
        startCharacter: 0,
        endLine: 0,
        endCharacter: 1,
      }],
    })
    expect(open).toHaveBeenCalled()
    expect(change).toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  it('lazily creates the default pool', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide('fs', {})
    ctx.provide('subprocess', { spawn: vi.fn() })
    await ctx.plugin(Lsp)
    await ctx.plugin(VueLspGateway)
    const gw = ctx.get('vueLsp') as VueLspGateway
    expect(gw.pool.extensionToLanguage).toEqual({ '.vue': 'vue' })
    await gw.pool.disposeAll()
  })

  it('registers a .vue provider on ctx.lsp', async () => {
    const { gw, query } = await harness()
    await expect(gw.ctx.lsp.query({
      operation: 'hover',
      filePath: 'A.vue',
      position: { line: 0, character: 0 },
      workspaceRoot: '/ws',
    })).resolves.toEqual({ kind: 'hover', hover: { contents: 'h' } })
    expect(query).toHaveBeenCalled()
    await expect(gw.ctx.lsp.query({
      operation: 'hover',
      filePath: 'A.ts',
      position: { line: 0, character: 0 },
      workspaceRoot: '/ws',
    })).rejects.toThrow(/no LSP provider/)
  })
})
