/** L2 activity-bar glyphs (not added to ui-primitives). */

/** Puzzle-piece glyph for the Plugins activity. */
export function PluginsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6.2 1.6c.9 0 1.6.7 1.6 1.6v.6h2.4c.7 0 1.2.5 1.2 1.2v2.4h.6c.9 0 1.6.7 1.6 1.6s-.7 1.6-1.6 1.6h-.6v2.4c0 .7-.5 1.2-1.2 1.2H7.8v-.6c0-.9-.7-1.6-1.6-1.6S4.6 12.3 4.6 13.2v.6H2.8c-.7 0-1.2-.5-1.2-1.2V9.6h.6c.9 0 1.6-.7 1.6-1.6S3.1 6.4 2.2 6.4h-.6V4c0-.7.5-1.2 1.2-1.2h2.4V3.2c0-.9.7-1.6 1.6-1.6Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Blocks glyph for the Extensions activity. */
export function ExtensionsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 2h5.2v5.2H2V2Zm6.8 0H14v5.2H8.8V2ZM2 8.8h5.2V14H2V8.8Zm6.8 0H14V14H8.8V8.8Z"
        fill="currentColor"
      />
    </svg>
  )
}
