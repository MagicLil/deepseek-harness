/**
 * Thin client over `host.terminal*` plus `terminals/output`. Missing methods
 * mean the host has no PTY bridge; the UI shows the unavailable note.
 */

/** Top-level PTY status as the wire returns it. */
export type TerminalStatusWire =
  | { kind: 'running' }
  | { kind: 'exited'; exitCode: number | null; signal: string | null }

/** One listed PTY. */
export type TerminalListRow = {
  id: string
  name?: string
  status: TerminalStatusWire
}

/** Successful `host.terminalOpen` value. */
export type TerminalOpenValue = {
  id: string
  name?: string
  motd: string
  status: TerminalStatusWire
}

/** Successful `host.terminalSend` value. */
export type TerminalSendValue = {
  viewport: string
  waitReason: string
  truncated: boolean
  status: TerminalStatusWire
}

/** Output frame forwarded on `terminals/output`. */
export type TerminalOutputPayload = {
  sessionId: string
  ptyId: string
  delta: string
  truncated: boolean
}

type RpcResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } }
type RpcResponse<T> = { result: RpcResult<T> }

/** Duck-typed host.terminal* face (absent methods mean unavailable). */
export type HostTerminalMethods = {
  terminalList?: (
    payload: { sessionId: string },
    signal?: AbortSignal,
  ) => Promise<RpcResponse<{ available: boolean; sessions: TerminalListRow[] }>>
  terminalOpen?: (
    payload: { sessionId: string; name?: string; cwd?: string; cols?: number; rows?: number },
    signal?: AbortSignal,
  ) => Promise<RpcResponse<TerminalOpenValue>>
  terminalSend?: (
    payload: { sessionId: string; id: string; text: string; submit: boolean },
    signal?: AbortSignal,
  ) => Promise<RpcResponse<TerminalSendValue>>
  terminalWrite?: (
    payload: { sessionId: string; id: string; data: string },
    signal?: AbortSignal,
  ) => Promise<RpcResponse<{ written: true }>>
  terminalResize?: (
    payload: { sessionId: string; id: string; cols: number; rows: number },
    signal?: AbortSignal,
  ) => Promise<RpcResponse<{ resized: true }>>
  terminalRead?: (
    payload: { sessionId: string; id: string },
    signal?: AbortSignal,
  ) => Promise<RpcResponse<{ text: string }>>
  terminalSignal?: (
    payload: { sessionId: string; id: string; signal: string },
    signal?: AbortSignal,
  ) => Promise<RpcResponse<{ delivered: boolean }>>
  terminalKill?: (
    payload: { sessionId: string; id: string },
    signal?: AbortSignal,
  ) => Promise<RpcResponse<{ closed: boolean }>>
}

/** Structured terminal RPC failure. */
export class TerminalAccessError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'TerminalAccessError'
  }
}

/**
 * Pull the host.terminal* bag off a connection handle, if present.
 * @param connection - `ctx.connection` or a test double.
 * @returns the host methods object (possibly empty).
 */
export function hostTerminalsOf(connection: unknown): HostTerminalMethods {
  if (connection === null || typeof connection !== 'object') return {}
  const api = (connection as { api?: { host?: HostTerminalMethods } }).api
  return api?.host ?? {}
}

/**
 * Subscribe to forwarded `terminals/output` frames.
 * @param remote - `ctx.remote` or a test double.
 * @param listener - called with each payload object.
 * @returns unsubscribe.
 */
export function subscribeTerminalOutput(
  remote: unknown,
  listener: (payload: TerminalOutputPayload) => void,
): () => void {
  if (remote === null || typeof remote !== 'object') return () => {}
  const handle = remote as {
    $on?: (name: string, fn: (payload: TerminalOutputPayload) => void) => () => void
  }
  // Must keep the receiver: `$on` reads `this.ctx` (api-gateway Remote service).
  if (handle.$on === undefined) return () => {}
  return handle.$on('terminals/output', listener)
}

async function unwrap<T>(response: Promise<RpcResponse<T>>): Promise<T> {
  const body = await response
  if (!body.result.ok) {
    throw new TerminalAccessError(body.result.error.code, body.result.error.message)
  }
  return body.result.value
}

/** In-flight named opens; React Strict Mode remounts must not spawn a second PTY. */
const inflightNamedOpens = new Map<string, Promise<TerminalOpenValue>>()

function namedOpenKey(sessionId: string, name: string): string {
  return `${sessionId}\0${name}`
}

/** Test-only: drop coalesced opens so specs start from an empty map. */
export function resetInflightTerminalOpens(): void {
  inflightNamedOpens.clear()
}

/**
 * List PTYs and whether the host mounted a backend.
 * @param host - duck-typed host methods.
 * @param sessionId - session whose agent owns the PTYs.
 * @param signal - optional abort.
 */
