import { EventEmitter } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebServer } from '@deepseek-ai/dsh-host-webserver'
import XmartLanService, { tokensEqual } from '../src/index.ts'
import { savePersist } from '../src/store.ts'

function fakeResponse(): { response: ServerResponse; state: { status?: number; body?: string; headers?: Record<string, string> } } {
  const state: { status?: number; body?: string; headers?: Record<string, string> } = {}
  const response = Object.assign(new EventEmitter(), {
    writeHead(status: number, headers?: Record<string, string>) {
      state.status = status
      state.headers = headers
      return this
    },
    end(value?: string) {
      if (typeof value === 'string') state.body = value
      return this
    },
  }) as unknown as ServerResponse
  return { response, state }
}

function fakeReq(method: string, url: string, headers: Record<string, string>, body = ''): IncomingMessage {
  const request = Readable.from([Buffer.from(body)]) as unknown as IncomingMessage
  Object.assign(request, { method, url, headers })
  return request
}

async function mounted(home: string, rebind: WebServer['rebind'] = vi.fn(async () => {})): Promise<{
  ctx: Context
  service: XmartLanService
  guard: (req: IncomingMessage) => 'allow' | 'deny'
  unauthorized: (req: IncomingMessage, res: ServerResponse) => void
  login: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  rebind: ReturnType<typeof vi.fn>
}> {
  const ctx = new Context()
  let guard: ((req: IncomingMessage) => 'allow' | 'deny') | undefined
  let unauthorized: ((req: IncomingMessage, res: ServerResponse) => void) | undefined
  let login: ((req: IncomingMessage, res: ServerResponse) => void | Promise<void>) | undefined
  ctx.provide('webServer', {
    registerGuard(next) { guard = next; return () => {} },
    setUnauthorizedHandler(next) { unauthorized = next; return () => {} },
    register(route) { login = route.handler; return () => {} },
    rebind,
    port: 3080,
  } as unknown as WebServer)
  const fiber = ctx.plugin(XmartLanService, {
    dshHome: home,
    interfaces: () => ({
      eth0: [{ address: '192.168.1.5', family: 'IPv4', internal: false }],
    }),
  })
  await fiber.await()
  const service = ctx.xmartLan
  await service.status()
  return {
    ctx,
    service,
    guard: guard!,
    unauthorized: unauthorized!,
    login: login!,
    rebind: rebind as ReturnType<typeof vi.fn>,
  }
}

