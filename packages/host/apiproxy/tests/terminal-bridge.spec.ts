/**
 * host.terminal* bind: unavailable, quota, send drain, abort, and error mapping.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { RpcRequest, RpcResponse } from '../src/api/rpc.ts'
import { RpcId } from '../src/api/rpc.ts'
import {
  bindTerminalHost, UI_TERMINAL_LIMIT, type TerminalAgentFor, type TerminalServiceFace,
} from '../src/terminal-bridge.ts'

let nextRpc = 1

function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`pty-${String(nextRpc++)}`), payload }
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

function agent(cwd?: string, terminals?: TerminalServiceFace): Agent {
  return {
    session: { header: { cwd } },
    ctx: { get: (name: string) => name === 'terminals' ? terminals : undefined },
  } as Agent
}

function face(overrides: Partial<TerminalServiceFace> = {}): TerminalServiceFace {
  return {
    listBackends: () => ['shell'],
    list: () => [],
    spawn: async () => ({ sessionId: 'pty-1', motd: 'ready\n', status: { kind: 'running' } }),
    startSend: () => ({
      done: Promise.resolve({
        viewport: 'out',
        waitReason: 'inferred_idle',
        sessionStatus: { kind: 'running' as const },
        truncated: false,
      }),
      readOutput: () => ({ delta: '', truncated: false }),
    }),
    write: async () => {},
    resize: () => {},
    subscribeOutput: (_owner, _id, _listener) => () => {},
    read: () => ({ text: 'scroll' }),
    signal: async () => ({ delivered: true as const }),
    kill: async () => true,
    ...overrides,
  }
}

function bind(
  terminals: TerminalServiceFace | undefined,
  agentFor?: TerminalAgentFor,
) {
  const emit = vi.fn()
  const ctx = { emit } as unknown as Context
  const resolved: TerminalAgentFor = agentFor ?? (async () => ({ agent: agent('/ws', terminals) }))
  return { host: bindTerminalHost(ctx, resolved), emit }
}

describe('bindTerminalHost', () => {
  it('lists unavailable when terminals are not mounted', async () => {
    const { host } = bind(undefined)
    expect(expectOk(await host.terminalList(request({ sessionId: 's1' }))))
      .toEqual({ available: false, sessions: [] })
    expect(expectErr(await host.terminalOpen(request({ sessionId: 's1' }), new AbortController().signal)).code)
      .toBe('internal')
    expect(expectErr(await host.terminalSend(
      request({ sessionId: 's1', id: 'pty-1', text: 'ls', submit: true }),
      new AbortController().signal,
    )).code).toBe('internal')
    expect(expectErr(await host.terminalRead(request({ sessionId: 's1', id: 'pty-1' }))).code).toBe('internal')
    expect(expectErr(await host.terminalSignal(request({ sessionId: 's1', id: 'pty-1', signal: 'SIGINT' }))).code)
      .toBe('internal')
    expect(expectErr(await host.terminalKill(request({ sessionId: 's1', id: 'pty-1' }))).code).toBe('internal')
  })

  it('forwards agent lookup failures', async () => {
    const { host } = bind(face(), async () => ({
      error: {
        code: 'session-not-found',
        message: 'gone',
        details: { sessionId: 's1' as SessionId },
      },
    }))
    expect(expectErr(await host.terminalList(request({ sessionId: 's1' }))).code).toBe('session-not-found')
    expect(expectErr(await host.terminalOpen(request({ sessionId: 's1' }), new AbortController().signal)).code)
      .toBe('session-not-found')
    expect(expectErr(await host.terminalSend(
      request({ sessionId: 's1', id: 'pty-1', text: '', submit: true }),
      new AbortController().signal,
    )).code).toBe('session-not-found')
    expect(expectErr(await host.terminalRead(request({ sessionId: 's1', id: 'pty-1' }))).code).toBe('session-not-found')
    expect(expectErr(await host.terminalSignal(request({ sessionId: 's1', id: 'pty-1', signal: 'SIGINT' }))).code)
      .toBe('session-not-found')
    expect(expectErr(await host.terminalKill(request({ sessionId: 's1', id: 'pty-1' }))).code).toBe('session-not-found')
  })

  it('lists published sessions and opens one with name and cwd', async () => {
    const terminals = face({
      list: () => [{
        sessionId: 'pty-9',
        name: 'old',
        status: { kind: 'exited', exitCode: 1, signal: null },
      }],
      spawn: async (_agent, spec) => {
        expect(spec).toEqual({ type: 'shell', name: 'term-1', cwd: '/explorer', waitReady: false })
        return { sessionId: 'pty-2', name: 'term-1', motd: 'hi', status: { kind: 'running' } }
      },
    })
    const { host } = bind(terminals)
    expect(expectOk(await host.terminalList(request({ sessionId: 's1' })))).toEqual({
      available: true,
      sessions: [{ id: 'pty-9', name: 'old', status: { kind: 'exited', exitCode: 1, signal: null } }],
    })
    expect(expectOk(await host.terminalOpen(
      request({ sessionId: 's1', name: 'term-1', cwd: '/explorer' }),
      new AbortController().signal,
    ))).toEqual({ id: 'pty-2', name: 'term-1', motd: 'hi', status: { kind: 'running' } })
  })

  it('falls back to the session header cwd when the request omits cwd', async () => {
    const terminals = face({
      spawn: async (_agent, spec) => {
        expect(spec).toEqual({ type: 'shell', cwd: '/ws', waitReady: false })
        return { sessionId: 'pty-3', motd: '', status: { kind: 'running' } }
      },
    })
    const { host } = bind(terminals)
    expect(expectOk(await host.terminalOpen(request({ sessionId: 's1' }), new AbortController().signal)).id)
      .toBe('pty-3')
  })

  it('opens without cwd or name and refuses a missing backend or a full quota', async () => {
    const { host: empty } = bind(face({ listBackends: () => [] }))
    expect(expectErr(await empty.terminalOpen(request({ sessionId: 's1' }), new AbortController().signal)).message)
      .toContain('no PTY backend')
    const full = face({
      list: () => Array.from({ length: UI_TERMINAL_LIMIT }, (_, i) => ({
        sessionId: `pty-${String(i)}`,
        status: { kind: 'running' as const },
      })),
    })
    const { host } = bind(full, async () => ({ agent: agent(undefined, full) }))
    expect(expectErr(await host.terminalOpen(request({ sessionId: 's1' }), new AbortController().signal)).message)
      .toContain('at most')
    const first = face({ listBackends: () => ['other'] })
    const { host: other } = bind(first, async () => ({ agent: agent(undefined, first) }))
    expect(expectOk(await other.terminalOpen(request({ sessionId: 's1' }), new AbortController().signal)).id)
      .toBe('pty-1')
  })

  it('maps spawn abort and other spawn failures', async () => {
    const aborted = new AbortController()
    aborted.abort()
    const { host } = bind(face())
    expect(expectErr(await host.terminalOpen(request({ sessionId: 's1' }), aborted.signal)).code).toBe('cancelled')
    const { host: boom } = bind(face({
      spawn: async () => {
        throw Object.assign(new Error('nope'), { name: 'AbortError' })
      },
    }))
    expect(expectErr(await boom.terminalOpen(request({ sessionId: 's1' }), new AbortController().signal)).code)
      .toBe('cancelled')
    const { host: fail } = bind(face({ spawn: async () => { throw new Error('spawn failed') } }))
    expect(expectErr(await fail.terminalOpen(request({ sessionId: 's1' }), new AbortController().signal)).message)
      .toBe('spawn failed')
    const { host: raw } = bind(face({ spawn: async () => { throw 'raw' } }))
    expect(expectErr(await raw.terminalOpen(request({ sessionId: 's1' }), new AbortController().signal)).message)
      .toBe('raw')
  })

  it('subscribes raw output on open and forwards terminals/output', async () => {
    const listeners: Array<(delta: string) => void> = []
    const { host, emit } = bind(face({
      subscribeOutput: (_owner, id, listener) => {
        expect(id).toBe('pty-1')
        listeners.push(listener)
        return () => {}
      },
    }))
    expectOk(await host.terminalOpen(request({ sessionId: 's1' }), new AbortController().signal))
    expect(listeners).toHaveLength(1)
    listeners[0]!('chunk')
    expect(emit).toHaveBeenCalledWith('terminals/output', {
      sessionId: 's1', ptyId: 'pty-1', delta: 'chunk', truncated: false,
    })
  })

  it('writes and resizes without taking the exclusive send slot', async () => {
    const writes: string[] = []
    const sizes: Array<[number, number]> = []
    const { host } = bind(face({
      write: async (_owner, id, data) => {
        expect(id).toBe('pty-1')
        writes.push(data)
      },
      resize: (_owner, id, cols, rows) => {
        expect(id).toBe('pty-1')
        sizes.push([cols, rows])
      },
    }))
    expectOk(await host.terminalWrite(request({ sessionId: 's1', id: 'pty-1', data: 'a' })))
    expectOk(await host.terminalResize(request({ sessionId: 's1', id: 'pty-1', cols: 120, rows: 40 })))
    expect(writes).toEqual(['a'])
    expect(sizes).toEqual([[120, 40]])
  })

  it('maps send abort, startSend throw, and a rejected done', async () => {
    const aborted = new AbortController()
    aborted.abort()
    const { host } = bind(face())
    expect(expectErr(await host.terminalSend(
      request({ sessionId: 's1', id: 'pty-1', text: 'x', submit: false }),
      aborted.signal,
    )).code).toBe('cancelled')
    const { host: startFail } = bind(face({
      startSend: () => { throw new Error('SEND_ACTIVE') },
    }))
    expect(expectErr(await startFail.terminalSend(
      request({ sessionId: 's1', id: 'pty-1', text: 'x', submit: true }),
      new AbortController().signal,
    )).message).toBe('SEND_ACTIVE')
    const { host: abortDone } = bind(face({
      startSend: () => ({
        done: Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
        readOutput: () => ({ delta: '', truncated: false }),
      }),
    }))
    expect(expectErr(await abortDone.terminalSend(
      request({ sessionId: 's1', id: 'pty-1', text: 'x', submit: true }),
      new AbortController().signal,
    )).code).toBe('cancelled')
    const { host: failDone } = bind(face({
      startSend: () => ({
        done: Promise.reject(new Error('broken')),
        readOutput: () => ({ delta: '', truncated: false }),
      }),
    }))
    expect(expectErr(await failDone.terminalSend(
      request({ sessionId: 's1', id: 'pty-1', text: 'x', submit: true }),
      new AbortController().signal,
    )).message).toBe('broken')
  })

  it('returns an immediate send without requiring poll emits', async () => {
    const { host, emit } = bind(face({
      startSend: () => ({
        done: Promise.resolve({
          viewport: '',
          waitReason: 'session_exit',
          sessionStatus: { kind: 'exited', exitCode: 0, signal: null },
          truncated: false,
        }),
        readOutput: () => ({ delta: '', truncated: false }),
      }),
    }))
    expect(expectOk(await host.terminalSend(
      request({ sessionId: 's1', id: 'pty-1', text: '', submit: true }),
      new AbortController().signal,
    ))).toEqual({
      viewport: '',
      waitReason: 'session_exit',
      truncated: false,
      status: { kind: 'exited', exitCode: 0, signal: null },
    })
    expect(emit).not.toHaveBeenCalled()
  })

  it('reads, signals, and kills, mapping thrown failures', async () => {
    const { host } = bind(face({
      read: () => ({ text: 'back' }),
      kill: async () => false,
    }))
    expect(expectOk(await host.terminalRead(request({ sessionId: 's1', id: 'pty-1' })))).toEqual({ text: 'back' })
    expect(expectOk(await host.terminalSignal(request({ sessionId: 's1', id: 'pty-1', signal: 'SIGINT' }))))
      .toEqual({ delivered: true })
    expect(expectOk(await host.terminalKill(request({ sessionId: 's1', id: 'pty-1' })))).toEqual({ closed: false })
    const { host: boom } = bind(face({
      read: () => { throw new Error('no session') },
      signal: async () => { throw 'sig' },
      kill: async () => { throw new Error('busy') },
    }))
    expect(expectErr(await boom.terminalRead(request({ sessionId: 's1', id: 'pty-1' }))).message).toBe('no session')
    expect(expectErr(await boom.terminalSignal(request({ sessionId: 's1', id: 'pty-1', signal: 'SIGTERM' }))).message)
      .toBe('sig')
    expect(expectErr(await boom.terminalKill(request({ sessionId: 's1', id: 'pty-1' }))).message).toBe('busy')
  })

  it('resolves isolate terminals through agentPresets.serviceFor', async () => {
    const terminals = face({
      spawn: async () => ({ sessionId: 'pty-iso', motd: 'iso\n', status: { kind: 'running' } }),
    })
    const serviceFor = vi.fn(() => terminals)
    const emit = vi.fn()
    const ctx = {
      emit,
      get: (name: string) => name === 'agentPresets' ? { serviceFor } : undefined,
    } as unknown as Context
    const owner = agent('/ws', undefined)
    const host = bindTerminalHost(ctx, async () => ({ agent: owner }))
    expect(expectOk(await host.terminalList(request({ sessionId: 's1' }))).available).toBe(true)
    expect(serviceFor).toHaveBeenCalledWith(owner, 'terminals')
    expect(expectOk(await host.terminalOpen(request({ sessionId: 's1' }), new AbortController().signal)).id)
      .toBe('pty-iso')
  })
})
