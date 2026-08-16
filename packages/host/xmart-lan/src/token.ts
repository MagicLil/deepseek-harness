/** Token minting and request presentation. */

import { randomBytes, timingSafeEqual } from 'node:crypto'

/** Cookie name written by the login form. */
export const COOKIE_NAME = 'xmart_lan'

/** Header that wins over the cookie when both are present. */
export const TOKEN_HEADER = 'x-xmart-lan-token'

/** Mint a new URL-safe token. */
export function createToken(): string {
  return randomBytes(24).toString('base64url')
}

/**
 * Read the presented token. The header wins over the cookie.
 * @param cookieHeader - raw Cookie header.
 * @param xTokenHeader - raw `x-xmart-lan-token` header.
 */
export function tokenFromRequest(
  cookieHeader: string | undefined,
  xTokenHeader: string | undefined,
): string | undefined {
  if (xTokenHeader !== undefined && xTokenHeader.length > 0) return xTokenHeader
  if (cookieHeader === undefined) return undefined
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    if (trimmed.slice(0, eq) === COOKIE_NAME) {
      const value = trimmed.slice(eq + 1)
      return value.length === 0 ? undefined : value
    }
  }
  return undefined
}

/**
 * Constant-time compare. Different lengths are false without calling
 * `timingSafeEqual` (which throws on length mismatch).
 */
export function tokensEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
