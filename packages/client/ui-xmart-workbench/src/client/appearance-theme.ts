import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'

/** Build the two-palette token layer for a user-selected accent. */
export function accentTokens(color: string): ThemeTokenOverrides {
  return {
    '--dsw-alias-state-business-primary': { light: color, dark: color },
    '--dsw-alias-button-info-fill': { light: color, dark: color },
    '--dsw-alias-button-info-hover': { light: color, dark: color },
    '--dsw-static-deepseek-450': { light: color, dark: color },
    '--dsw-static-deepseek-500': { light: color, dark: color },
  }
}
