/**
 * Desktop window origin helpers. Kept free of Electron so unit tests can
 * import them without loading the native binary.
 * @module @deepseek-ai/dsh-desktop/page-url
 */

/** Custom-protocol origin used when the webserver is not mounted. */
export const DSH_DESKTOP_ORIGIN = 'dsh://app'

/**
 * Loopback URL the desktop window should load so community HTTP plugins
 * (`/dsh-market/*`) share origin with the host webserver.
 * @param port - `ctx.webServer.port`.
 */
export function desktopLoopbackUrl(port: number): string {
  return `http://127.0.0.1:${String(port)}/`
}

/**
 * Whether a navigation stays inside this desktop surface (custom protocol or loopback HTTP).
 * @param url - parsed navigation / download URL.
 */
export function isDesktopRendererUrl(url: URL): boolean {
  if (url.protocol === 'dsh:' && url.hostname === 'app') return true
  return (url.protocol === 'http:' || url.protocol === 'https:')
    && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
}
