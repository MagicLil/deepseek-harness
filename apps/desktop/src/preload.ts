/**
 * Electron preload: expose a privileged IPC fetch/loadBundle bridge to the
 * renderer without giving it raw ipcRenderer.
 *
 * The bridge returns only structured-cloneable values — `contextBridge` cannot
 * hand a real `Response` to the page. {@link IpcApiClient} rebuilds Responses.
 * @module @deepseek-ai/dsh-desktop/preload
 */

import { contextBridge, ipcRenderer } from 'electron'
import {
  DSH_APP_MENU_CHANNEL,
  DSH_FETCH_ABORT_CHANNEL,
  DSH_FETCH_CHANNEL,
  DSH_FETCH_CHUNK_CHANNEL,
  DSH_FETCH_END_CHANNEL,
  DSH_LOAD_BUNDLE_CHANNEL,
  DSH_TITLE_BAR_OVERLAY_CHANNEL,
  type AppMenuCommand,
  type DshIpcBridge,
  type IpcFetchChunk,
  type IpcFetchEnd,
  type IpcFetchRequest,
  type IpcFetchResponseHead,
} from './ipc-protocol.ts'

document.addEventListener('click', (event) => {
  if (!event.ctrlKey || event.button !== 0 || event.defaultPrevented) return
  const anchor = event.composedPath().find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement)
  if (anchor === undefined) return
  let url: URL
  try {
    url = new URL(anchor.href)
  } catch {
    return
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.origin === location.origin) return
  event.preventDefault()
  window.open(url.href, '_blank', 'noopener')
}, true)

const bridge: DshIpcBridge = {
  async fetch(request: IpcFetchRequest): Promise<IpcFetchResponseHead> {
    return await ipcRenderer.invoke(DSH_FETCH_CHANNEL, request) as IpcFetchResponseHead
  },
  abortFetch(requestId: string): void {
    ipcRenderer.send(DSH_FETCH_ABORT_CHANNEL, requestId)
  },
  subscribeFetchStream(streamId, onChunk, onEnd) {
    const chunkListener = (_event: Electron.IpcRendererEvent, chunk: IpcFetchChunk): void => {
      if (chunk.streamId !== streamId) return
      onChunk(chunk.data)
    }
    const endListener = (_event: Electron.IpcRendererEvent, end: IpcFetchEnd): void => {
      if (end.streamId !== streamId) return
      ipcRenderer.removeListener(DSH_FETCH_CHUNK_CHANNEL, chunkListener)
      ipcRenderer.removeListener(DSH_FETCH_END_CHANNEL, endListener)
      onEnd(end.error)
    }
    ipcRenderer.on(DSH_FETCH_CHUNK_CHANNEL, chunkListener)
    ipcRenderer.on(DSH_FETCH_END_CHANNEL, endListener)
  },
  async loadBundle(url: string): Promise<void> {
    const source = await ipcRenderer.invoke(DSH_LOAD_BUNDLE_CHANNEL, url) as string
    // Classic script execution so client bundles can call __ModuleLoader__.load.
    const el = document.createElement('script')
    el.text = source
    document.head.append(el)
    el.remove()
  },
  onAppMenu(listener) {
    const handler = (_event: Electron.IpcRendererEvent, command: AppMenuCommand): void => {
      listener(command)
    }
    ipcRenderer.on(DSH_APP_MENU_CHANNEL, handler)
    return () => { ipcRenderer.removeListener(DSH_APP_MENU_CHANNEL, handler) }
  },
  setTitleBarOverlay(colorScheme) {
    ipcRenderer.send(DSH_TITLE_BAR_OVERLAY_CHANNEL, colorScheme)
  },
}

contextBridge.exposeInMainWorld('__DSH_IPC__', bridge)
