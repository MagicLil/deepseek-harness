/**
 * Cordis-facing desktop shell: open the Electron window over the `dsh://`
 * protocol (so absolute `/assets` URLs from the Vite build resolve), wire IPC
 * to `toFetchHandler`, and inject `__DSH_BOOT__` into index.html.
 * @module @deepseek-ai/dsh-desktop/shell
 */

import { readFileSync } from 'node:fs'
import { dirname, extname, normalize, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BrowserWindow, app, ipcMain, protocol } from 'electron'
import type { Context } from '@deepseek-ai/cordis'
import { injectBootManifest, type WebBootGraph } from '@deepseek-ai/dsh-client-modules'
import type { FetchHandler } from '@deepseek-ai/dsh-client-connection'
import { toFetchHandler } from '@deepseek-ai/dsh-host-apiproxy'
import {
  DSH_FETCH_CHANNEL,
  DSH_LOAD_BUNDLE_CHANNEL,
  type IpcFetchChunk,
  type IpcFetchEnd,
  type IpcFetchRequest,
  type IpcFetchResponseHead,
} from './ipc-protocol.ts'

const CHUNK_CHANNEL = 'dsh:fetch-chunk'
const END_CHANNEL = 'dsh:fetch-end'

/** Origin the renderer uses; hostname is loopback-shaped for privilege checks. */
export const DSH_DESKTOP_ORIGIN = 'dsh://app'

/** Options for {@link openDesktopShell}. */
export interface DesktopShellOptions {
  /** Absolute path to the built frontend `index.html`. */
  distIndex: string
  /** Host Cordis context carrying `apiProxy` and `clientModules`. */
  ctx: Context
  /** Absolute path to the preload script Electron loads into the renderer. */
  preloadPath: string
}

/** Handle returned by {@link openDesktopShell}. */
export interface DesktopShellHandle {
  /** Close the window and detach IPC handlers. */
  dispose(): Promise<void>
  /** Resolves when the user closes the window (or dispose is called). */
  readonly closed: Promise<void>
}

let streamSeq = 0
let schemesRegistered = false

/**
 * Must run before `app.ready`: marks `dsh://` as a standard, fetch-capable scheme.
 */
export function registerDesktopSchemes(): void {
  if (schemesRegistered) return
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'dsh',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: false,
      },
    },
  ])
  schemesRegistered = true
}

/**
 * Convert a Fetch Headers object into a plain record for IPC.
 * @param headers - response headers.
 */
function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    out[key] = value
  })
  return out
}

/**
 * Resolve a `/plugins/<id>/client.js?rev=…` URL to an on-disk client bundle.
 * @param ctx - host context with `clientModules`.
 * @param url - graph URL from `__DSH_BOOT__`.
 */
function resolvePluginBundlePath(ctx: Context, url: string): string {
  const parsed = new URL(url, DSH_DESKTOP_ORIGIN)
  const match = /^\/plugins\/(.+)\/client\.js$/.exec(parsed.pathname)
  if (match === null) {
    throw new Error(`dsh desktop: unsupported plugin URL ${JSON.stringify(url)}`)
  }
  const id = decodeURIComponent(match[1] ?? '')
  const clientPath = ctx.clientModules.clientPath(id)
  if (clientPath === undefined) {
    throw new Error(`dsh desktop: unknown client plugin ${JSON.stringify(id)}`)
  }
  return clientPath
}

/**
 * Ensure a filesystem path stays under `root` (no traversal).
 * @param root - allowed root directory.
 * @param target - candidate absolute path.
 */
function assertUnderRoot(root: string, target: string): void {
  const rootNorm = normalize(root)
  const targetNorm = normalize(target)
  const under = targetNorm === rootNorm || targetNorm.startsWith(rootNorm + sep)
  if (!under) throw new Error(`dsh desktop: path escapes root: ${target}`)
  const rel = relative(rootNorm, targetNorm)
  if (rel.startsWith('..')) throw new Error(`dsh desktop: path escapes root: ${target}`)
}

/** Guess a Content-Type for static dist files. */
function contentTypeFor(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.html': return 'text/html; charset=utf-8'
    case '.js': return 'text/javascript; charset=utf-8'
    case '.css': return 'text/css; charset=utf-8'
    case '.svg': return 'image/svg+xml'
    case '.png': return 'image/png'
    case '.woff': return 'font/woff'
    case '.woff2': return 'font/woff2'
    case '.ttf': return 'font/ttf'
    case '.json': return 'application/json'
    case '.webmanifest': return 'application/manifest+json'
    case '.map': return 'application/json'
    default: return 'application/octet-stream'
  }
}

