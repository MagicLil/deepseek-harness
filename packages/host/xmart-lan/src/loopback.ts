/** Loopback host classification shared with the LAN guard. */

/**
 * Whether a normalized URL hostname names the local loopback authority.
 * Matches `packages/client/connection/src/loopback-hostname.ts`.
 * @param hostname - WHATWG URL hostname (IPv6 literals retain brackets).
 */
export function isLoopbackHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/**
 * Strip the port from a Host header. IPv6 literals keep their brackets.
 * @param hostHeader - raw `Host` header, or undefined when missing.
 */
export function readHostName(hostHeader: string | undefined): string {
  if (hostHeader === undefined || hostHeader.length === 0) return ''
  if (hostHeader.startsWith('[')) {
    const end = hostHeader.indexOf(']')
    return end === -1 ? hostHeader : hostHeader.slice(0, end + 1)
  }
  return hostHeader.split(':')[0] ?? ''
}
