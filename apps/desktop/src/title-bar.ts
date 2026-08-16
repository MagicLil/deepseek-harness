/**
 * Desktop window chrome: hidden title bar plus Windows/Linux caption-button
 * overlay so the renderer can sit a chat toggle next to Minimize.
 * @module @deepseek-ai/dsh-desktop/title-bar
 */

/** Overlay strip height; keep in lockstep with ui-layout `TITLE_BAR_HEIGHT`. */
export const DESKTOP_TITLE_BAR_HEIGHT = 32

export type TitleBarColorScheme = 'light' | 'dark'

export function desktopTitleBarOverlay(scheme: TitleBarColorScheme): {
  color: string
  symbolColor: string
  height: number
} {
  return scheme === 'light'
    ? { color: '#F5F5F5', symbolColor: '#333333', height: DESKTOP_TITLE_BAR_HEIGHT }
    : { color: '#141414', symbolColor: '#C8C8C8', height: DESKTOP_TITLE_BAR_HEIGHT }
}

export function resolveInitialTitleBarScheme(shouldUseDarkColors: boolean): TitleBarColorScheme {
  return shouldUseDarkColors ? 'dark' : 'light'
}

/**
 * Hidden title + WCO so the renderer can sit a chat toggle next to
 * Minimize. The desktop renderer always reserves a 32px grid row for
 * that strip; columns start on the next row.
 */
export function applyDesktopTitleBarOverlay(): boolean {
  return true
}

/**
 * Unpackaged `pnpm dsh desktop` must relaunch so a rebuilt main is loaded.
 * Packaged second instances only focus the running window.
 */
export function desktopSecondInstanceAction(packaged: boolean): 'relaunch' | 'focus' {
  return packaged ? 'focus' : 'relaunch'
}

/**
 * BrowserWindow chrome that keeps native min/max/close and frees the rest
 * of the title bar for HTML (Window Controls Overlay).
 */
export function desktopTitleBarChrome(scheme: TitleBarColorScheme): {
  titleBarStyle: 'hidden'
  titleBarOverlay: ReturnType<typeof desktopTitleBarOverlay>
} {
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: desktopTitleBarOverlay(scheme),
  }
}
