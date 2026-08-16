/** Login HTML and Set-Cookie helper. */

import { COOKIE_NAME } from './token.ts'

/** Minimal password form posted to `/xmart-lan/login`. */
export function loginPageHtml(): string {
  return '<!doctype html><html><head><meta charset="utf-8"><title>X-Mart</title></head>'
    + '<body><form method="post" action="/xmart-lan/login">'
    + '<input name="token" type="password" autocomplete="current-password">'
    + '<button type="submit">OK</button></form></body></html>'
}

/**
 * `Set-Cookie` value for a successful login.
 * @param token - minted token stored in the cookie.
 */
export function loginSetCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax`
}
