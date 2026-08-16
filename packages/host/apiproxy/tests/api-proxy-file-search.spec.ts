/**
 * host.search handler on the real ApiProxy: success passthrough, error
 * mapping, and abort → cancelled.
 */
import { existsSync, mkdirSync, mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent, AgentFactory } from '@deepseek-ai/dsh-agent'
import SessionStore, { type Session } from '@deepseek-ai/dsh-session'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import WorkspaceRegistry from '@deepseek-ai/dsh-workspace'
import type { RpcRequest, RpcResponse } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '../src/api-proxy.ts'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'

const { collectFileSearch } = vi.hoisted(() => ({
  collectFileSearch: vi.fn(),
}))

vi.mock('../src/search-ops.ts', () => ({ collectFileSearch }))

let nextRpc = 1

function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`file-search-${String(nextRpc++)}`), payload }
}

function expectOk<T>(response: RpcResponse<T>): T {
  expect(response.result.ok).toBe(true)
  if (!response.result.ok) throw new Error('unreachable')
  return response.result.value
}

function expectErr<T>(response: RpcResponse<T>): { code: string; message: string } {
  expect(response.result.ok).toBe(false)
  if (response.result.ok) throw new Error('unreachable')
  return response.result.error
}

function stubAgent(session: Session): Agent {
  return {
    id: session.id,
    options: {},
    session,
    inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle',
    ctx: new Context(),
    send: () => {},
    followup: () => {},
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' as const }) }),
    inject: () => {},
    cancel() {},
    runMaintenance: job => job(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
}

async function harness() {
  const root = existsSync(tmpdir())
    ? realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-apiproxy-search-')))
    : mkdtempSync(join(tmpdir(), 'dsh-apiproxy-search-'))
  mkdirSync(root, { recursive: true })
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(Storage)
  ctx.storage.backend.register('memory', new MemoryStorageBackend())
  const storageDomain = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', storageDomain)
  ctx.provide('storageDomain', storageDomain)
  ctx.provide('sessionPersistence', { list: () => Promise.resolve([]) } as never)
  await ctx.plugin(WorkspaceRegistry)
  const factory: AgentFactory = {
    async createAgent(_ownerCtx, options) {
      const session = ctx.sessions.create(
        options.sessionId,
        options.meta === undefined ? {} : { meta: options.meta },
      )
      const agent = stubAgent(session)
      const unregister = ctx.agents.register(agent)
      return {
        agent,
        dispose: () => {
          unregister()
          return Promise.resolve()
        },
      }
    },
    async resume() {
      throw new Error('test harness has no persisted sessions')
    },
  }
  ctx.agents.setFactory(factory)
  ctx.provide('directoryPicker', { capability: () => ({ kind: 'native', pick: async () => null }) } as never)
  const api = createApiProxy(ctx, {
    defaultModelSelection: () => ({ provider: 'test', model: 'test-model' }),
    cwd: root,
  })
  return { api }
}

beforeEach(() => {
  collectFileSearch.mockReset()
})

describe('host.search handler', () => {
  it('passes the payload through and returns the collected result', async () => {
    const { api } = await harness()
    const value = {
      root: '/w',
      hits: [{ path: '/w/a.ts', line: 2, text: 'x', spans: [{ start: 0, end: 1 }] }],
      fileCount: 1,
      truncated: false,
    }
    collectFileSearch.mockResolvedValue({ ok: true, value })
    expect(expectOk(await api.host.search(
      request({ path: '/w', query: 'x', regex: true, caseSensitive: true, wholeWord: true, include: '*.ts', exclude: '*.md', limit: 9 }),
      new AbortController().signal,
    ))).toEqual(value)
    expect(collectFileSearch).toHaveBeenCalledWith(
      {
        path: '/w', query: 'x', regex: true, caseSensitive: true, wholeWord: true,
        include: '*.ts', exclude: '*.md', limit: 9,
      },
      expect.any(AbortSignal),
    )
  })

  it('maps classified failures and aborted signals', async () => {
    const { api } = await harness()
    collectFileSearch.mockResolvedValue({ ok: false, code: 'search-invalid', message: 'bad pattern' })
    const error = expectErr(await api.host.search(request({ path: '/w', query: '[' }), new AbortController().signal))
    expect(error).toMatchObject({ code: 'search-invalid', message: 'bad pattern' })

    const abort = new AbortController()
    abort.abort()
    collectFileSearch.mockResolvedValue({ ok: false, code: 'search-failed', message: 'search was aborted' })
    expect(expectErr(await api.host.search(request({ path: '/w', query: 'x' }), abort.signal)).code)
      .toBe('cancelled')
  })
})
