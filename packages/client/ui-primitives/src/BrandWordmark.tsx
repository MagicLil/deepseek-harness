// 万物智汇 wordmark: green X + product name. Ink for the letters rides
// currentColor so the lockup follows the sidebar theme; the X stays brand green.

import type { IconProps } from './icons/props.ts'
import { XMarkPaths } from './x-mark.tsx'

/** Native lockup 130×24 (X ~33 wide + gap + 万物智汇). */
const NATIVE_WIDTH = 130
const NATIVE_HEIGHT = 24

/**
 * Render the brand wordmark.
 * @param props.size - height in px (default 24; width keeps the 130:24 ratio).
 * @param props.className - extra class for layout placement.
 * @returns the wordmark svg (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className }: IconProps) {
  return (
    <svg
      width={(size * NATIVE_WIDTH) / NATIVE_HEIGHT}
      height={size}
      className={className}
      viewBox={`0 0 ${NATIVE_WIDTH} ${NATIVE_HEIGHT}`}
      fill="none"
      aria-hidden="true"
    >
      <g transform="translate(0 2) scale(0.833)">
        <XMarkPaths />
      </g>
      <text
        x="38"
        y="17"
        fill="currentColor"
        fontSize="14"
        fontWeight="600"
        fontFamily="system-ui, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
      >
        万物智汇
      </text>
    </svg>
  )
}
