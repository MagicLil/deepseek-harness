import { describe, expect, it } from 'vitest'
import { loginPageHtml, loginSetCookie } from '../src/login-page.ts'

describe('login page', () => {
  it('renders a form that posts to the login path', () => {
    const html = loginPageHtml()
    expect(html).toContain('xmart-lan/login')
    expect(html).toContain('<form')
  })

  it('sets an HttpOnly cookie', () => {
    expect(loginSetCookie('abc')).toContain('HttpOnly')
    expect(loginSetCookie('abc')).toContain('xmart_lan=abc')
  })
})
