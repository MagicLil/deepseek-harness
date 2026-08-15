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
import SessionStore, { SessionId, type Session } from '@deepseek-ai/dsh-session'
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
  collectGitDiscard, collectGitLog, collectGitSync, collectGitBranches, collectGitCheckout,
  generateGitCommitMessage,
} = vi.hoisted(() => ({
  collectGitDiff: vi.fn(),
  collectGitStage: vi.fn(),
  collectGitUnstage: vi.fn(),
  collectGitCommit: vi.fn(),
  collectGitDiscard: vi.fn(),
  collectGitLog: vi.fn(),
  collectGitSync: vi.fn(),
  collectGitBranches: vi.fn(),
  collectGitCheckout: vi.fn(),
  generateGitCommitMessage: vi.fn(),
}))

vi.mock('../src/git-ops.ts', () => ({
  collectGitDiff,
  collectGitStage,
  collectGitUnstage,
  collectGitCommit,
  collectGitDiscard,
  collectGitLog,
  collectGitSync,
  collectGitBranches,
  collectGitCheckout,
}))

vi.mock('../src/git-commit-llm.ts', () => ({ generateGitCommitMessage }))

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
  return { api, root, ctx }
}

function liveSession(ctx: Context, id: string): SessionId {
  const sessionId = SessionId(id)
  const session = ctx.sessions.create(sessionId)
  ctx.agents.register(stubAgent(session))
  return sessionId
}

