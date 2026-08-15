/**
 * host.git* handlers on the real ApiProxy: success, git-failed, and abort.
 */
import { existsSync, mkdirSync, mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent, AgentFactory } from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import WorkspaceRegistry from '@deepseek-ai/dsh-workspace'
import type { RpcRequest, RpcResponse } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '../src/api-proxy.ts'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'

const {
  collectGitDiff, collectGitStage, collectGitUnstage, collectGitCommit,
  collectGitDiscard, collectGitLog,
} = vi.hoisted(() => ({
  collectGitDiff: vi.fn(),
  collectGitStage: vi.fn(),
  collectGitUnstage: vi.fn(),
  collectGitCommit: vi.fn(),
  collectGitDiscard: vi.fn(),
  collectGitLog: vi.fn(),
}))

vi.mock('../src/git-ops.ts', () => ({
  collectGitDiff,
  collectGitStage,
  collectGitUnstage,
  collectGitCommit,
  collectGitDiscard,
  collectGitLog,
}))

let nextRpc = 1

function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`git-ops-${String(nextRpc++)}`), payload }
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
    ? realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-apiproxy-git-')))
    : mkdtempSync(join(tmpdir(), 'dsh-apiproxy-git-'))
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
  return { api, root }
}

beforeEach(() => {
  collectGitDiff.mockReset()
  collectGitStage.mockReset()
  collectGitUnstage.mockReset()
  collectGitCommit.mockReset()
  collectGitDiscard.mockReset()
  collectGitLog.mockReset()
})

describe('host.git* handlers', () => {
  it('returns success values from every verb', async () => {
    const { api } = await harness()
    collectGitDiff.mockResolvedValue({
      ok: true, value: { root: '/r', side: 'worktree', text: 'diff' },
    })
    collectGitStage.mockResolvedValue({ ok: true, value: { root: '/r' } })
    collectGitUnstage.mockResolvedValue({ ok: true, value: { root: '/r' } })
    collectGitCommit.mockResolvedValue({ ok: true, value: { root: '/r', hash: 'abc' } })
    collectGitDiscard.mockResolvedValue({ ok: true, value: { root: '/r' } })
    collectGitLog.mockResolvedValue({ ok: true, value: [] })
    expect(expectOk(await api.host.gitDiff(request({ path: '/r', side: 'worktree' }), new AbortController().signal)))
      .toEqual({ root: '/r', side: 'worktree', text: 'diff' })
    expectOk(await api.host.gitStage(request({ path: '/r', files: ['a.ts'] }), new AbortController().signal))
    expectOk(await api.host.gitUnstage(request({ path: '/r', files: ['a.ts'] }), new AbortController().signal))
    expect(expectOk(await api.host.gitCommit(request({ path: '/r', message: 'm' }), new AbortController().signal)))
      .toEqual({ root: '/r', hash: 'abc' })
    expectOk(await api.host.gitDiscard(request({ path: '/r', files: ['a.ts'] }), new AbortController().signal))
    expect(expectOk(await api.host.gitLog(request({ path: '/r' }), new AbortController().signal))).toEqual([])
  })

  it('maps git-failed and aborted signals', async () => {
    const { api } = await harness()
    const failed = { ok: false as const, code: 'git-failed' as const, message: 'boom' }
    collectGitDiff.mockResolvedValue(failed)
    collectGitStage.mockResolvedValue(failed)
    collectGitUnstage.mockResolvedValue(failed)
    collectGitCommit.mockResolvedValue(failed)
    collectGitDiscard.mockResolvedValue(failed)
    collectGitLog.mockResolvedValue(failed)
    expect(expectErr(await api.host.gitDiff(request({ path: '/r', side: 'staged', file: 'a.ts' }), new AbortController().signal)).code)
      .toBe('git-failed')
    expect(expectErr(await api.host.gitStage(request({ path: '/r', files: ['a.ts'] }), new AbortController().signal)).code)
      .toBe('git-failed')
    expect(expectErr(await api.host.gitUnstage(request({ path: '/r', files: ['a.ts'] }), new AbortController().signal)).code)
      .toBe('git-failed')
    expect(expectErr(await api.host.gitCommit(request({ path: '/r', message: 'm' }), new AbortController().signal)).code)
      .toBe('git-failed')
    expect(expectErr(await api.host.gitDiscard(request({ path: '/r', files: ['a.ts'] }), new AbortController().signal)).code)
      .toBe('git-failed')
    expect(expectErr(await api.host.gitLog(request({ path: '/r', limit: 3 }), new AbortController().signal)).code)
      .toBe('git-failed')

    const abort = new AbortController()
    abort.abort()
    collectGitDiff.mockResolvedValue(failed)
    expect(expectErr(await api.host.gitDiff(request({ path: '/r', side: 'worktree' }), abort.signal)).code)
      .toBe('cancelled')
    collectGitStage.mockResolvedValue(failed)
    expect(expectErr(await api.host.gitStage(request({ path: '/r', files: ['a.ts'] }), abort.signal)).code)
      .toBe('cancelled')
    collectGitUnstage.mockResolvedValue(failed)
    expect(expectErr(await api.host.gitUnstage(request({ path: '/r', files: ['a.ts'] }), abort.signal)).code)
      .toBe('cancelled')
    collectGitCommit.mockResolvedValue(failed)
    expect(expectErr(await api.host.gitCommit(request({ path: '/r', message: 'm' }), abort.signal)).code)
      .toBe('cancelled')
    collectGitDiscard.mockResolvedValue(failed)
    expect(expectErr(await api.host.gitDiscard(request({ path: '/r', files: ['a.ts'] }), abort.signal)).code)
      .toBe('cancelled')
    collectGitLog.mockResolvedValue(failed)
    expect(expectErr(await api.host.gitLog(request({ path: '/r' }), abort.signal)).code)
      .toBe('cancelled')
  })
})
