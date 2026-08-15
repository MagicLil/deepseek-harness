// 万物智汇 mark. Export name stays FishLogo so sidebar / hero call sites
// do not churn; the whale path is gone.

import type { IconProps } from './icons/props.ts'
import { XMark } from './x-mark.tsx'

/**
 * Render the brand mark (green X).
 * @param props.size - edge in px (default 24).
 * @param props.className - extra class for layout placement.
 * @returns the logo svg (aria-hidden; pair with the wordmark for accessibility).
 */
export function FishLogo({ size = 24, className }: IconProps) {
  return <XMark size={size} className={className} />
}
