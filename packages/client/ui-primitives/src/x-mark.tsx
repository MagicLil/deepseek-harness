// 万物智汇 / x-mart mark: two diagonal bars, evenodd overlap = diamond void.
// Geometry traced from D:\work\company\anruisen\xmart-web\apps\web\public\default-logo.png.

import type { IconProps } from './icons/props.ts'

/** Official lockup green (sampled from default-logo.png). */
export const XMART_GREEN = '#5BB73B'

/** Native mark box (wider than tall, matches the source X). */
export const X_MARK_VIEWBOX = '0 0 40 24'

/** Evenodd path: `\` bar then `/` bar. */
export const X_MARK_PATH = 'M3 0h9l25 24H28zM28 0h9L12 24H3z'

/**
 * The green X paths (no svg wrapper).
 * @returns the evenodd mark group.
 */
export function XMarkPaths() {
  return (
    <g fill={XMART_GREEN} fillRule="evenodd">
      <path d={X_MARK_PATH} />
    </g>
  )
}

/**
 * Square-framed X for rail / hero / favicon-like slots.
 * @param props.size - edge in px (default 24).
 * @param props.className - layout class.
 * @returns the mark svg.
 */
export function XMark({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <g transform="translate(0 8)">
        <XMarkPaths />
      </g>
    </svg>
  )
}
