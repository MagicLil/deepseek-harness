/** Small durable workbench appearance preferences shared by the shell and settings. */

export const ACCENT_COLORS = ['#5BB73B', '#4F8CFF', '#A855F7', '#F97316', '#E5484D'] as const
export type AccentColor = typeof ACCENT_COLORS[number]
export type IconTheme = 'seti' | 'seti-muted'

const ACCENT_KEY = 'xmart.workbench.accent'
const ICON_KEY = 'xmart.workbench.icons'

export function readAccentColor(): AccentColor {
  const value = safeStorageGet(ACCENT_KEY)
  return ACCENT_COLORS.includes(value as AccentColor) ? value as AccentColor : ACCENT_COLORS[0]
}

export function readIconTheme(): IconTheme {
  return safeStorageGet(ICON_KEY) === 'seti-muted' ? 'seti-muted' : 'seti'
}

export function writeAccentColor(color: AccentColor): void {
  safeStorageSet(ACCENT_KEY, color)
}

export function writeIconTheme(theme: IconTheme): void {
  safeStorageSet(ICON_KEY, theme)
}

function safeStorageGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function safeStorageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* storage is optional */ }
}
