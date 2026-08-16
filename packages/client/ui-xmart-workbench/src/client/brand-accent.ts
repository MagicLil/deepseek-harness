import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'

/** 万物智汇 mark green, sampled from default-logo.png (same as ui-primitives x-mark). */
export const XMART_GREEN = '#5BB73B'

/** Darker ink for light-mode text, tabs, and links (contrast on white). */
export const XMART_GREEN_INK = '#3D8C28'

/** Hover on a filled brand control in light mode. */
export const XMART_GREEN_HOVER_LIGHT = '#4A9C32'

/** Hover on a filled brand control in dark mode. */
export const XMART_GREEN_HOVER_DARK = '#6BC84A'

/** Pale mint sweep on the running-status shimmer (same role as deepseek-200). */
export const XMART_GREEN_SHIMMER = '#CDE9C4'

export const XMART_CANVAS_LIGHT = '#FFFFFF'
export const XMART_CANVAS_DARK = '#181818'
export const XMART_CHROME_LIGHT = '#F5F5F5'
export const XMART_CHROME_DARK = '#141414'
export const XMART_LAYER_1_DARK = '#1F1F1F'
export const XMART_LAYER_2_DARK = '#262626'
export const XMART_LAYER_3_DARK = '#2C2C2C'
export const XMART_SELECTED_LIGHT = '#EBEBEB'
export const XMART_SELECTED_DARK = '#2A2A2A'

/**
 * Brand overlay: green stays on chrome accents; canvas / washes / bubbles
 * are true neutrals. Success / error / warn stay untouched. Chart series
 * that bind `--dsw-static-blue-*` stay blue.
 */
export const XMART_ACCENT_TOKENS: ThemeTokenOverrides = {
  '--dsw-alias-state-business-primary': { light: XMART_GREEN_INK, dark: XMART_GREEN },
  '--dsw-alias-button-info-fill': { light: XMART_GREEN, dark: XMART_GREEN },
  '--dsw-alias-button-info-hover': { light: XMART_GREEN_HOVER_LIGHT, dark: XMART_GREEN_HOVER_DARK },
  '--dsw-alias-brand-primary-new-colorprimary-new-color': { light: XMART_GREEN_INK, dark: XMART_GREEN },
  '--dsw-static-deepseek-200': { light: XMART_GREEN_SHIMMER, dark: XMART_GREEN_SHIMMER },
  '--dsw-static-deepseek-450': { light: XMART_GREEN_INK, dark: XMART_GREEN },
  '--dsw-static-deepseek-500': { light: XMART_GREEN_INK, dark: XMART_GREEN },
  '--dsw-alias-bg-base': { light: XMART_CANVAS_LIGHT, dark: XMART_CANVAS_DARK },
  '--dsw-alias-bg-layer-1': { light: XMART_CANVAS_LIGHT, dark: XMART_LAYER_1_DARK },
  '--dsw-alias-bg-layer-2': { light: XMART_CANVAS_LIGHT, dark: XMART_LAYER_2_DARK },
  '--dsw-alias-bg-layer-3': { light: XMART_CANVAS_LIGHT, dark: XMART_LAYER_3_DARK },
  '--dsw-specific-sidebar-fill': { light: XMART_CHROME_LIGHT, dark: XMART_CHROME_DARK },
  '--dsw-alias-state-business-tertiary': { light: XMART_SELECTED_LIGHT, dark: XMART_SELECTED_DARK },
  '--dsw-specific-sidebar-nav-item-active-accent': { light: XMART_SELECTED_LIGHT, dark: XMART_SELECTED_DARK },
  '--dsw-specific-bubble': { light: XMART_CHROME_LIGHT, dark: XMART_LAYER_1_DARK },
  '--dsw-specific-bubble-highlight': { light: XMART_SELECTED_LIGHT, dark: XMART_SELECTED_DARK },
}
