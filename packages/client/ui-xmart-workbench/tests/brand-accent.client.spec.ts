import { describe, expect, it } from 'vitest'
import {
  XMART_ACCENT_TOKENS, XMART_GREEN, XMART_GREEN_INK,
} from '../src/client/brand-accent.ts'

describe('xmart brand accent tokens', () => {
  it('remaps the DeepSeek-blue aliases to 万物智汇 green with both palettes', () => {
    expect(XMART_ACCENT_TOKENS['--dsw-alias-state-business-primary']).toEqual({
      light: XMART_GREEN_INK, dark: XMART_GREEN,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-alias-button-info-fill']).toEqual({
      light: XMART_GREEN, dark: XMART_GREEN,
    })
    expect(XMART_GREEN).toBe('#5BB73B')
    expect(XMART_GREEN_INK).toBe('#3D8C28')
    for (const pair of Object.values(XMART_ACCENT_TOKENS)) {
      expect(pair.light).toMatch(/^#[0-9A-F]{6}$/i)
      expect(pair.dark).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it('does not override success, error, or warn state tokens', () => {
    const names = Object.keys(XMART_ACCENT_TOKENS)
    expect(names.some(name => name.includes('success'))).toBe(false)
    expect(names.some(name => name.includes('error'))).toBe(false)
    expect(names.some(name => name.includes('warn'))).toBe(false)
  })
})
