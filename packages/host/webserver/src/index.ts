/**
 * @deepseek-ai/dsh-host-webserver — Web route-registration plugin: a node:http
 * server plus the `webServer` service (HTTP and upgrade route registries,
 * index transform taps, and the single fallback seat for everything no route
 * claims). Knows no harness concepts and serves no files; the composing
 * application's frontend plugin owns dist serving through the fallback hook.
 * Web shape only — the composing application owns how the window loads the
 * same HTTP surface. This package never prints: the URL line belongs to the shell.
 */

import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse, Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Duplex } from 'node:stream'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

declare module '@deepseek-ai/cordis' {
  interface Context {
    webServer: WebServer
  }
}

/** Route match kind: 'exact' matches the pathname verbatim; 'prefix' p matches p and p/<anything>. */
export type WebRouteKind = 'exact' | 'prefix'

/** One named route registration. */
export interface WebRoute {
  kind: WebRouteKind
  /** Absolute pathname, no trailing slash. */
  path: string
  /** Owns the full response lifecycle (may hold the response open, e.g. SSE). */
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

/** One exact-path HTTP upgrade registration. */
export interface WebUpgradeRoute {
  /** Absolute pathname, no trailing slash. */
  path: string
  /** Owns protocol negotiation and the upgraded socket after dispatch. */
  handler: (req: IncomingMessage, socket: Duplex, head: Buffer) => void | Promise<void>
}

/** Whether a request-guard lets the request continue to named routes. */
export type WebGuardVerdict = 'allow' | 'deny'

/** Gateway config: the listen address. */
export interface Config {
  /** Listen host; the two supported values are loopback and all-interfaces. */
  host: '127.0.0.1' | '0.0.0.0'
  /** Listen port; zero requests an OS-assigned port. */
  port: number
  /**
   * Extra sequential ports to try after an EADDRINUSE on {@link port}.
   * Zero (the default) keeps the fail-loud activation used by `dsh web`.
   * Ignored when {@link port} is 0 (the OS already picks a free port).
   */
  fallbackPorts?: number
}

/**
 * The browser HTTP carrier service. Activation listens immediately. Route
 * registration order does not affect requests because configured named routes
 * must be distinct, and the fallback handler answers anything not yet claimed
 * during startup with 404 until its owner registers. A listen failure rejects
 * initialization, and the boot process reports the failed fiber.
 */
export class WebServer extends Service {
  static Config: z<Config> = z.object({
    host: z.union([z.const('127.0.0.1'), z.const('0.0.0.0')]).required(),
    port: z.natural().max(65535).required(),
    fallbackPorts: z.natural().max(100).default(0),
  })

  private readonly exact = new Map<string, WebRoute>()
  private readonly prefixes = new Map<string, WebRoute>()
  private readonly upgrades = new Map<string, WebUpgradeRoute>()
  private readonly upgradedSockets = new Set<Duplex>()
  private readonly indexTaps: ((html: string) => string)[] = []
  private readonly guards = new Set<(req: IncomingMessage) => WebGuardVerdict>()
  private fallback: WebRoute['handler'] | undefined
  private unauthorized: WebRoute['handler'] | undefined
  private server!: Server
  private listenedPort!: number

  constructor(ctx: Context, private config: Config) {
    super(ctx, 'webServer')
  }

  /** The listening port (the OS-assigned value when config.port is 0). */
  get port(): number {
    return this.listenedPort
  }

  /** The configured bind host (the loopback or all-interfaces literal). */
  get host(): Config['host'] {
    return this.config.host
  }

  /**
   * Register a named route. Duplicate (kind, path) throws — route patterns are
   * a composition-level contract, so a collision is a misconfiguration.
   * @param route - kind, path, and the owning handler.
   * @returns the disposer removing the route.
   */
  register(route: WebRoute): () => void {
    const table = route.kind === 'exact' ? this.exact : this.prefixes
    if (table.has(route.path)) {
      throw new Error(`webserver: duplicate ${route.kind} route "${route.path}"`)
    }
    table.set(route.path, route)
    return () => { table.delete(route.path) }
  }

