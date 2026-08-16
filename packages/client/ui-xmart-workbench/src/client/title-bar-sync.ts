export type TitleBarOverlayBridge = {
  setTitleBarOverlay(colorScheme: 'light' | 'dark'): void
}

type DesktopIpcGlobal = { __DSH_IPC__?: TitleBarOverlayBridge }

export function desktopIpcTitleBar(
  globalThisLike: DesktopIpcGlobal = globalThis as DesktopIpcGlobal,
): TitleBarOverlayBridge | undefined {
  const ipc = globalThisLike.__DSH_IPC__
  if (ipc === undefined || typeof ipc.setTitleBarOverlay !== 'function') return undefined
  return ipc
}

export function syncTitleBarOverlay(
  scheme: 'light' | 'dark',
  ipc: TitleBarOverlayBridge | undefined = desktopIpcTitleBar(),
): void {
  ipc?.setTitleBarOverlay(scheme)
}
