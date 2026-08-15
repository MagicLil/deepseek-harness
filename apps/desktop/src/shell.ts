/**
 * Cordis-facing desktop shell: open the Electron window over the `dsh://`
 * protocol (so absolute `/assets` URLs from the Vite build resolve), wire IPC
 * to `toFetchHandler`, and inject `__DSH_BOOT__` into index.html.
 * @module @deepseek-ai/dsh-desktop/shell
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, normalize, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BrowserWindow, app, dialog, ipcMain, nativeImage, protocol, screen, shell as electronShell } from 'electron'
import { checkDesktopUpdatesNow, showCloseToTrayHint, startDesktopAutoUpdate } from './auto-update.ts'
import { consumeCloseToTrayHint } from './desktop-prefs.ts'
import { desktopIconFilePath, ensureDesktopIconFile } from './icon.ts'
import { isAppQuitting, markAppQuitting } from './lifecycle.ts'
import { createDesktopTray, type DesktopTrayHandle } from './tray.ts'
import type { Context } from '@deepseek-ai/cordis'
import { injectBootManifest, type WebBootGraph } from '@deepseek-ai/dsh-client-modules'
import type { FetchHandler } from '@deepseek-ai/dsh-client-connection'
import { toFetchHandler } from '@deepseek-ai/dsh-host-apiproxy'
import {
  DSH_FETCH_ABORT_CHANNEL,
  DSH_FETCH_CHANNEL,
  DSH_LOAD_BUNDLE_CHANNEL,
  type IpcFetchChunk,
  type IpcFetchEnd,
  type IpcFetchRequest,
  type IpcFetchResponseHead,
} from './ipc-protocol.ts'
import {
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  clampWindowState,
  loadWindowState,
  saveWindowState,
} from './window-state.ts'

const CHUNK_CHANNEL = 'dsh:fetch-chunk'
const END_CHANNEL = 'dsh:fetch-end'

/** Origin the renderer uses; hostname is loopback-shaped for privilege checks. */
export const DSH_DESKTOP_ORIGIN = 'dsh://app'

/**
 * Renderer CSP. The web shell inlines cordis-plugin-loader, which builds
 * `!!js` config evaluators with `new Function` + `eval` at module init —
 * without `unsafe-eval` that throw is an EvalError and #root stays blank.
 * Plugin bundles load as classic inline scripts, so `unsafe-inline` stays.
 */
const DESKTOP_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
].join('; ')

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
 * Rewrite a renderer URL as a loopback Request so privileged `/api` methods pass the trust fence.
 * @param url - original request URL (`dsh://app/...` or `http://dsh.internal/...`).
 * @param init - method/headers/body/signal from IPC or the protocol handler.
 */
