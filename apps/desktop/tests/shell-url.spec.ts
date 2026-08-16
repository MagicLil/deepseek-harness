import { describe, expect, it } from 'vitest'
import { desktopLoopbackUrl, isDesktopRendererUrl } from '../src/page-url.ts'

describe('desktop loopback page URL', () => {
  it('builds the webserver origin the window should load', () => {
    expect(desktopLoopbackUrl(3080)).toBe('http://127.0.0.1:3080/')
  })

  it('treats the custom protocol and loopback HTTP as the same surface', () => {
    expect(isDesktopRendererUrl(new URL('dsh://app/dsh-market/registry'))).toBe(true)
    expect(isDesktopRendererUrl(new URL('http://127.0.0.1:3080/dsh-market/registry'))).toBe(true)
    expect(isDesktopRendererUrl(new URL('http://localhost:3080/'))).toBe(true)
    expect(isDesktopRendererUrl(new URL('https://example.com/'))).toBe(false)
  })
})
