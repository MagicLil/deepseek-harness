import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import Lsp from '@deepseek-ai/dsh-lsp'
import apply, { TsLspGateway, JavaLspGateway } from '../src/index.ts'
import type { PersistentLspPool } from '../src/pool.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

function fakePool(): {
  pool: PersistentLspPool
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
    id: 'typescript',
    extensionToLanguage: { '.ts': 'typescript' },
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
  } as unknown as PersistentLspPool
  return { pool, open, change, close, query }
}

async function harness(which: 'ts' | 'java'): Promise<{
  ctx: Context
  gw: TsLspGateway | JavaLspGateway
  pool: PersistentLspPool
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
  await ctx.plugin(which === 'ts' ? TsLspGateway : JavaLspGateway)
  const gw = ctx.get(which === 'ts' ? 'tsLsp' : 'javaLsp') as TsLspGateway | JavaLspGateway
  const created = fakePool()
  gw.poolOverride = created.pool
  return { ctx, gw, ...created }
}

describe('TsLspGateway', () => {
  it('publishes the tsLsp remotes', async () => {
    const { gw } = await harness('ts')
    expect(gw.typertRemote).toMatchObject({ serviceKey: 'tsLsp', namespace: 'tsLsp' })
    expect(remoteMethods(gw).map(item => item.method)).toEqual([
      'open', 'change', 'close', 'complete', 'diagnostics',
    ])
  })

  it('forwards editor remotes to the pool', async () => {
    const { gw, open, change, close } = await harness('ts')
    const signal = new AbortController().signal
    await gw.open({ workspaceRoot: '/ws', path: 'a.ts', text: 'const x = 1' }, signal)
    await gw.change({ workspaceRoot: '/ws', path: 'a.ts', text: 'const x = 2' }, signal)
    await gw.close({ workspaceRoot: '/ws', path: 'a.ts' }, signal)
    expect(await gw.complete({
      workspaceRoot: '/ws', path: 'a.ts', line: 0, character: 1,
    }, signal)).toEqual({ items: [{ label: 'A' }] })
    expect(await gw.diagnostics({ workspaceRoot: '/ws', path: 'a.ts' }, signal)).toEqual({
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
    await ctx.plugin(TsLspGateway)
    const gw = ctx.get('tsLsp') as TsLspGateway
    expect(gw.pool.extensionToLanguage['.ts']).toBe('typescript')
    await gw.pool.disposeAll()
  })

  it('registers a TypeScript provider on ctx.lsp and leaves .vue unclaimed', async () => {
    const { ctx, query } = await harness('ts')
    await expect(ctx.lsp.query({
      operation: 'hover',
      filePath: 'a.ts',
      position: { line: 0, character: 0 },
      workspaceRoot: '/ws',
    })).resolves.toEqual({ kind: 'hover', hover: { contents: 'h' } })
    expect(query).toHaveBeenCalled()
    await expect(ctx.lsp.query({
      operation: 'hover',
      filePath: 'A.vue',
      position: { line: 0, character: 0 },
      workspaceRoot: '/ws',
    })).rejects.toThrow(/no LSP provider/)
  })
})

describe('JavaLspGateway', () => {
  it('publishes the javaLsp remotes and forwards to the pool', async () => {
    const { gw, open } = await harness('java')
    expect(gw.typertRemote).toMatchObject({ serviceKey: 'javaLsp', namespace: 'javaLsp' })
    await gw.open({ workspaceRoot: '/ws', path: 'Foo.java', text: 'class Foo {}' })
    expect(open).toHaveBeenCalled()
    expect(await gw.complete({
      workspaceRoot: '/ws', path: 'Foo.java', line: 0, character: 1,
    })).toEqual({ items: [{ label: 'A' }] })
    expect(await gw.diagnostics({ workspaceRoot: '/ws', path: 'Foo.java' })).toEqual({
      items: [expect.objectContaining({ message: 'm' })],
    })
    await gw.change({ workspaceRoot: '/ws', path: 'Foo.java', text: 'class Bar {}' })
    await gw.close({ workspaceRoot: '/ws', path: 'Foo.java' })
  })

  it('lazily creates the default Java pool', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide('fs', {})
    ctx.provide('subprocess', { spawn: vi.fn() })
    await ctx.plugin(Lsp)
    await ctx.plugin(JavaLspGateway)
    const gw = ctx.get('javaLsp') as JavaLspGateway
    expect(gw.pool.extensionToLanguage).toEqual({ '.java': 'java' })
    await gw.pool.disposeAll()
  })

  it('registers a Java provider on ctx.lsp', async () => {
    const { ctx, query } = await harness('java')
    await expect(ctx.lsp.query({
      operation: 'hover',
      filePath: 'Foo.java',
      position: { line: 0, character: 0 },
      workspaceRoot: '/ws',
    })).resolves.toEqual({ kind: 'hover', hover: { contents: 'h' } })
    expect(query).toHaveBeenCalled()
  })
})

describe('apply', () => {
  it('mounts both gateways', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide('fs', {})
    ctx.provide('subprocess', { spawn: vi.fn() })
    await ctx.plugin(Lsp)
    await ctx.plugin(apply)
    expect(ctx.get('tsLsp')).toBeInstanceOf(TsLspGateway)
    expect(ctx.get('javaLsp')).toBeInstanceOf(JavaLspGateway)
  })
})
