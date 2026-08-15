/**
 * System tray icon: show the window, check for updates, or quit.
 * @module @deepseek-ai/dsh-desktop/tray
 */

import { fileURLToPath } from 'node:url'
import { Menu, Tray, app, nativeImage } from 'electron'
import { desktopIconFilePath, ensureDesktopIconFile } from './icon.ts'
import { markAppQuitting } from './lifecycle.ts'
import { desktopTrayMenuSpec } from './tray-menu.ts'

/** Actions the tray menu invokes. */
export interface DesktopTrayActions {
  /** Restore and focus the main window. */
  show(): void
  /** Manual update check (dialogs belong to the caller). */
  checkUpdates(): void
}

/** Handle returned by {@link createDesktopTray}. */
export interface DesktopTrayHandle {
  /** Remove the tray icon. */
  dispose(): void
}

/**
 * Create the tray icon and bind the context menu.
 * @param actions - show / update callbacks.
 * @returns a disposer that removes the icon.
 */
export function createDesktopTray(actions: DesktopTrayActions): DesktopTrayHandle {
  const packageRoot = fileURLToPath(new URL('..', import.meta.url))
  const iconPath = ensureDesktopIconFile(desktopIconFilePath(packageRoot), app.isPackaged)
  const image = nativeImage.createFromPath(iconPath)
  const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  tray.setToolTip('万物智汇')
  const spec = desktopTrayMenuSpec()
  tray.setContextMenu(Menu.buildFromTemplate(spec.map((item) => {
    if (item.id === 'separator') return { type: 'separator' as const }
    if (item.id === 'show') return { label: item.label, click: () => { actions.show() } }
    if (item.id === 'check-updates') return { label: item.label, click: () => { actions.checkUpdates() } }
    return {
      label: item.label,
      click: () => {
        markAppQuitting()
        app.quit()
      },
    }
  })))
  tray.on('click', () => {
    actions.show()
  })
  tray.on('double-click', () => {
    actions.show()
  })
  return {
    dispose() {
      tray.destroy()
    },
  }
}
