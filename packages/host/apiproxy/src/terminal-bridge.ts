/**
 * UI PTY verbs for the workbench terminal panel. Methods live here so
 * `createApiProxy` only spreads the bind; coverage stays on this file.
 * Isolate `terminals` is addressed via `agentPresets.serviceFor`.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ApiRemoteAgentResult, TerminalOutputPayload } from '@deepseek-ai/dsh-api-remotes'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type {
  HostApi, TerminalSessionStatusWire, TerminalWaitReason, TerminalWireSignal,
} from './api/host.ts'
import type { RpcError, RpcRequest, RpcResponse } from './api/rpc.ts'

/** Session-local UI PTY quota (same number the workbench tab strip enforces). */
export const UI_TERMINAL_LIMIT = 3

/** Duck-typed `ctx.terminals` face used by the UI bridge. */
export interface TerminalServiceFace {
  listBackends(): string[]
  list(owner: Agent): Array<{
    sessionId: string
    name?: string
    status: TerminalSessionStatusWire
  }>
  spawn(
    owner: Agent,
    request: {
      type: string
      name?: string
      cwd?: string
      cols?: number
      rows?: number
      waitReady?: boolean
    },
    signal?: AbortSignal,
  ): Promise<{
    sessionId: string
    name?: string
    motd: string
    status: TerminalSessionStatusWire
  }>
  startSend(
    owner: Agent,
    id: string,
    request: { text: string; submit: boolean; signal?: AbortSignal },
  ): {
    done: Promise<{
      viewport: string
      waitReason: TerminalWaitReason
      sessionStatus: TerminalSessionStatusWire
      truncated: boolean
    }>
    readOutput(): { delta: string; truncated: boolean }
  }
  write?(owner: Agent, id: string, data: string): Promise<void>
  resize?(owner: Agent, id: string, cols: number, rows: number): void
  subscribeOutput?(owner: Agent, id: string, listener: (delta: string) => void): () => void
  read(owner: Agent, id: string): { text: string }
  signal(owner: Agent, id: string, signal: TerminalWireSignal): Promise<{ delivered: true }>
  kill(owner: Agent, id: string, reason?: string): Promise<boolean>
}

/** Resolve a session identity the same way every other session-scoped RPC does. */
export type TerminalAgentFor = (sessionId: SessionId) => Promise<ApiRemoteAgentResult>

function ok<T>(request: RpcRequest<unknown>, value: T): RpcResponse<T> {
  return { rpcId: request.rpcId, result: { ok: true, value } }
}

function err<T>(request: RpcRequest<unknown>, error: RpcError): RpcResponse<T> {
  return { rpcId: request.rpcId, result: { ok: false, error } }
}

function unavailable(request: RpcRequest<unknown>): RpcResponse<never> {
  return err(request, {
    code: 'internal',
    message: 'terminal bridge is unavailable',
    details: {},
  })
}

function aborted(request: RpcRequest<unknown>): RpcResponse<never> {
  return err(request, { code: 'cancelled', message: 'terminal was aborted', details: {} })
}

function internal(request: RpcRequest<unknown>, error: unknown): RpcResponse<never> {
  return err(request, {
    code: 'internal',
    message: error instanceof Error ? error.message : String(error),
    details: {},
  })
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || (error instanceof Error && error.name === 'AbortError')
}

function wireStatus(status: TerminalSessionStatusWire): TerminalSessionStatusWire {
  if (status.kind === 'exited') {
    return { kind: 'exited', exitCode: status.exitCode, signal: status.signal }
  }
  return { kind: 'running' }
}

function terminalsOf(hostCtx: Context, owner: Agent): TerminalServiceFace | undefined {
  const presets = typeof hostCtx.get === 'function'
    ? hostCtx.get('agentPresets') as {
      serviceFor?: (agent: { ctx: Context }, name: 'terminals') => TerminalServiceFace | undefined
    } | undefined
    : undefined
  const isolated = presets?.serviceFor?.(owner, 'terminals')
  if (isolated !== undefined) return isolated
  try {
    return owner.ctx.get('terminals') as TerminalServiceFace | undefined
  } catch {
    return undefined
  }
}

