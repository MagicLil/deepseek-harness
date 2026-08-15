/**
 * Tray context-menu labels, kept Electron-free so the order can be unit-tested.
 * @module @deepseek-ai/dsh-desktop/tray-menu
 */

/** One tray row: an action, or a separator. */
export type TrayMenuItem =
  | { id: 'show' | 'check-updates' | 'quit'; label: string }
  | { id: 'separator' }

/**
 * Context menu for the desktop tray icon.
 * @returns items in display order.
 */
export function desktopTrayMenuSpec(): TrayMenuItem[] {
  return [
    { id: 'show', label: 'Show xmart' },
    { id: 'check-updates', label: 'Check for Updates' },
    { id: 'separator' },
    { id: 'quit', label: 'Quit' },
  ]
}
