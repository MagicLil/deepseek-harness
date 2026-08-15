import { describe, expect, it, vi } from 'vitest'
import {
  TerminalAccessError, hostTerminalsOf, interruptTerminal, killTerminal, listTerminals,
  openTerminal, readTerminal, sendTerminal, subscribeTerminalOutput,
  type HostTerminalMethods,
} from '../src/client/terminal-client.ts'

function ok<T>(value: T) {
  return Promise.resolve({ result: { ok: true as const, value } })
}

function fail(code: string, message: string) {
  return Promise.resolve({ result: { ok: false as const, error: { code, message } } })
}

describe('terminal-client', () => {
  it('reads an empty host bag from a missing connection', () => {
    expect(hostTerminalsOf(null)).toEqual({})
    expect(hostTerminalsOf({})).toEqual({})
    expect(hostTerminalsOf({ api: {} })).toEqual({})
    const host = { terminalList: vi.fn() }
    expect(hostTerminalsOf({ api: { host } })).toBe(host)
  })

  it('treats missing methods as unavailable and ignores optional verbs', async () => {
    const host: HostTerminalMethods = {}
    expect(await listTerminals(host, 's1')).toEqual({ available: false, sessions: [] })
    await expect(openTerminal(host, 's1')).rejects.toBeInstanceOf(TerminalAccessError)
    await expect(sendTerminal(host, 's1', 'pty-1', 'ls', true)).rejects.toBeInstanceOf(TerminalAccessError)
    expect(await readTerminal(host, 's1', 'pty-1')).toBe('')
    await interruptTerminal(host, 's1', 'pty-1')
    await killTerminal(host, 's1', 'pty-1')
    expect(subscribeTerminalOutput(null, () => {})()).toBeUndefined()
    expect(subscribeTerminalOutput({}, () => {})()).toBeUndefined()
  })

  it('unwraps host.terminal* success and error branches', async () => {
    const host: HostTerminalMethods = {
      terminalList: vi.fn(() => ok({ available: true, sessions: [] })),
      terminalOpen: vi.fn(() => ok({
        id: 'pty-1', name: 't', motd: 'hi', status: { kind: 'running' as const },
      })),
      terminalSend: vi.fn(() => ok({
        viewport: 'out', waitReason: 'inferred_idle', truncated: false, status: { kind: 'running' as const },
      })),
      terminalRead: vi.fn(() => ok({ text: 'back' })),
      terminalSignal: vi.fn(() => ok({ delivered: true })),
      terminalKill: vi.fn(() => ok({ closed: true })),
    }
    expect(await listTerminals(host, 's1')).toEqual({ available: true, sessions: [] })
    expect(await openTerminal(host, 's1', { name: 't', cwd: 'D:\\work\\hmdp' })).toMatchObject({ id: 'pty-1', motd: 'hi' })
    expect(host.terminalOpen).toHaveBeenCalledWith(
      { sessionId: 's1', name: 't', cwd: 'D:\\work\\hmdp' },
      undefined,
    )
    expect(await openTerminal(host, 's1')).toMatchObject({ id: 'pty-1' })
    expect(await sendTerminal(host, 's1', 'pty-1', 'ls', true)).toMatchObject({ viewport: 'out' })
    expect(await readTerminal(host, 's1', 'pty-1')).toBe('back')
    await interruptTerminal(host, 's1', 'pty-1')
    await killTerminal(host, 's1', 'pty-1')
    expect(host.terminalSignal).toHaveBeenCalledWith(
      { sessionId: 's1', id: 'pty-1', signal: 'SIGINT' },
      undefined,
    )
    const withWrite: HostTerminalMethods = {
      terminalWrite: vi.fn(() => ok({ written: true as const })),
      terminalResize: vi.fn(() => ok({ resized: true as const })),
    }
    const { writeTerminal, resizeTerminal } = await import('../src/client/terminal-client.ts')
    await writeTerminal(withWrite, 's1', 'pty-1', 'x')
    await resizeTerminal(withWrite, 's1', 'pty-1', 80, 24)
    expect(withWrite.terminalWrite).toHaveBeenCalledWith(
      { sessionId: 's1', id: 'pty-1', data: 'x' },
      undefined,
    )
    const bad: HostTerminalMethods = {
      terminalList: () => fail('internal', 'nope'),
    }
    await expect(listTerminals(bad, 's1')).rejects.toMatchObject({ code: 'internal', message: 'nope' })
  })

  it('subscribes to terminals/output when remote.$on exists', () => {
    const off = vi.fn()
    const on = vi.fn(function (this: { marker: string }, event: string, listener: unknown) {
      expect(this.marker).toBe('remote')
      expect(event).toBe('terminals/output')
      expect(listener).toBeTypeOf('function')
      return off
    })
    const remote = { marker: 'remote', $on: on }
    const listener = vi.fn()
    const dispose = subscribeTerminalOutput(remote, listener)
    expect(on).toHaveBeenCalledOnce()
    dispose()
    expect(off).toHaveBeenCalledOnce()
  })

  it('keeps the remote receiver so $on can read this.ctx', () => {
    const remote = {
      ctx: { effect: (fn: () => () => void) => { fn(); return Promise.resolve() } },
      $on(this: { ctx: { effect: (fn: () => () => void) => Promise<void> } }, _event: string) {
        this.ctx.effect(() => () => {})
        return () => {}
      },
    }
    expect(() => subscribeTerminalOutput(remote, () => {})).not.toThrow()
  })
})
