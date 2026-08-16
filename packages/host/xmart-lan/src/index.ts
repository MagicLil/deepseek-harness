/** Host Remote for the desktop LAN token gate. */

import { networkInterfaces } from 'node:os'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { guardVerdict } from './guard.ts'
import { listLanIpv4 } from './lan-address.ts'
import { loginPageHtml, loginSetCookie } from './login-page.ts'
import { loadPersist, savePersist } from './store.ts'
import { createToken, tokensEqual } from './token.ts'
import type { Config, LanPersist, LanStatus, SetEnabledRequest, SetPortRequest } from './types.ts'

export type * from './types.ts'
export { COOKIE_NAME } from './token.ts'
export { guardVerdict } from './guard.ts'
export { isLoopbackHost, readHostName } from './loopback.ts'
export { createToken, tokenFromRequest, tokensEqual } from './token.ts'
export { loginPageHtml, loginSetCookie } from './login-page.ts'
export { listLanIpv4 } from './lan-address.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    xmartLan: XmartLanService
  }
}

/** Stable Cordis plugin name. */
export const name = 'xmart-lan'

/** WebServer must already be listening before this plugin rebinds it. */
export const inject = ['webServer']

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

function formToken(body: string): string | undefined {
  const token = new URLSearchParams(body).get('token')
  return token === null || token.length === 0 ? undefined : token
}

function bindMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function requestPath(req: IncomingMessage): string {
  const url = req.url ?? ''
  const q = url.indexOf('?')
  return q === -1 ? url : url.slice(0, q)
}

/** LAN gate + live `trustedHosts` for the /api fence. */
export class XmartLanService extends TypertRemoteService {
  /** LAN IPv4 authorities when the switch is on; empty when off. */
  trustedHosts: readonly string[] = []
  /** Last bind failure shown in Settings. */
  bindError: string | null = null
  private persist: LanPersist
  private readonly dshHome: string | undefined
  private readonly interfaces: NonNullable<Config['interfaces']>
  private ready: Promise<void>

  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'xmartLan')
    this.dshHome = config.dshHome
    this.interfaces = config.interfaces ?? networkInterfaces
    this.persist = { enabled: false, port: 3080, token: createToken() }
    this.ready = this.boot()
    ctx.effect(() => ctx.webServer.registerGuard(req => this.verdict(req)), 'xmart-lan: guard')
    ctx.effect(() => ctx.webServer.setUnauthorizedHandler((req, res) => {
      void req
      res.writeHead(401, { 'content-type': 'text/html; charset=utf-8' })
      res.end(loginPageHtml())
    }), 'xmart-lan: login page')
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: '/xmart-lan/login',
      handler: (req, res) => this.handleLogin(req, res),
    }), 'xmart-lan: login route')
  }

  private async boot(): Promise<void> {
    this.persist = await loadPersist(this.dshHome)
    this.refreshTrust()
    if (!this.persist.enabled) return
    try {
      await this.ctx.webServer.rebind({ host: '0.0.0.0', port: this.persist.port })
      this.bindError = null
    } catch (error) {
      this.persist.enabled = false
      this.bindError = bindMessage(error)
      this.refreshTrust()
      await savePersist(this.persist, this.dshHome)
    }
  }

  private refreshTrust(): void {
    this.trustedHosts = this.persist.enabled ? listLanIpv4(this.interfaces()) : []
  }

  private verdict(req: IncomingMessage): 'allow' | 'deny' {
    if (requestPath(req) === '/xmart-lan/login' && req.method === 'POST') return 'allow'
    return guardVerdict({
      enabled: this.persist.enabled,
      token: this.persist.token,
      hostHeader: typeof req.headers.host === 'string' ? req.headers.host : undefined,
      ...(typeof req.headers.cookie === 'string' ? { cookie: req.headers.cookie } : {}),
      ...(typeof req.headers['x-xmart-lan-token'] === 'string'
        ? { xToken: req.headers['x-xmart-lan-token'] }
        : {}),
    })
  }

  private async handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405)
      res.end()
      return
    }
    const presented = formToken(await readBody(req))
    if (
      presented !== undefined
      && this.persist.token.length > 0
      && tokensEqual(presented, this.persist.token)
    ) {
      res.writeHead(302, { location: '/', 'set-cookie': loginSetCookie(this.persist.token) })
      res.end()
      return
    }
    res.writeHead(401, { 'content-type': 'text/html; charset=utf-8' })
    res.end(loginPageHtml())
  }

  private snapshot(): LanStatus {
    const port = this.persist.port
    const lan = this.trustedHosts[0]
    return {
      enabled: this.persist.enabled,
      port,
      loopbackUrl: `http://127.0.0.1:${String(port)}/`,
      lanUrl: this.persist.enabled && lan !== undefined ? `http://${lan}:${String(port)}/` : null,
      token: this.persist.token,
      bindError: this.bindError,
    }
  }

  /**
   * Current switch, URLs, and token.
   */
  @Remote('status')
  async status(): Promise<LanStatus> {
    await this.ready
    return this.snapshot()
  }

  /**
   * Open or close the LAN listener in-process.
   * @param request - desired switch.
   */
  @Remote('setEnabled')
  async setEnabled(request: SetEnabledRequest): Promise<LanStatus> {
    await this.ready
    if (request.enabled) {
      try {
        await this.ctx.webServer.rebind({ host: '0.0.0.0', port: this.persist.port })
        this.persist.enabled = true
        this.bindError = null
      } catch (error) {
        this.persist.enabled = false
        this.bindError = bindMessage(error)
      }
    } else {
      try {
        await this.ctx.webServer.rebind({ host: '127.0.0.1', port: this.persist.port })
        this.persist.enabled = false
        this.bindError = null
      } catch (error) {
        this.bindError = bindMessage(error)
      }
    }
    this.refreshTrust()
    await savePersist(this.persist, this.dshHome)
    return this.snapshot()
  }

  /**
   * Rebind the current host on a new port. A collision keeps the old port.
   * @param request - new port.
   */
  @Remote('setPort')
  async setPort(request: SetPortRequest): Promise<LanStatus> {
    await this.ready
    if (!Number.isInteger(request.port) || request.port < 1 || request.port > 65535) {
      this.bindError = 'invalid port'
      return this.snapshot()
    }
    const host = this.persist.enabled ? '0.0.0.0' : '127.0.0.1'
    try {
      await this.ctx.webServer.rebind({ host, port: request.port })
      this.persist.port = request.port
      this.bindError = null
    } catch (error) {
      this.bindError = bindMessage(error)
    }
    await savePersist(this.persist, this.dshHome)
    return this.snapshot()
  }

  /**
   * Mint a new token. Existing cookies fail immediately.
   */
  @Remote('rotateToken')
  async rotateToken(): Promise<LanStatus> {
    await this.ready
    this.persist.token = createToken()
    await savePersist(this.persist, this.dshHome)
    return this.snapshot()
  }
}

export default XmartLanService