beforeEach(() => {
  collectGitDiff.mockReset()
  collectGitStage.mockReset()
  collectGitUnstage.mockReset()
  collectGitCommit.mockReset()
  collectGitDiscard.mockReset()
  collectGitLog.mockReset()
  collectGitSync.mockReset()
  collectGitBranches.mockReset()
  collectGitCheckout.mockReset()
  generateGitCommitMessage.mockReset()
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
    collectGitSync.mockResolvedValue({ ok: true, value: { root: '/r' } })
    collectGitBranches.mockResolvedValue({ ok: true, value: { root: '/r', branches: [] } })
    collectGitCheckout.mockResolvedValue({ ok: true, value: { root: '/r', name: 'feat' } })
    expect(expectOk(await api.host.gitDiff(request({ path: '/r', side: 'worktree' }), new AbortController().signal)))
      .toEqual({ root: '/r', side: 'worktree', text: 'diff' })
    expect(collectGitDiff).toHaveBeenCalledWith('/r', 'worktree', undefined, expect.any(AbortSignal), undefined)
    collectGitDiff.mockClear()
    collectGitDiff.mockResolvedValue({
      ok: true, value: { root: '/r', side: 'worktree', text: 'commit-diff' },
    })
    expect(expectOk(await api.host.gitDiff(
      request({ path: '/r', side: 'worktree', commit: 'abcdef1' }),
      new AbortController().signal,
    ))).toEqual({ root: '/r', side: 'worktree', text: 'commit-diff' })
    expect(collectGitDiff).toHaveBeenCalledWith('/r', 'worktree', undefined, expect.any(AbortSignal), 'abcdef1')
    expectOk(await api.host.gitStage(request({ path: '/r', files: ['a.ts'] }), new AbortController().signal))
    expectOk(await api.host.gitUnstage(request({ path: '/r', files: ['a.ts'] }), new AbortController().signal))
    expect(expectOk(await api.host.gitCommit(request({ path: '/r', message: 'm' }), new AbortController().signal)))
      .toEqual({ root: '/r', hash: 'abc' })
    expectOk(await api.host.gitDiscard(request({ path: '/r', files: ['a.ts'] }), new AbortController().signal))
    expect(expectOk(await api.host.gitLog(request({ path: '/r' }), new AbortController().signal))).toEqual([])
    expect(expectOk(await api.host.gitLog(request({ path: '/r', skip: 80 }), new AbortController().signal))).toEqual([])
    expect(collectGitLog).toHaveBeenCalledWith('/r', 20, expect.any(AbortSignal), 80)
    expectOk(await api.host.gitSync(request({ path: '/r', mode: 'fetch' }), new AbortController().signal))
    expect(expectOk(await api.host.gitBranches(request({ path: '/r' }), new AbortController().signal)))
      .toEqual({ root: '/r', branches: [] })
    expect(expectOk(await api.host.gitCheckout(request({ path: '/r', name: 'feat' }), new AbortController().signal)))
      .toEqual({ root: '/r', name: 'feat' })
    expect(expectOk(await api.host.gitCheckout(
      request({ path: '/r', name: 'abcdef1', detach: true }),
      new AbortController().signal,
    ))).toEqual({ root: '/r', name: 'feat' })
    expect(collectGitCheckout).toHaveBeenCalledWith(
      '/r', 'abcdef1', false, true, expect.any(AbortSignal),
    )
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
    collectGitSync.mockResolvedValue(failed)
    collectGitBranches.mockResolvedValue(failed)
    collectGitCheckout.mockResolvedValue(failed)
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
    expect(expectErr(await api.host.gitSync(request({ path: '/r', mode: 'pull' }), new AbortController().signal)).code)
      .toBe('git-failed')
    expect(expectErr(await api.host.gitBranches(request({ path: '/r' }), new AbortController().signal)).code)
      .toBe('git-failed')
    expect(expectErr(await api.host.gitCheckout(request({ path: '/r', name: 'feat', create: true }), new AbortController().signal)).code)
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
    collectGitSync.mockResolvedValue(failed)
    expect(expectErr(await api.host.gitSync(request({ path: '/r', mode: 'push' }), abort.signal)).code)
      .toBe('cancelled')
    collectGitBranches.mockResolvedValue(failed)
    expect(expectErr(await api.host.gitBranches(request({ path: '/r' }), abort.signal)).code)
      .toBe('cancelled')
    collectGitCheckout.mockResolvedValue(failed)
    expect(expectErr(await api.host.gitCheckout(request({ path: '/r', name: 'feat' }), abort.signal)).code)
      .toBe('cancelled')
  })

  it('suggests a commit message from the staged diff', async () => {
    const { api, ctx } = await harness()
    const sessionId = liveSession(ctx, 'git-s1')
    collectGitDiff.mockResolvedValue({
      ok: true, value: { root: '/r', side: 'staged', text: 'diff --git a' },
    })
    collectGitLog.mockResolvedValue({
      ok: true, value: [{ hash: 'a', subject: 'init', author: 'A', timestamp: 1 }],
    })
    generateGitCommitMessage.mockResolvedValue('feat: hello')
    expect(expectOk(await api.host.gitSuggestCommit(
      request({ path: '/r', sessionId }),
      new AbortController().signal,
    ))).toEqual({ message: 'feat: hello' })
    expect(generateGitCommitMessage).toHaveBeenCalledWith(expect.objectContaining({
      root: '/r',
      stagedDiff: 'diff --git a',
      recentSubjects: ['init'],
      provider: 'test',
      model: 'test-model',
    }))

    collectGitLog.mockResolvedValue({ ok: false, code: 'git-failed', message: 'no log' })
    generateGitCommitMessage.mockResolvedValue('chore: still')
    expect(expectOk(await api.host.gitSuggestCommit(
      request({ path: '/r', sessionId }),
      new AbortController().signal,
    )).message).toBe('chore: still')
    expect(generateGitCommitMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      recentSubjects: [],
    }))
  })

  it('maps suggest-commit failures', async () => {
    const { api, ctx } = await harness()
    expect(expectErr(await api.host.gitSuggestCommit(
      request({ path: '/r', sessionId: 'missing' }),
      new AbortController().signal,
    )).code).toBe('session-not-found')

    const sessionId = liveSession(ctx, 'git-s2')
    collectGitDiff.mockResolvedValue({ ok: false, code: 'git-failed', message: 'boom' })
    expect(expectErr(await api.host.gitSuggestCommit(
      request({ path: '/r', sessionId }),
      new AbortController().signal,
    )).code).toBe('git-failed')
    const abort = new AbortController()
    abort.abort()
    expect(expectErr(await api.host.gitSuggestCommit(
      request({ path: '/r', sessionId }),
      abort.signal,
    )).code).toBe('cancelled')

    collectGitDiff.mockResolvedValue({
      ok: true, value: { root: '/r', side: 'staged', text: '   ' },
    })
    expect(expectErr(await api.host.gitSuggestCommit(
      request({ path: '/r', sessionId }),
      new AbortController().signal,
    ))).toMatchObject({ code: 'git-failed', message: 'nothing staged' })

    collectGitDiff.mockResolvedValue({
      ok: true, value: { root: '/r', side: 'staged', text: 'diff' },
    })
    collectGitLog.mockResolvedValue({ ok: true, value: [] })
    generateGitCommitMessage.mockRejectedValue(new Error('nothing staged'))
    expect(expectErr(await api.host.gitSuggestCommit(
      request({ path: '/r', sessionId }),
      new AbortController().signal,
    ))).toMatchObject({ code: 'git-failed', message: 'nothing staged' })
    generateGitCommitMessage.mockRejectedValue(new Error('no model'))
    expect(expectErr(await api.host.gitSuggestCommit(
      request({ path: '/r', sessionId }),
      new AbortController().signal,
    ))).toMatchObject({ code: 'model-unavailable', message: 'no model' })
    generateGitCommitMessage.mockRejectedValue(new Error('late abort'))
    const late = new AbortController()
    late.abort()
    expect(expectErr(await api.host.gitSuggestCommit(
      request({ path: '/r', sessionId }),
      late.signal,
    )).code).toBe('cancelled')
  })

  it('refuses suggest-commit when no adapter serves the session model', async () => {
    const { api, ctx } = await harness()
    const sessionId = liveSession(ctx, 'git-s3')
    ctx.provide('llm', { listProviders: () => [] } as never)
    expect(expectErr(await api.host.gitSuggestCommit(
      request({ path: '/r', sessionId }),
      new AbortController().signal,
    )).code).toBe('model-unavailable')
  })
})
