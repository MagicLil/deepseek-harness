import { describe, expect, it } from 'vitest'
import {
  XMART_ACCENT_TOKENS, XMART_CANVAS_DARK, XMART_CANVAS_LIGHT, XMART_CHROME_DARK,
  XMART_CHROME_LIGHT, XMART_GREEN, XMART_GREEN_INK, XMART_GREEN_SHIMMER,
  XMART_LAYER_1_DARK, XMART_LAYER_2_DARK, XMART_LAYER_3_DARK, XMART_SELECTED_DARK,
  XMART_SELECTED_LIGHT,
} from '../src/client/brand-accent.ts'

describe('xmart brand accent tokens', () => {
  it('keeps 万物智汇 green on chrome accents', () => {
    expect(XMART_GREEN).toBe('#5BB73B')
    expect(XMART_GREEN_INK).toBe('#3D8C28')
    expect(XMART_ACCENT_TOKENS['--dsw-alias-state-business-primary']).toEqual({
      light: XMART_GREEN_INK, dark: XMART_GREEN,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-alias-button-info-fill']).toEqual({
      light: XMART_GREEN, dark: XMART_GREEN,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-alias-button-info-hover']).toEqual({
      light: '#4A9C32', dark: '#6BC84A',
    })
    expect(XMART_ACCENT_TOKENS['--dsw-alias-brand-primary-new-colorprimary-new-color']).toEqual({
      light: XMART_GREEN_INK, dark: XMART_GREEN,
    })
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

  it('neutralizes canvas, chrome, washes, and bubbles', () => {
    expect(XMART_ACCENT_TOKENS['--dsw-alias-bg-base']).toEqual({
      light: XMART_CANVAS_LIGHT, dark: XMART_CANVAS_DARK,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-alias-bg-layer-1']).toEqual({
      light: XMART_CANVAS_LIGHT, dark: XMART_LAYER_1_DARK,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-alias-bg-layer-2']).toEqual({
      light: XMART_CANVAS_LIGHT, dark: XMART_LAYER_2_DARK,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-alias-bg-layer-3']).toEqual({
      light: XMART_CANVAS_LIGHT, dark: XMART_LAYER_3_DARK,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-specific-sidebar-fill']).toEqual({
      light: XMART_CHROME_LIGHT, dark: XMART_CHROME_DARK,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-alias-state-business-tertiary']).toEqual({
      light: XMART_SELECTED_LIGHT, dark: XMART_SELECTED_DARK,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-specific-sidebar-nav-item-active-accent']).toEqual({
      light: XMART_SELECTED_LIGHT, dark: XMART_SELECTED_DARK,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-specific-bubble']).toEqual({
      light: XMART_CHROME_LIGHT, dark: XMART_LAYER_1_DARK,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-specific-bubble-highlight']).toEqual({
      light: XMART_SELECTED_LIGHT, dark: XMART_SELECTED_DARK,
    })
    expect(XMART_CANVAS_DARK).toBe('#181818')
    expect(XMART_CHROME_DARK).toBe('#141414')
    expect(XMART_LAYER_1_DARK).toBe('#1F1F1F')
    expect(XMART_LAYER_2_DARK).toBe('#262626')
    expect(XMART_LAYER_3_DARK).toBe('#2C2C2C')
    expect(XMART_SELECTED_DARK).toBe('#2A2A2A')
    expect(XMART_CANVAS_LIGHT).toBe('#FFFFFF')
    expect(XMART_CHROME_LIGHT).toBe('#F5F5F5')
    expect(XMART_SELECTED_LIGHT).toBe('#EBEBEB')
  })

  it('does not override success, error, or warn state tokens', () => {
    const names = Object.keys(XMART_ACCENT_TOKENS)
    expect(names.some(name => name.includes('success'))).toBe(false)
    expect(names.some(name => name.includes('error'))).toBe(false)
    expect(names.some(name => name.includes('warn'))).toBe(false)
  })

  it('exports only hex pairs', () => {
    for (const pair of Object.values(XMART_ACCENT_TOKENS)) {
      expect(pair.light).toMatch(/^#[0-9A-F]{6}$/i)
      expect(pair.dark).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })
})