describe('XmartLanService', () => {
  it('keeps enabled false and records bindError when rebind rejects', async () => {
    const home = await mkdtemp(join(tmpdir(), 'xmart-lan-'))
    try {
      const rebind = vi.fn(async () => { throw 'EADDRINUSE' })
      const { service } = await mounted(home, rebind)
      const before = await service.status()
      const failed = await service.setEnabled({ enabled: true })
      expect(failed.enabled).toBe(false)
      expect(failed.bindError).toContain('EADDRINUSE')
      expect(failed.lanUrl).toBeNull()
      expect(service.trustedHosts).toEqual([])
      const rotated = await service.rotateToken()
      expect(tokensEqual(before.token, rotated.token)).toBe(false)
      const closed = await service.setEnabled({ enabled: false })
      expect(closed.enabled).toBe(false)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('rebinds 0.0.0.0 and exposes the LAN URL when enable succeeds', async () => {
    const home = await mkdtemp(join(tmpdir(), 'xmart-lan-'))
    try {
      const { service, guard, unauthorized, login } = await mounted(home)
      const opened = await service.setEnabled({ enabled: true })
      expect(opened.enabled).toBe(true)
      expect(opened.lanUrl).toBe('http://192.168.1.5:3080/')
      expect(service.trustedHosts).toEqual(['192.168.1.5'])
      expect(guard(fakeReq('GET', '/', { host: '127.0.0.1:3080' }))).toBe('allow')
      expect(guard(fakeReq('GET', '/', { host: '192.168.1.5:3080' }))).toBe('deny')
      expect(guard(fakeReq('GET', '/', {
        host: '192.168.1.5:3080',
        cookie: `xmart_lan=${opened.token}`,
      }))).toBe('allow')
      expect(guard(fakeReq('GET', '/', {
        host: '192.168.1.5:3080',
        'x-xmart-lan-token': opened.token,
      }))).toBe('allow')
      expect(guard(fakeReq('POST', '/xmart-lan/login', { host: '192.168.1.5:3080' }))).toBe('allow')
      const denied = fakeResponse()
      unauthorized(fakeReq('GET', '/', { host: '192.168.1.5:3080' }), denied.response)
      expect(denied.state.status).toBe(401)
      expect(denied.state.body).toContain('<form')
      const wrong = fakeResponse()
      await login(fakeReq('POST', '/xmart-lan/login', {}, 'token=nope'), wrong.response)
      expect(wrong.state.status).toBe(401)
      const ok = fakeResponse()
      await login(fakeReq('POST', '/xmart-lan/login', {}, `token=${opened.token}`), ok.response)
      expect(ok.state.status).toBe(302)
      expect(ok.state.headers?.['set-cookie']).toContain(opened.token)
      const method = fakeResponse()
      await login(fakeReq('GET', '/xmart-lan/login', {}), method.response)
      expect(method.state.status).toBe(405)
      const port = await service.setPort({ port: 4090 })
      expect(port.port).toBe(4090)
      expect(port.lanUrl).toBe('http://192.168.1.5:4090/')
      const closed = await service.setEnabled({ enabled: false })
      expect(closed.enabled).toBe(false)
      expect(closed.lanUrl).toBeNull()
      const moved = await service.setPort({ port: 5000 })
      expect(moved.port).toBe(5000)
      const badPort = await service.setPort({ port: 0 })
      expect(badPort.bindError).toBe('invalid port')
      const empty = fakeResponse()
      await login(fakeReq('POST', '/xmart-lan/login', {}, 'foo=bar'), empty.response)
      expect(empty.state.status).toBe(401)
      const noUrl = Object.assign(fakeReq('GET', '/', { host: '127.0.0.1:3080' }), { url: undefined })
      expect(guard(noUrl)).toBe('allow')
      expect(guard(fakeReq('GET', '/', {}))).toBe('deny')
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('uses os.networkInterfaces when no snapshot is injected', async () => {
    const home = await mkdtemp(join(tmpdir(), 'xmart-lan-'))
    try {
      const ctx = new Context()
      ctx.provide('webServer', {
        registerGuard: () => () => {},
        setUnauthorizedHandler: () => () => {},
        register: () => () => {},
        rebind: vi.fn(async () => {}),
        port: 3080,
      } as unknown as WebServer)
      await ctx.plugin(XmartLanService, { dshHome: home }).await()
      const status = await ctx.xmartLan.status()
      expect(status.enabled).toBe(false)
      expect(status.loopbackUrl).toBe('http://127.0.0.1:3080/')
      await ctx.fiber.dispose()
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('restores a persisted open switch and falls back when boot rebind fails', async () => {
    const home = await mkdtemp(join(tmpdir(), 'xmart-lan-'))
    try {
      await savePersist({ enabled: true, port: 3080, token: 'persisted-token-value-24b' }, home)
      const rebind = vi.fn(async () => { throw new Error('bind down') })
      const { service } = await mounted(home, rebind)
      const status = await service.status()
      expect(status.enabled).toBe(false)
      expect(status.bindError).toContain('bind down')
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('restores a persisted open switch when boot rebind succeeds', async () => {
    const home = await mkdtemp(join(tmpdir(), 'xmart-lan-'))
    try {
      await savePersist({ enabled: true, port: 3080, token: 'persisted-token-value-24b' }, home)
      const { service, guard } = await mounted(home)
      const status = await service.status()
      expect(status.enabled).toBe(true)
      expect(status.lanUrl).toBe('http://192.168.1.5:3080/')
      expect(guard(fakeReq('GET', '/xmart-lan/login?x=1', { host: '192.168.1.5:3080' }))).toBe('deny')
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('records a close or port rebind failure without changing the listen intent incorrectly', async () => {
    const home = await mkdtemp(join(tmpdir(), 'xmart-lan-'))
    try {
      const rebind = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('close fail'))
        .mockRejectedValueOnce('port busy')
      const { service } = await mounted(home, rebind)
      await service.setEnabled({ enabled: true })
      const closed = await service.setEnabled({ enabled: false })
      expect(closed.bindError).toContain('close fail')
      const port = await service.setPort({ port: 4000 })
      expect(port.port).toBe(3080)
      expect(port.bindError).toContain('port busy')
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })
})
