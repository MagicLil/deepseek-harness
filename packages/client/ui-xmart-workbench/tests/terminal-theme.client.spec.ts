import { describe, expect, it } from 'vitest'
import { XMART_CANVAS_DARK, XMART_CANVAS_LIGHT } from '../src/client/brand-accent.ts'
import {
  XTERM_THEME_DARK, XTERM_THEME_LIGHT, xtermTheme,
} from '../src/client/terminal-theme.ts'

describe('xtermTheme', () => {
  it('returns the Cursor / Light+ palette on a white canvas', () => {
    expect(xtermTheme(false)).toBe(XTERM_THEME_LIGHT)
    expect(XTERM_THEME_LIGHT.background).toBe(XMART_CANVAS_LIGHT)
    expect(XTERM_THEME_LIGHT.foreground).toBe('#333333')
    expect(XTERM_THEME_LIGHT.green).toBe('#00BC00')
    expect(XTERM_THEME_LIGHT.blue).toBe('#0451A5')
    expect(XTERM_THEME_LIGHT.yellow).toBe('#949800')
  })

  it('returns Dark+ ANSI on the workbench charcoal canvas', () => {
    expect(xtermTheme(true)).toBe(XTERM_THEME_DARK)
    expect(XTERM_THEME_DARK.background).toBe(XMART_CANVAS_DARK)
    expect(XTERM_THEME_DARK.foreground).toBe('#CCCCCC')
    expect(XTERM_THEME_DARK.green).toBe('#0DBC79')
    expect(XTERM_THEME_DARK.blue).toBe('#2472C8')
  })
})
