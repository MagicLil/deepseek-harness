/**
 * electron-updater wiring for a packaged NSIS install.
 * Source launches and portable exes skip the check.
 * Downloads wait for an explicit yes; a hidden window gets a toast first.
 * @module @deepseek-ai/dsh-desktop/auto-update
 */

import { BrowserWindow, Notification, app, dialog } from 'electron'
import electronUpdater from 'electron-updater'
import { markAppQuitting } from './lifecycle.ts'
import { resolveUpdateFeed } from './update-feed.ts'
import { isPortableInstall, resolveAutoUpdateGate, updatePromptSurface } from './update-policy.ts'

const { autoUpdater } = electronUpdater

const APP_TITLE = 'xmart'

let started = false
/** True while a tray-initiated check owns the prompt (avoids a second dialog). */
let suppressAvailableEvent = false
/** Versions the user already declined this session (background check only). */
const declined = new Set<string>()

/**
 * Apply an optional env feed override and start the background check.
 * @param parent - window that owns update dialogs.
 */
export function startDesktopAutoUpdate(parent: BrowserWindow): void {
  const gate = resolveAutoUpdateGate({
    isPackaged: app.isPackaged,
    portable: isPortableInstall(process.env),
  })
  if (!gate.ok || started) return
  started = true
  applyFeedOverride()
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('error', (error) => {
    console.error('dsh desktop: auto-update', error)
  })
  autoUpdater.on('update-available', (info) => {
    if (suppressAvailableEvent) return
    void offerDownload(parent, info.version, { force: false })
  })
  autoUpdater.on('update-downloaded', (info) => {
    void offerInstall(parent, info.version)
  })
  void autoUpdater.checkForUpdates().catch((error: unknown) => {
    console.error('dsh desktop: auto-update check failed', error)
  })
}

/**
 * Tray "Check for Updates": report available / current / failure.
 * @param parent - window that owns the dialog.
 */
export async function checkDesktopUpdatesNow(parent: BrowserWindow): Promise<void> {
  if (!parent.isDestroyed() && !parent.isVisible()) {
    parent.show()
    parent.focus()
  }
  const gate = resolveAutoUpdateGate({
    isPackaged: app.isPackaged,
    portable: isPortableInstall(process.env),
  })
  if (!gate.ok) {
    await showNotice(parent, {
      type: 'info',
      message: gate.reason === 'portable'
        ? '便携版不支持自动更新。请下载新的安装包覆盖运行。'
        : '只有安装版才会检查更新。',
      detail: gate.reason === 'unpackaged'
        ? '当前窗口是从仓库启动的（`dsh desktop`）。'
        : '自动更新只服务 NSIS 安装版。',
    })
    return
  }
  applyFeedOverride()
  autoUpdater.autoDownload = false
  suppressAvailableEvent = true
  try {
    const result = await autoUpdater.checkForUpdates()
    const current = app.getVersion()
    const next = result?.updateInfo.version
    if (next === undefined || next === current) {
      await showNotice(parent, {
        type: 'info',
        message: '已是最新版本。',
        detail: `当前安装是 ${current}。`,
      })
      return
    }
    await offerDownload(parent, next, { force: true })
  } catch (error) {
    await showNotice(parent, {
      type: 'warning',
      message: '无法检查更新。',
      detail: error instanceof Error ? error.message : String(error),
    })
  } finally {
    suppressAvailableEvent = false
  }
}

/** Point electron-updater at `DSH_UPDATE_FEED_URL` / `DSH_UPDATE_GITHUB` when set. */
function applyFeedOverride(): void {
  const feed = resolveUpdateFeed(process.env)
  if (feed === undefined) return
  if (feed.provider === 'generic') {
    autoUpdater.setFeedURL({ provider: 'generic', url: feed.url })
    return
  }
  autoUpdater.setFeedURL({ provider: 'github', owner: feed.owner, repo: feed.repo })
}