function toLoopbackRequest(url: URL, init: RequestInit): Request {
  const target = new URL(`${url.pathname}${url.search}`, 'http://127.0.0.1')
  const headers = new Headers(init.headers)
  headers.set('host', '127.0.0.1')
  return new Request(target, { ...init, headers })
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

function filenameFromDisposition(headers: Headers, fallback: string): string {
  const raw = headers.get('content-disposition') ?? ''
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(raw)
  if (encoded?.[1] !== undefined) {
    try {
      return decodeURIComponent(encoded[1])
    } catch {
      return encoded[1]
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(raw)
  if (quoted?.[1] !== undefined) return quoted[1]
  const plain = /filename=([^;]+)/i.exec(raw)
  if (plain?.[1] !== undefined) return plain[1].trim()
  return fallback
}

function fallbackDownloadName(url: URL): string {
  const sessionId = url.searchParams.get('sessionId')
  if (sessionId !== null && sessionId !== '') {
    return `dsh-session-${sessionId.replace(/[^A-Za-z0-9_-]/g, '_')}.zip`
  }
  const leaf = url.pathname.split('/').pop()
  return leaf !== undefined && leaf !== '' ? leaf : 'download'
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Focus the existing desktop window (second-instance / dock activate).
 */
export function focusDesktopWindow(): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (win === undefined) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
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
  const inflight = new Map<string, AbortController>()

  const abortAll = (): void => {
    for (const controller of inflight.values()) controller.abort()
    inflight.clear()
  }

  protocol.handle('dsh', (request) => {
    const url = new URL(request.url)
    if (url.hostname !== 'app') {
      return new Response('not found', { status: 404 })
    }
    if (url.pathname.startsWith('/api/')) {
      // Renderer `fetch` / `<a download>` hit the custom protocol, not IPC.
      const init: RequestInit = {
        method: request.method,
        headers: request.headers,
        signal: request.signal,
      }
      if (request.method !== 'GET' && request.method !== 'HEAD' && request.body !== null) {
        init.body = request.body
      }
      return handler.fetch(toLoopbackRequest(url, init))
    }
    let pathname = decodeURIComponent(url.pathname)
    if (pathname === '/' || pathname === '') pathname = '/index.html'
    if (pathname === '/index.html') {
      return new Response(indexHtml, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-security-policy': DESKTOP_CSP,
        },
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
    const requested = new URL(request.url)
    const abort = new AbortController()
    if (request.requestId !== undefined) inflight.set(request.requestId, abort)
    const init: RequestInit = { signal: abort.signal }
    if (request.method !== undefined) init.method = request.method
    if (request.headers !== undefined) init.headers = request.headers
    if (request.body !== undefined) init.body = request.body
    try {
      const response = await handler.fetch(toLoopbackRequest(requested, init))
      const contentType = response.headers.get('content-type') ?? ''
      const isEventStream = contentType.includes('text/event-stream')
      const body = response.body
      if (!isEventStream || body === null) {
        if (request.requestId !== undefined) inflight.delete(request.requestId)
        return {
          status: response.status,
          statusText: response.statusText,
          headers: headersToRecord(response.headers),
          body: await response.text(),
        }
      }
      const streamId = `s${String(++streamSeq)}`
      const sender = event.sender
      const requestId = request.requestId
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
        } finally {
          if (requestId !== undefined) inflight.delete(requestId)
        }
      })()
      return {
        status: response.status,
        statusText: response.statusText,
        headers: headersToRecord(response.headers),
        streamId,
      }
    } catch (error) {
      if (request.requestId !== undefined) inflight.delete(request.requestId)
      throw error
    }
  }

  const loadBundleListener = async (_event: Electron.IpcMainInvokeEvent, url: string): Promise<string> => {
    const clientPath = resolvePluginBundlePath(options.ctx, url)
    return readFileSync(clientPath, 'utf8')
  }

  const abortListener = (_event: Electron.IpcMainEvent, requestId: string): void => {
    const controller = inflight.get(requestId)
    if (controller === undefined) return
    controller.abort()
    inflight.delete(requestId)
  }

  ipcMain.handle(DSH_FETCH_CHANNEL, fetchListener)
  ipcMain.handle(DSH_LOAD_BUNDLE_CHANNEL, loadBundleListener)
  ipcMain.on(DSH_FETCH_ABORT_CHANNEL, abortListener)

  const workAreas = screen.getAllDisplays().map(display => display.workArea)
  const restored = (() => {
    const saved = loadWindowState()
    return saved === undefined ? undefined : clampWindowState(saved, workAreas)
  })()

  const packageRoot = fileURLToPath(new URL('..', import.meta.url))
  const iconPath = ensureDesktopIconFile(desktopIconFilePath(packageRoot), app.isPackaged)
  const iconImage = nativeImage.createFromPath(iconPath)
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: restored?.width ?? DEFAULT_WINDOW_WIDTH,
    height: restored?.height ?? DEFAULT_WINDOW_HEIGHT,
    show: false,
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    title: 'xmart',
  }
  if (!iconImage.isEmpty()) windowOptions.icon = iconImage
  if (restored !== undefined) {
    windowOptions.x = restored.x
    windowOptions.y = restored.y
  }
  const win = new BrowserWindow(windowOptions)
  if (restored?.isMaximized === true) win.maximize()

  const persistBounds = (): void => {
    if (win.isDestroyed()) return
    const bounds = win.getBounds()
    saveWindowState({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: win.isMaximized(),
    })
  }
  let persistTimer: ReturnType<typeof setTimeout> | undefined
  const schedulePersist = (): void => {
    if (persistTimer !== undefined) clearTimeout(persistTimer)
    persistTimer = setTimeout(persistBounds, 300)
  }
  win.on('resize', schedulePersist)
  win.on('move', schedulePersist)
  const smoke = process.env.DSH_DESKTOP_SMOKE_UNARY === '1'
  win.on('close', (event) => {
    persistBounds()
    if (smoke || isAppQuitting()) return
    event.preventDefault()
    win.hide()
    if (consumeCloseToTrayHint()) showCloseToTrayHint()
  })

  const saveApiDownload = async (url: URL): Promise<void> => {
    try {
      const response = await handler.fetch(toLoopbackRequest(url, { method: 'GET' }))
      if (!response.ok) {
        console.error(`dsh desktop: download failed HTTP ${String(response.status)} ${url.pathname}`)
        return
      }
      const filename = filenameFromDisposition(response.headers, fallbackDownloadName(url))
      const choice = await dialog.showSaveDialog(win, {
        defaultPath: filename,
        filters: [{ name: 'ZIP archive', extensions: ['zip'] }, { name: 'All files', extensions: ['*'] }],
      })
      if (choice.canceled || choice.filePath === undefined) {
        await response.body?.cancel()
        return
      }
      writeFileSync(choice.filePath, Buffer.from(await response.arrayBuffer()))
    } catch (error) {
      console.error('dsh desktop: download failed', error)
    }
  }

  const interceptOutbound = (event: Electron.Event, url: string): void => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      event.preventDefault()
      return
    }
    if (parsed.protocol === 'dsh:' && parsed.hostname === 'app') {
      if (parsed.pathname.startsWith('/api/')) {
        event.preventDefault()
        void saveApiDownload(parsed)
      }
      return
    }
    event.preventDefault()
    if (isHttpUrl(url)) void electronShell.openExternal(url)
  }

  win.webContents.on('will-navigate', interceptOutbound)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) void electronShell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.session.on('will-download', (_event, item) => {
    const url = item.getURL()
    if (!url.startsWith(`${DSH_DESKTOP_ORIGIN}/api/`)) return
    item.cancel()
    try {
      void saveApiDownload(new URL(url))
    } catch {
      // malformed download URL
    }
  })

  await win.loadURL(`${DSH_DESKTOP_ORIGIN}/`)
  win.show()

  let tray: DesktopTrayHandle | undefined
  if (!smoke) {
    tray = createDesktopTray({
      show: () => {
        focusDesktopWindow()
      },
      checkUpdates: () => {
        void checkDesktopUpdatesNow(win)
      },
    })
    startDesktopAutoUpdate(win)
  }

  if (process.env.DSH_DESKTOP_SMOKE_UNARY === '1') {
    void (async () => {
      try {
        const smoke = await handler.fetch(new Request('http://127.0.0.1/api/host.describe', {
          method: 'POST',
          headers: { 'content-type': 'application/json', host: '127.0.0.1' },
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
            if (mux.streamId !== undefined && typeof ipc.abortFetch === 'function' && mux.requestId !== undefined) {
              ipc.abortFetch(mux.requestId);
            }
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
    abortAll()
    settleClosed()
  })

  return {
    closed,
    async dispose() {
      markAppQuitting()
      abortAll()
      tray?.dispose()
      ipcMain.removeHandler(DSH_FETCH_CHANNEL)
      ipcMain.removeHandler(DSH_LOAD_BUNDLE_CHANNEL)
      ipcMain.removeListener(DSH_FETCH_ABORT_CHANNEL, abortListener)
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

/** Resolve this package's preload script path (checked-in CJS for the sandbox). */
export function resolvePreloadPath(): string {
  return fileURLToPath(new URL('../preload.mjs', import.meta.url))
}