  /**
   * Register an exact-path HTTP upgrade route. Duplicate paths throw because
   * one socket can have only one protocol owner.
   * @param route - pathname and handler owning negotiation plus socket use.
   * @returns the disposer removing the route.
   */
  registerUpgrade(route: WebUpgradeRoute): () => void {
    if (this.upgrades.has(route.path)) {
      throw new Error(`webserver: duplicate upgrade route "${route.path}"`)
    }
    this.upgrades.set(route.path, route)
    return () => { this.upgrades.delete(route.path) }
  }

  /**
   * Claim the fallback seat: the handler answering every request no named
   * route matches (the SPA dist server in the shipped Web composition). One
   * owner only — a second registration throws, because two fallbacks cannot
   * compose.
   * @param handler - owns the full response lifecycle of unmatched requests.
   * @returns the disposer releasing the seat.
   */
  registerFallback(handler: WebRoute['handler']): () => void {
    if (this.fallback !== undefined) {
      throw new Error('webserver: fallback already registered')
    }
    this.fallback = handler
    return () => { this.fallback = undefined }
  }

  /**
   * Register a request guard. Every guard runs before named routes and the
   * fallback; any `deny` answers through {@link setUnauthorizedHandler}
   * (default 401) and also closes unmatched upgrades.
   * @param guard - allow/deny decision for one request.
   * @returns the disposer removing the guard.
   */
  registerGuard(guard: (req: IncomingMessage) => WebGuardVerdict): () => void {
    this.guards.add(guard)
    return () => { this.guards.delete(guard) }
  }

  /**
   * Claim the unauthorized-response seat used when a guard returns `deny`.
   * One owner only — a second registration throws.
   * @param handler - owns the 401 (or login-page) response.
   * @returns the disposer releasing the seat (default 401 text/plain returns).
   */
  setUnauthorizedHandler(handler: WebRoute['handler']): () => void {
    if (this.unauthorized !== undefined) {
      throw new Error('webserver: unauthorized handler already registered')
    }
    this.unauthorized = handler
    return () => { this.unauthorized = undefined }
  }

  /**
   * Bind `{host, port}` first, then close the previous listener. A failed
   * bind leaves the old listen in place and throws.
   * @param next - the new listen address.
   */
  async rebind(next: Config): Promise<void> {
    const previousServer = this.server
    const previousPort = this.listenedPort
    const previousConfig = this.config
    const previousUpgraded = [...this.upgradedSockets]
    this.config = { ...next }
    this.upgradedSockets.clear()
    try {
      await this.openListen()
    } catch (error) {
      this.server = previousServer
      this.listenedPort = previousPort
      this.config = previousConfig
      for (const socket of previousUpgraded) this.upgradedSockets.add(socket)
      throw error
    }
    await this.shutdownServer(previousServer, previousUpgraded)
  }

  /**
   * Register an index.html transform, applied by the fallback owner to every
   * index response ({@link applyIndexTaps}) in registration order.
   * @param transform - pure html-to-html function.
   * @returns the disposer removing the transform.
   */
  tapIndex(transform: (html: string) => string): () => void {
    this.indexTaps.push(transform)
    return () => {
      const at = this.indexTaps.indexOf(transform)
      if (at !== -1) this.indexTaps.splice(at, 1)
    }
  }

  /** Listen; resolves once the socket is bound (rejection = FAILED fiber). */
  async [Service.init](): Promise<void> {
    await this.openListen()
    this.ctx.effect(() => async () => {
      await this.closeListen()
    }, 'webServer.listen')
  }

  private denied(req: IncomingMessage): boolean {
    for (const guard of this.guards) {
      if (guard(req) === 'deny') return true
    }
    return false
  }

  private async answerUnauthorized(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const handler = this.unauthorized
    if (handler !== undefined) {
      await handler(req, res)
      return
    }
    res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('unauthorized')
  }

  private async openListen(): Promise<void> {
    const preferred = this.config.port
    const extras = preferred === 0 ? 0 : (this.config.fallbackPorts ?? 0)
    const attempts = 1 + extras
    let lastError: unknown
    for (let i = 0; i < attempts; i++) {
      const port = preferred === 0 ? 0 : preferred + i
      this.server = this.createHttpServer()
      try {
        await this.listenOn(port)
        return
      } catch (error) {
        lastError = error
        await closeUnusedServer(this.server)
        if (!isAddrInUse(error) || i === attempts - 1) throw error
      }
    }
    /* v8 ignore next -- the loop always returns or throws on the last attempt. */
    throw lastError
  }