function backendType(terminals: TerminalServiceFace): string | undefined {
  const backends = terminals.listBackends()
  return backends.includes('shell') ? 'shell' : backends[0]
}

function emitOutput(
  ctx: Context,
  sessionId: string,
  ptyId: string,
  delta: string,
  truncated: boolean,
): void {
  if (delta.length === 0 && !truncated) return
  const payload: TerminalOutputPayload = { sessionId, ptyId, delta, truncated }
  ctx.emit('terminals/output', payload)
}

/**
 * Bind `host.terminal*` methods onto one ApiProxy host object.
 * @param ctx - host context; used to emit `terminals/output`.
 * @param agentFor - session → exact Agent resolver.
 */
export function bindTerminalHost(ctx: Context, agentFor: TerminalAgentFor): Pick<
  HostApi,
  | 'terminalList'
  | 'terminalOpen'
  | 'terminalSend'
  | 'terminalWrite'
  | 'terminalResize'
  | 'terminalRead'
  | 'terminalSignal'
  | 'terminalKill'
> {
  /** Live raw-output watches keyed by sessionId + ptyId. */
  const watches = new Map<string, () => void>()

  const watchKey = (sessionId: string, ptyId: string): string => `${sessionId}\0${ptyId}`

  const ensureWatch = (
    terminals: TerminalServiceFace,
    owner: Agent,
    sessionId: string,
    ptyId: string,
  ): void => {
    const key = watchKey(sessionId, ptyId)
    if (watches.has(key)) return
    if (terminals.subscribeOutput === undefined) return
    const off = terminals.subscribeOutput(owner, ptyId, (delta) => {
      emitOutput(ctx, sessionId, ptyId, delta, false)
    })
    watches.set(key, off)
  }

  const dropWatch = (sessionId: string, ptyId: string): void => {
    const key = watchKey(sessionId, ptyId)
    const off = watches.get(key)
    if (off === undefined) return
    watches.delete(key)
    off()
  }

  const resolve = async (
    request: RpcRequest<{ sessionId: string }>,
  ): Promise<{ agent: Agent } | { error: RpcResponse<never> }> => {
    const found = await agentFor(request.payload.sessionId as SessionId)
    if ('error' in found) return { error: err(request, found.error) }
    return { agent: found.agent }
  }

  return {
    async terminalList(request) {
      const found = await resolve(request)
      if ('error' in found) return found.error
      const terminals = terminalsOf(ctx, found.agent)
      if (terminals === undefined) {
        return ok(request, { available: false, sessions: [] })
      }
      return ok(request, {
        available: true,
        sessions: terminals.list(found.agent).map(row => ({
          id: row.sessionId,
          ...row.name === undefined ? {} : { name: row.name },
          status: wireStatus(row.status),
        })),
      })
    },

    async terminalOpen(request, signal) {
      const found = await resolve(request)
      if ('error' in found) return found.error
      const terminals = terminalsOf(ctx, found.agent)
      if (terminals === undefined) return unavailable(request)
      if (signal.aborted) return aborted(request)
      const type = backendType(terminals)
      if (type === undefined) {
        return err(request, { code: 'internal', message: 'no PTY backend is registered', details: {} })
      }
      if (terminals.list(found.agent).length >= UI_TERMINAL_LIMIT) {
        return err(request, {
          code: 'internal',
          message: `at most ${String(UI_TERMINAL_LIMIT)} terminals per session`,
          details: {},
        })
      }
      const cwd = request.payload.cwd ?? found.agent.session.header.cwd
      const name = request.payload.name
      const cols = request.payload.cols
      const rows = request.payload.rows
      try {
        const spawned = await terminals.spawn(found.agent, {
          type,
          ...name === undefined ? {} : { name },
          ...cwd === undefined || cwd === '' ? {} : { cwd },
          ...cols === undefined ? {} : { cols },
          ...rows === undefined ? {} : { rows },
          waitReady: false,
        }, signal)
        ensureWatch(terminals, found.agent, request.payload.sessionId, spawned.sessionId)
        const motd = spawned.motd !== ''
          ? spawned.motd
          : terminals.read(found.agent, spawned.sessionId).text
        return ok(request, {
          id: spawned.sessionId,
          ...spawned.name === undefined ? {} : { name: spawned.name },
          motd,
          status: wireStatus(spawned.status),
        })
      } catch (error: unknown) {
        if (isAbort(error, signal)) return aborted(request)
        return internal(request, error)
      }
    },

    async terminalSend(request, signal) {
      const found = await resolve(request)
      if ('error' in found) return found.error
      const terminals = terminalsOf(ctx, found.agent)
      if (terminals === undefined) return unavailable(request)
      if (signal.aborted) return aborted(request)
      ensureWatch(terminals, found.agent, request.payload.sessionId, request.payload.id)
      let operation: ReturnType<TerminalServiceFace['startSend']>
      try {
        operation = terminals.startSend(found.agent, request.payload.id, {
          text: request.payload.text,
          submit: request.payload.submit,
          signal,
        })
      } catch (error: unknown) {
        return internal(request, error)
      }
      try {
        const result = await operation.done
        // Drain any leftover exclusive-send buffer (subscribe may already have forwarded raw).
        operation.readOutput()
        return ok(request, {
          viewport: result.viewport,
          waitReason: result.waitReason,
          truncated: result.truncated,
          status: wireStatus(result.sessionStatus),
        })
      } catch (error: unknown) {
        if (isAbort(error, signal)) return aborted(request)
        return internal(request, error)
      }
    },

    async terminalWrite(request) {
      const found = await resolve(request)
      if ('error' in found) return found.error
      const terminals = terminalsOf(ctx, found.agent)
      if (terminals === undefined) return unavailable(request)
      if (terminals.write === undefined) {
        return err(request, {
          code: 'internal',
          message: 'terminal raw write is unavailable',
          details: {},
        })
      }
      ensureWatch(terminals, found.agent, request.payload.sessionId, request.payload.id)
      try {
        await terminals.write(found.agent, request.payload.id, request.payload.data)
        return ok(request, { written: true as const })
      } catch (error: unknown) {
        return internal(request, error)
      }
    },

    async terminalResize(request) {
      const found = await resolve(request)
      if ('error' in found) return found.error
      const terminals = terminalsOf(ctx, found.agent)
      if (terminals === undefined) return unavailable(request)
      if (terminals.resize === undefined) {
        return err(request, {
          code: 'internal',
          message: 'terminal resize is unavailable',
          details: {},
        })
      }
      try {
        terminals.resize(
          found.agent,
          request.payload.id,
          request.payload.cols,
          request.payload.rows,
        )
        return ok(request, { resized: true as const })
      } catch (error: unknown) {
        return internal(request, error)
      }
    },

    async terminalRead(request) {
      const found = await resolve(request)
      if ('error' in found) return found.error
      const terminals = terminalsOf(ctx, found.agent)
      if (terminals === undefined) return unavailable(request)
      ensureWatch(terminals, found.agent, request.payload.sessionId, request.payload.id)
      try {
        return ok(request, { text: terminals.read(found.agent, request.payload.id).text })
      } catch (error: unknown) {
        return internal(request, error)
      }
    },

    async terminalSignal(request) {
      const found = await resolve(request)
      if ('error' in found) return found.error
      const terminals = terminalsOf(ctx, found.agent)
      if (terminals === undefined) return unavailable(request)
      try {
        await terminals.signal(found.agent, request.payload.id, request.payload.signal)
        return ok(request, { delivered: true })
      } catch (error: unknown) {
        return internal(request, error)
      }
    },

    async terminalKill(request) {
      const found = await resolve(request)
      if ('error' in found) return found.error
      const terminals = terminalsOf(ctx, found.agent)
      if (terminals === undefined) return unavailable(request)
      dropWatch(request.payload.sessionId, request.payload.id)
      try {
        return ok(request, { closed: await terminals.kill(found.agent, request.payload.id, 'ui close') })
      } catch (error: unknown) {
        return internal(request, error)
      }
    },
  }
}
