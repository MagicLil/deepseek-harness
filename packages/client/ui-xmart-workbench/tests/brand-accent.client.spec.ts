import { describe, expect, it } from 'vitest'
import {
  XMART_ACCENT_TOKENS, XMART_GREEN, XMART_GREEN_INK, XMART_GREEN_SHIMMER,
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

  it('remaps the static DeepSeek steps the conversation shimmer still binds', () => {
    expect(XMART_ACCENT_TOKENS['--dsw-static-deepseek-500']).toEqual({
      light: XMART_GREEN_INK, dark: XMART_GREEN,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-static-deepseek-200']).toEqual({
      light: XMART_GREEN_SHIMMER, dark: XMART_GREEN_SHIMMER,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-static-deepseek-450']).toEqual({
      light: XMART_GREEN_INK, dark: XMART_GREEN,
    })
    expect(XMART_GREEN_SHIMMER).toBe('#CDE9C4')
  })

  it('does not override success, error, or warn state tokens', () => {
    const names = Object.keys(XMART_ACCENT_TOKENS)
    expect(names.some(name => name.includes('success'))).toBe(false)
    expect(names.some(name => name.includes('error'))).toBe(false)
    expect(names.some(name => name.includes('warn'))).toBe(false)
  })
})