/**
 * Ask whether to download. Hidden windows get a toast; click opens the dialog.
 * @param parent - dialog parent.
 * @param version - available semver.
 * @param options.force - tray "Check for Updates" re-asks even after Later.
 */
async function offerDownload(
  parent: BrowserWindow,
  version: string,
  options: { force: boolean },
): Promise<void> {
  if (!options.force && declined.has(version)) return
  const accepted = await confirmChoice(parent, {
    message: `发现新版本 ${version}。`,
    detail: '现在下载？下载完成后再问是否重启安装。',
    ok: '下载',
    cancel: '以后再说',
  })
  if (!accepted) {
    declined.add(version)
    return
  }
  declined.delete(version)
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    await showNotice(parent, {
      type: 'warning',
      message: '下载更新失败。',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Ask whether to restart into the downloaded installer.
 * @param parent - dialog parent.
 * @param version - downloaded semver.
 */
async function offerInstall(parent: BrowserWindow, version: string): Promise<void> {
  const accepted = await confirmChoice(parent, {
    message: `版本 ${version} 已下载完成。`,
    detail: '现在重启以完成安装？',
    ok: '重启',
    cancel: '以后再说',
  })
  if (!accepted) return
  markAppQuitting()
  autoUpdater.quitAndInstall()
}

function windowIsUsable(parent: BrowserWindow): boolean {
  return !parent.isDestroyed() && parent.isVisible()
}

async function confirmChoice(
  parent: BrowserWindow,
  spec: { message: string; detail: string; ok: string; cancel: string },
): Promise<boolean> {
  if (updatePromptSurface(windowIsUsable(parent)) === 'notification') {
    const opened = await waitForToastClick(spec.message, spec.detail)
    if (!opened || parent.isDestroyed()) return false
    parent.show()
    parent.focus()
  }
  if (parent.isDestroyed()) return false
  const choice = await dialog.showMessageBox(parent, {
    type: 'info',
    buttons: [spec.ok, spec.cancel],
    defaultId: 0,
    cancelId: 1,
    title: APP_TITLE,
    message: spec.message,
    detail: spec.detail,
  })
  return choice.response === 0
}

async function showNotice(
  parent: BrowserWindow,
  spec: { type: 'info' | 'warning'; message: string; detail: string },
): Promise<void> {
  if (updatePromptSurface(windowIsUsable(parent)) === 'notification') {
    notify(spec.message, spec.detail, () => {
      if (parent.isDestroyed()) return
      parent.show()
      parent.focus()
    })
    return
  }
  await dialog.showMessageBox(parent, {
    type: spec.type,
    title: APP_TITLE,
    message: spec.message,
    detail: spec.detail,
  })
}

/**
 * Show a toast and resolve true if the user clicks it.
 * Dismissing the toast (or no Notification API) is Later.
 */
function waitForToastClick(body: string, detail: string): Promise<boolean> {
  if (!Notification.isSupported()) return Promise.resolve(false)
  return new Promise((resolve) => {
    let settled = false
    const finish = (clicked: boolean): void => {
      if (settled) return
      settled = true
      resolve(clicked)
    }
    const toast = new Notification({ title: APP_TITLE, body: `${body} ${detail}`.trim() })
    toast.on('click', () => {
      finish(true)
    })
    toast.on('close', () => {
      finish(false)
    })
    toast.show()
  })
}

function notify(body: string, detail: string, onClick: () => void): void {
  if (!Notification.isSupported()) return
  const toast = new Notification({ title: APP_TITLE, body: `${body} ${detail}`.trim() })
  toast.on('click', onClick)
  toast.show()
}

/** One-time close-to-tray explanation. */
export function showCloseToTrayHint(): void {
  notify('仍在托盘运行。', '要从托盘图标右键菜单选择「退出」才会关闭。', () => {
    /* tray click already restores the window */
  })
}