export async function listTerminals(
  host: HostTerminalMethods,
  sessionId: string,
  signal?: AbortSignal,
): Promise<{ available: boolean; sessions: TerminalListRow[] }> {
  if (host.terminalList === undefined) return { available: false, sessions: [] }
  return unwrap(host.terminalList({ sessionId }, signal))
}

/**
 * Spawn one UI PTY.
 * @param host - duck-typed host methods.
 * @param sessionId - owning session.
 * @param options - optional name, cwd, and initial size.
 * @param signal - optional abort.
 */
export async function openTerminal(
  host: HostTerminalMethods,
  sessionId: string,
  options?: { name?: string; cwd?: string; cols?: number; rows?: number },
  signal?: AbortSignal,
): Promise<TerminalOpenValue> {
  if (host.terminalOpen === undefined) {
    throw new TerminalAccessError('internal', 'terminal bridge is unavailable')
  }
  const name = options?.name
  const cwd = options?.cwd
  const cols = options?.cols
  const rows = options?.rows
  const key = name !== undefined && name !== '' ? namedOpenKey(sessionId, name) : undefined
  if (key !== undefined) {
    const inflight = inflightNamedOpens.get(key)
    if (inflight !== undefined) return inflight
  }
  const pending = unwrap(host.terminalOpen(
    {
      sessionId,
      ...name === undefined || name === '' ? {} : { name },
      ...cwd === undefined || cwd === '' ? {} : { cwd },
      ...cols === undefined ? {} : { cols },
      ...rows === undefined ? {} : { rows },
    },
    signal,
  )).finally(() => {
    if (key !== undefined && inflightNamedOpens.get(key) === pending) inflightNamedOpens.delete(key)
  })
  if (key !== undefined) inflightNamedOpens.set(key, pending)
  return pending
}

/**
 * Send one exclusive line-oriented write and wait for idle (agent / legacy).
 * @param host - duck-typed host methods.
 * @param sessionId - owning session.
 * @param id - host PTY id.
 * @param text - UTF-8 text.
 * @param submit - whether to write Enter after the text.
 * @param signal - optional abort.
 */
export async function sendTerminal(
  host: HostTerminalMethods,
  sessionId: string,
  id: string,
  text: string,
  submit: boolean,
  signal?: AbortSignal,
): Promise<TerminalSendValue> {
  if (host.terminalSend === undefined) {
    throw new TerminalAccessError('internal', 'terminal bridge is unavailable')
  }
  return unwrap(host.terminalSend({ sessionId, id, text, submit }, signal))
}

/**
 * Fire-and-forget stdin write (xterm onData).
 * @param host - duck-typed host methods.
 * @param sessionId - owning session.
 * @param id - host PTY id.
 * @param data - UTF-8 including control characters.
 * @param signal - optional abort.
 */
export async function writeTerminal(
  host: HostTerminalMethods,
  sessionId: string,
  id: string,
  data: string,
  signal?: AbortSignal,
): Promise<void> {
  if (host.terminalWrite === undefined) {
    throw new TerminalAccessError('internal', 'terminal raw write is unavailable')
  }
  await unwrap(host.terminalWrite({ sessionId, id, data }, signal))
}

/**
 * Resize the PTY winsize to match FitAddon.
 * @param host - duck-typed host methods.
 * @param sessionId - owning session.
 * @param id - host PTY id.
 * @param cols - columns.
 * @param rows - rows.
 * @param signal - optional abort.
 */
export async function resizeTerminal(
  host: HostTerminalMethods,
  sessionId: string,
  id: string,
  cols: number,
  rows: number,
  signal?: AbortSignal,
): Promise<void> {
  if (host.terminalResize === undefined) return
  await unwrap(host.terminalResize({ sessionId, id, cols, rows }, signal))
}

/**
 * Read retained scrollback for replay.
 * @param host - duck-typed host methods.
 * @param sessionId - owning session.
 * @param id - host PTY id.
 * @param signal - optional abort.
 */
export async function readTerminal(
  host: HostTerminalMethods,
  sessionId: string,
  id: string,
  signal?: AbortSignal,
): Promise<string> {
  if (host.terminalRead === undefined) return ''
  return (await unwrap(host.terminalRead({ sessionId, id }, signal))).text
}

/**
 * Deliver SIGINT to the foreground group.
 * @param host - duck-typed host methods.
 * @param sessionId - owning session.
 * @param id - host PTY id.
 * @param signal - optional abort.
 */
export async function interruptTerminal(
  host: HostTerminalMethods,
  sessionId: string,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  if (host.terminalSignal === undefined) return
  await unwrap(host.terminalSignal({ sessionId, id, signal: 'SIGINT' }, signal))
}

/**
 * Close one host PTY.
 * @param host - duck-typed host methods.
 * @param sessionId - owning session.
 * @param id - host PTY id.
 * @param signal - optional abort.
 */
export async function killTerminal(
  host: HostTerminalMethods,
  sessionId: string,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  if (host.terminalKill === undefined) return
  await unwrap(host.terminalKill({ sessionId, id }, signal))
}
