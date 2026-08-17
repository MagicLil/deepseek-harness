/**
 * xterm palettes that follow Appearance. Light matches VS Code Light+ /
 * Cursor (white canvas, dark ink, the 16 ANSI colors those IDEs ship).
 * Dark stays on the workbench charcoal canvas with the Dark+ ANSI set.
 */
import type { ITheme } from '@xterm/xterm'
import { XMART_CANVAS_DARK, XMART_CANVAS_LIGHT } from './brand-accent.ts'

/** VS Code Light+ / Cursor light terminal. */
export const XTERM_THEME_LIGHT: ITheme = {
  background: XMART_CANVAS_LIGHT,
  foreground: '#333333',
  cursor: '#333333',
  cursorAccent: XMART_CANVAS_LIGHT,
  selectionBackground: '#ADD6FF',
  selectionForeground: '#333333',
  selectionInactiveBackground: '#E5EBF1',
  black: '#000000',
  red: '#CD3131',
  green: '#00BC00',
  yellow: '#949800',
  blue: '#0451A5',
  magenta: '#BC05BC',
  cyan: '#0598BC',
  white: '#555555',
  brightBlack: '#666666',
  brightRed: '#CD3131',
  brightGreen: '#14CE14',
  brightYellow: '#B5BA00',
  brightBlue: '#0451A5',
  brightMagenta: '#BC05BC',
  brightCyan: '#0598BC',
  brightWhite: '#A5A5A5',
}

/** VS Code Dark+ ANSI on the workbench charcoal canvas. */
export const XTERM_THEME_DARK: ITheme = {
  background: XMART_CANVAS_DARK,
  foreground: '#CCCCCC',
  cursor: '#AEAFAD',
  cursorAccent: XMART_CANVAS_DARK,
  selectionBackground: '#264F78',
  black: '#000000',
  red: '#CD3131',
  green: '#0DBC79',
  yellow: '#E5E510',
  blue: '#2472C8',
  magenta: '#BC3FBC',
  cyan: '#11A8CD',
  white: '#E5E5E5',
  brightBlack: '#666666',
  brightRed: '#F14C4C',
  brightGreen: '#23D18B',
  brightYellow: '#F5F543',
  brightBlue: '#3B8EEA',
  brightMagenta: '#D670D6',
  brightCyan: '#29B8DB',
  brightWhite: '#E5E5E5',
}

/**
 * xterm.js theme for the current Appearance.
 * @param dark - `true` when `body[data-ds-dark-theme]` is set.
 */
export function xtermTheme(dark: boolean): ITheme {
  return dark ? XTERM_THEME_DARK : XTERM_THEME_LIGHT
}
