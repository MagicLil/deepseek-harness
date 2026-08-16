/**
 * Desktop window chrome: hidden title bar plus Windows/Linux caption-button
 * overlay so the renderer can sit a chat toggle next to Minimize.
 * @module @deepseek-ai/dsh-desktop/title-bar
 */

/** Overlay strip height; keep in lockstep with ui-layout `TITLE_BAR_HEIGHT`. */
export const DESKTOP_TITLE_BAR_HEIGHT = 32

/** Caption-button overlay colors; match dark `--dsw-alias-bg-base` (`rgb(21, 21, 23)`). */
export const DESKTOP_TITLE_BAR_OVERLAY = {
  color: '#151517',
  symbolColor: '#c8c8c8',
  height: DESKTOP_TITLE_BAR_HEIGHT,
} as const

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
export function desktopTitleBarChrome(): {
  titleBarStyle: 'hidden'
  titleBarOverlay: typeof DESKTOP_TITLE_BAR_OVERLAY
} {
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: DESKTOP_TITLE_BAR_OVERLAY,
  }
}