/**
 * Open the desktop BrowserWindow over the built web frontend and attach IPC.
 * @param options - dist path, Cordis context, and preload path.
 */
export async function openDesktopShell(options: DesktopShellOptions): Promise<DesktopShellHandle> {
  await app.whenReady()

  const apiProxy = options.ctx.get('apiProxy')
  if (apiProxy === undefined) {
    throw new Error('dsh desktop: apiProxy service missing — mount api-gateway before desktop-runtime')
  }
  if (options.ctx.get('clientModules') === undefined) {
    throw new Error('dsh desktop: clientModules service missing — mount modules before desktop-runtime')
  }

  // Prefer the shared Connection `/api` handler so remotes interceptors reach
  // IPC the same way they reach the webserver bridge.
  const connection = options.ctx.get('connection')
  const handler: FetchHandler = connection?.apiFetch ?? toFetchHandler(apiProxy)
  const distRoot = dirname(options.distIndex)
  const graph: WebBootGraph = options.ctx.clientModules.graph()
  const indexHtml = injectBootManifest(readFileSync(options.distIndex, 'utf8'), graph)

  protocol.handle('dsh', (request) => {
    const url = new URL(request.url)
    if (url.hostname !== 'app') {
      return new Response('not found', { status: 404 })
    }
    let pathname = decodeURIComponent(url.pathname)
    if (pathname === '/' || pathname === '') pathname = '/index.html'
    if (pathname === '/index.html') {
      return new Response(indexHtml, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    }
    const target = resolve(distRoot, `.${pathname}`)
    try {
      assertUnderRoot(distRoot, target)
      const body = readFileSync(target)
      return new Response(body, {
        status: 200,
        headers: { 'content-type': contentTypeFor(target) },
      })
    } catch {
      return new Response('not found', { status: 404 })
    }
  })

  const fetchListener = async (
    event: Electron.IpcMainInvokeEvent,
    request: IpcFetchRequest,
  ): Promise<IpcFetchResponseHead> => {
    // The IPC bridge is reachable only from our own renderer (contextIsolation
    // preload), so present the request as loopback: the /api trust fence gates
    // privileged methods (settings.*, host.pickDirectory, credentials.*) on a
    // loopback `host` header, and the renderer's dsh://app origin carries none.
    const requested = new URL(request.url)
    const target = new URL(`${requested.pathname}${requested.search}`, 'http://127.0.0.1')
    const headers = new Headers(request.headers ?? {})
    headers.set('host', '127.0.0.1')
    const init: RequestInit = { headers }
    if (request.method !== undefined) init.method = request.method
    if (request.body !== undefined) init.body = request.body
    const response = await handler.fetch(new Request(target, init))
    const contentType = response.headers.get('content-type') ?? ''
    const isEventStream = contentType.includes('text/event-stream')
    const body = response.body
    if (!isEventStream || body === null) {
      return {
        status: response.status,
        statusText: response.statusText,
        headers: headersToRecord(response.headers),
        body: await response.text(),
      }
    }
    const streamId = `s${String(++streamSeq)}`
    const sender = event.sender
    void (async () => {
      const reader = body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value !== undefined) {
            const chunk: IpcFetchChunk = {
              streamId,
              data: Buffer.from(value).toString('base64'),
            }
            if (!sender.isDestroyed()) sender.send(CHUNK_CHANNEL, chunk)
          }
        }
        if (!sender.isDestroyed()) {
          sender.send(END_CHANNEL, { streamId } satisfies IpcFetchEnd)
        }
      } catch (error) {
        if (!sender.isDestroyed()) {
          sender.send(END_CHANNEL, {
            streamId,
            error: error instanceof Error ? error.message : String(error),
          } satisfies IpcFetchEnd)
        }
      }
    })()
    return {
      status: response.status,
      statusText: response.statusText,
      headers: headersToRecord(response.headers),
      streamId,
    }
  }

  const loadBundleListener = async (_event: Electron.IpcMainInvokeEvent, url: string): Promise<string> => {
    const clientPath = resolvePluginBundlePath(options.ctx, url)
    return readFileSync(clientPath, 'utf8')
  }

  ipcMain.handle(DSH_FETCH_CHANNEL, fetchListener)
  ipcMain.handle(DSH_LOAD_BUNDLE_CHANNEL, loadBundleListener)

  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'DeepSeek Harness',
  })

  await win.loadURL(`${DSH_DESKTOP_ORIGIN}/`)

  if (process.env.DSH_DESKTOP_SMOKE_UNARY === '1') {
    void (async () => {
      try {
        const smoke = await handler.fetch(new Request('http://dsh.internal/api/host.describe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            type: 'client-request',
            rpcId: 'desktop-smoke-unary',
            method: 'host.describe',
            payload: {},
          }),
        }))
        const text = await smoke.text()
        if (smoke.status < 200 || smoke.status >= 300) {
          throw new Error(`host.describe HTTP ${String(smoke.status)}: ${text.slice(0, 400)}`)
        }
        const ipcStatus = await win.webContents.executeJavaScript(`
          (async () => {
            const ipc = window.__DSH_IPC__;
            if (!ipc) return { ok: false, error: 'missing __DSH_IPC__' };
            const list = await ipc.fetch({
              url: new URL('/api/session.list', location.origin).href,
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                type: 'client-request',
                rpcId: 'desktop-smoke-sessions',
                method: 'session.list',
                payload: {},
              }),
            });
            const remote = await ipc.fetch({
              url: new URL('/api/dynamicCordisRunner/inventory', location.origin).href,
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                type: 'client-request',
                rpcId: 'desktop-smoke-inventory',
                method: 'inventory',
                payload: {},
              }),
            });
            // Privileged method: exercises the loopback trust fence over IPC.
            const settings = await ipc.fetch({
              url: new URL('/api/settings.describe', location.origin).href,
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                type: 'client-request',
                rpcId: 'desktop-smoke-settings',
                method: 'settings.describe',
                payload: {},
              }),
            });
            const mux = await ipc.fetch({
              url: new URL('/api/events.mux', location.origin).href,
              method: 'GET',
            });
            // Cancel the SSE body quickly — we only need headers + first bytes.
            const reader = mux.streamId === undefined ? null : null;
            void reader;
            return {
              ok: list.status >= 200 && list.status < 300
                && remote.status >= 200 && remote.status < 300
                && settings.status >= 200 && settings.status < 300
                && mux.status >= 200 && mux.status < 300
                && String(mux.headers['content-type'] ?? '').includes('text/event-stream'),
              listStatus: list.status,
              remoteStatus: remote.status,
              settingsStatus: settings.status,
              muxStatus: mux.status,
              muxContentType: mux.headers['content-type'],
              muxStream: mux.streamId !== undefined,
            };
          })()
        `) as {
          ok: boolean
          listStatus?: number
          remoteStatus?: number
          settingsStatus?: number
          muxStatus?: number
          muxContentType?: string
          muxStream?: boolean
          error?: string
        }
        if (!ipcStatus.ok) {
          throw new Error(`renderer IPC smoke failed: ${JSON.stringify(ipcStatus)}`)
        }
        console.log('dsh desktop: smoke-unary ok', {
          describeStatus: smoke.status,
          sessionListStatus: ipcStatus.listStatus,
          remoteStatus: ipcStatus.remoteStatus,
          settingsStatus: ipcStatus.settingsStatus,
          muxStatus: ipcStatus.muxStatus,
          muxStream: ipcStatus.muxStream,
        })
        app.exit(0)
      } catch (error) {
        console.error('dsh desktop: smoke-unary failed', error)
        app.exit(1)
      }
    })()
  }

  let settleClosed = (): void => {}
  const closed = new Promise<void>((resolveClosed) => {
    settleClosed = resolveClosed
  })
  win.once('closed', () => {
    settleClosed()
  })

  return {
    closed,
    async dispose() {
      ipcMain.removeHandler(DSH_FETCH_CHANNEL)
      ipcMain.removeHandler(DSH_LOAD_BUNDLE_CHANNEL)
      try {
        protocol.unhandle('dsh')
      } catch {
        // already torn down
      }
      if (!win.isDestroyed()) win.close()
      await closed
    },
  }
}

/** Resolve this package's preload script path (checked-in plain ESM). */
export function resolvePreloadPath(): string {
  return fileURLToPath(new URL('../preload.mjs', import.meta.url))
}
