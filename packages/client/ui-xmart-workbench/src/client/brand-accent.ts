import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'

/** 万物智汇 mark green, sampled from default-logo.png (same as ui-primitives x-mark). */
export const XMART_GREEN = '#5BB73B'

/** Darker ink for light-mode text, tabs, and links (contrast on white). */
export const XMART_GREEN_INK = '#3D8C28'

/** Hover on a filled brand control in light mode. */
export const XMART_GREEN_HOVER_LIGHT = '#4A9C32'

/** Hover on a filled brand control in dark mode. */
export const XMART_GREEN_HOVER_DARK = '#6BC84A'

/** Light wash behind selected nav / tertiary business surfaces. */
export const XMART_GREEN_WASH_LIGHT = '#E6F5E0'

/** Dark wash behind selected nav / tertiary business surfaces. */
export const XMART_GREEN_WASH_DARK = '#2A3D26'

/** Pale mint sweep on the running-status shimmer (same role as deepseek-200). */
export const XMART_GREEN_SHIMMER = '#CDE9C4'

/**
 * Semantic DeepSeek-blue aliases remapped to the 万物智汇 green.
 * Also remaps the static DeepSeek steps that conversation chrome still binds
 * directly (`Xmarting...` shimmer, ongoing StateDot). Success / error / warn
 * tokens stay untouched. Chart series that bind `--dsw-static-blue-*`
 * directly also stay blue.
 */
export const XMART_ACCENT_TOKENS: ThemeTokenOverrides = {
  '--dsw-alias-state-business-primary': { light: XMART_GREEN_INK, dark: XMART_GREEN },
  '--dsw-alias-state-business-tertiary': { light: XMART_GREEN_WASH_LIGHT, dark: XMART_GREEN_WASH_DARK },
  '--dsw-alias-button-info-fill': { light: XMART_GREEN, dark: XMART_GREEN },
  '--dsw-alias-button-info-hover': { light: XMART_GREEN_HOVER_LIGHT, dark: XMART_GREEN_HOVER_DARK },
  '--dsw-alias-brand-primary-new-colorprimary-new-color': { light: XMART_GREEN_INK, dark: XMART_GREEN },
  '--dsw-specific-sidebar-nav-item-active-accent': { light: XMART_GREEN_WASH_LIGHT, dark: XMART_GREEN_WASH_DARK },
  '--dsw-specific-bubble': { light: XMART_GREEN_WASH_LIGHT, dark: '#2C2C2E' },
  '--dsw-specific-bubble-highlight': { light: XMART_GREEN_SHIMMER, dark: '#43454A' },
  '--dsw-static-deepseek-200': { light: XMART_GREEN_SHIMMER, dark: XMART_GREEN_SHIMMER },
  '--dsw-static-deepseek-450': { light: XMART_GREEN_INK, dark: XMART_GREEN },
  '--dsw-static-deepseek-500': { light: XMART_GREEN_INK, dark: XMART_GREEN },
}
