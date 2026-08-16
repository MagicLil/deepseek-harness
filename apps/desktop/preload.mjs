/**
 * Preload for Electron's sandboxed renderer.
 *
 * Must stay CommonJS: `webPreferences.sandbox` loads this file as a classic
 * script, so `import` throws `Cannot use import statement outside a module`
 * and `window.__DSH_IPC__` never appears.
 *
 * Returns only structured-cloneable values — the page rebuilds `Response`s.
 */
const { contextBridge, ipcRenderer } = require('electron')

const DSH_FETCH_CHANNEL = 'dsh:fetch'
const DSH_LOAD_BUNDLE_CHANNEL = 'dsh:load-bundle'
const DSH_FETCH_ABORT_CHANNEL = 'dsh:fetch-abort'
const DSH_APP_MENU_CHANNEL = 'dsh:app-menu'
const DSH_TITLE_BAR_OVERLAY_CHANNEL = 'dsh:title-bar-overlay'
const CHUNK_CHANNEL = 'dsh:fetch-chunk'
const END_CHANNEL = 'dsh:fetch-end'

contextBridge.exposeInMainWorld('__DSH_IPC__', {
  async fetch(request) {
    return await ipcRenderer.invoke(DSH_FETCH_CHANNEL, request)
  },
  abortFetch(requestId) {
    ipcRenderer.send(DSH_FETCH_ABORT_CHANNEL, requestId)
  },
  subscribeFetchStream(streamId, onChunk, onEnd) {
    const chunkListener = (_event, chunk) => {
      if (chunk.streamId !== streamId) return
      onChunk(chunk.data)
    }
    const endListener = (_event, end) => {
      if (end.streamId !== streamId) return
      ipcRenderer.removeListener(CHUNK_CHANNEL, chunkListener)
      ipcRenderer.removeListener(END_CHANNEL, endListener)
      onEnd(end.error)
    }
    ipcRenderer.on(CHUNK_CHANNEL, chunkListener)
    ipcRenderer.on(END_CHANNEL, endListener)
  },
  async loadBundle(url) {
    const source = await ipcRenderer.invoke(DSH_LOAD_BUNDLE_CHANNEL, url)
    const el = document.createElement('script')
    el.text = source
    document.head.append(el)
    el.remove()
  },
  onAppMenu(listener) {
    const handler = (_event, command) => { listener(command) }
    ipcRenderer.on(DSH_APP_MENU_CHANNEL, handler)
    return () => { ipcRenderer.removeListener(DSH_APP_MENU_CHANNEL, handler) }
  },
  setTitleBarOverlay(colorScheme) {
    ipcRenderer.send(DSH_TITLE_BAR_OVERLAY_CHANNEL, colorScheme)
  },
})
