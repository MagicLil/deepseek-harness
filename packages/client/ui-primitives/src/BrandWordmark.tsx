// 万物智汇 wordmark: green X + product name. Width hugs the painted
// letters — a fixed SVG canvas used to leave empty space after 汇 and
// shove the title-bar menus away from the name.

import type { IconProps } from './icons/props.ts'
import { XMarkPaths } from './x-mark.tsx'

const NATIVE_HEIGHT = 24
const MARK_NATIVE_WIDTH = 40
const NAME_NATIVE_SIZE = 14

/** Display options for the official brand wordmark. */
export interface BrandWordmarkProps extends IconProps {
  /** Whether to include the leading whale mark; defaults to true. */
  includeMark?: boolean | undefined
}

/**
 * Render the brand wordmark.
 * @param props.size - height in px (default 24; the X keeps the 40:24 ratio).
 * @param props.className - extra class for layout placement.
 * @returns the lockup (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className }: IconProps) {
  const markWidth = (size * MARK_NATIVE_WIDTH) / NATIVE_HEIGHT
  const fontSize = (size * NAME_NATIVE_SIZE) / NATIVE_HEIGHT
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.max(4, size * 0.18),
        height: size,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
      aria-hidden="true"
    >
      <svg
        width={markWidth}
        height={size}
        viewBox="0 0 40 24"
        fill="none"
      >
        <XMarkPaths />
      </svg>
      <span
        style={{
          color: 'currentColor',
          fontSize,
          fontWeight: 600,
          fontFamily: "system-ui, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        }}
      >
        万物智汇
      </span>
    </span>
  )
}