  private createHttpServer(): Server {
    const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      if (this.denied(req)) {
        await this.answerUnauthorized(req, res)
        return
      }
      /* v8 ignore next -- `?? '/'` arm: node:http always sets url on server
      requests; the field is only optional on the client-side IncomingMessage type */
      const rawPath = new URL(req.url ?? '/', 'http://x').pathname
      const route = this.match(rawPath)
      if (route !== undefined) {
        await route.handler(req, res)
        return
      }
      const fallback = this.fallback
      if (fallback === undefined) {
        res.writeHead(404)
        res.end()
        return
      }
      await fallback(req, res)
    }
    // Last-resort guard: handle() rejecting would otherwise be an unhandled
    // rejection killing the process on one malformed request (bad %-escape,
    // client dropping mid-body). Per-request failures log and answer 400 —
    // never a process exit.
    const server = createServer((req, res) => {
      handle(req, res).catch((err: unknown) => {
        this.ctx.logger.warn(err instanceof Error ? err : new Error(String(err)))
        if (res.headersSent) {
          res.destroy()
          return
        }
        res.writeHead(400)
        res.end()
      })
    })
    server.on('upgrade', (req, socket, head) => {
      const onError = (error: Error): void => {
        this.ctx.logger.warn(error)
        socket.destroy()
      }
      socket.on('error', onError)
      socket.once('close', () => {
        socket.off('error', onError)
        this.upgradedSockets.delete(socket)
      })
      if (this.denied(req)) {
        socket.destroy()
        return
      }
      let route: WebUpgradeRoute | undefined
      try {
        /* v8 ignore next -- node:http always sets url on server requests. */
        route = this.upgrades.get(new URL(req.url ?? '/', 'http://x').pathname)
      } catch (error) {
        this.ctx.logger.warn(error instanceof Error ? error : new Error(String(error)))
        socket.destroy()
        return
      }
      if (route === undefined) {
        socket.destroy()
        return
      }
      this.upgradedSockets.add(socket)
      try {
        Promise.resolve(route.handler(req, socket, head)).catch((error: unknown) => {
          this.ctx.logger.warn(error instanceof Error ? error : new Error(String(error)))
          socket.destroy()
        })
      } catch (error) {
        this.ctx.logger.warn(error instanceof Error ? error : new Error(String(error)))
        socket.destroy()
      }
    })
    return server
  }

  private listenOn(port: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(port, this.config.host, () => {
        this.server.off('error', reject)
        this.server.on('error', (err) => { this.ctx.logger.error(err) })
        this.listenedPort = (this.server.address() as AddressInfo).port
        resolve()
      })
    })
  }

  private async closeListen(): Promise<void> {
    await this.shutdownServer(this.server, [...this.upgradedSockets])
    this.upgradedSockets.clear()
  }

  private async shutdownServer(server: Server, upgraded: readonly Duplex[]): Promise<void> {
    /* v8 ignore next -- shutdown runs after openListen assigned the server. */
    if (server === undefined) return
    const serverClosed = new Promise<void>((resolve) => {
      server.close(() => { resolve() })
    })
    server.closeAllConnections()
    const upgradedClosed = upgraded.map(socket => new Promise<void>((resolve) => {
      socket.once('close', () => { resolve() })
      socket.destroy()
    }))
    await Promise.all([serverClosed, ...upgradedClosed])
  }

  /** Longest-prefix-wins over the prefix table after an exact-table miss. */
  private match(pathname: string): WebRoute | undefined {
    const exact = this.exact.get(pathname)
    if (exact !== undefined) return exact
    let best: WebRoute | undefined
    for (const [prefix, route] of this.prefixes) {
      if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) continue
      if (best === undefined || prefix.length > best.path.length) best = route
    }
    return best
  }

  /**
   * Run an index.html body through the registered taps in registration order
   * — called by the fallback owner on every index response it renders.
   * @param html - the raw index.html body.
   * @returns the transformed body.
   */
  applyIndexTaps(html: string): string {
    let out = html
    for (const transform of this.indexTaps) out = transform(out)
    return out
  }
}

function isAddrInUse(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'EADDRINUSE'
}

function closeUnusedServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => { resolve() })
  })
}

export default WebServer
