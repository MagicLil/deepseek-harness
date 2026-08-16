import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DESKTOP_PROXY_SERVER,
  desktopProxyServer,
  desktopProxyUrl,
  desktopSplitProxyPac,
  resolveDesktopProxyServer,
} from '../src/proxy-env.ts'

describe('desktopProxyUrl', () => {
  it('prefers HTTPS_PROXY and ignores blanks', () => {
    expect(desktopProxyUrl({ HTTPS_PROXY: 'http://127.0.0.1:7890' })).toBe('http://127.0.0.1:7890')
    expect(desktopProxyUrl({ https_proxy: 'http://127.0.0.1:7890' })).toBe('http://127.0.0.1:7890')
    expect(desktopProxyUrl({ HTTP_PROXY: 'http://127.0.0.1:7890' })).toBe('http://127.0.0.1:7890')
    expect(desktopProxyUrl({ HTTPS_PROXY: '  ' })).toBeUndefined()
    expect(desktopProxyUrl({})).toBeUndefined()
  })
})

describe('desktopProxyServer', () => {
  it('strips the scheme for Electron proxy switches', () => {
    expect(desktopProxyServer({ HTTPS_PROXY: 'http://127.0.0.1:7890' })).toBe('127.0.0.1:7890')
    expect(desktopProxyServer({ HTTPS_PROXY: '127.0.0.1:7890' })).toBe('127.0.0.1:7890')
    expect(desktopProxyServer({ HTTPS_PROXY: 'not a url' })).toBeUndefined()
  })
})

describe('resolveDesktopProxyServer', () => {
  it('falls back to the local Clash port when env is empty', () => {
    expect(resolveDesktopProxyServer({})).toBe(DEFAULT_DESKTOP_PROXY_SERVER)
    expect(resolveDesktopProxyServer({ HTTPS_PROXY: 'http://127.0.0.1:10809' })).toBe('127.0.0.1:10809')
  })
})

describe('desktopSplitProxyPac', () => {
  it('proxies OpenAI hosts and leaves domestic APIs direct', () => {
    const pac = desktopSplitProxyPac('127.0.0.1:7890')
    expect(pac).toContain('PROXY 127.0.0.1:7890')
    expect(pac).toContain('"openai.com"')
    expect(pac).toContain('"chatgpt.com"')
    expect(pac).toContain('return "DIRECT"')
    expect(pac).not.toContain('deepseek')
    expect(pac).not.toContain('moonshot')
  })
})
