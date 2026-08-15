/**
 * Plain ESM preload for Electron (must not require a prior TypeScript build).
 * Mirrors apps/desktop/src/preload.ts channel names.
 *
 * Returns only structured-cloneable values — the page rebuilds `Response`s.
 */
import { contextBridge, ipcRenderer } from 'electron'

const DSH_FETCH_CHANNEL = 'dsh:fetch'
const DSH_LOAD_BUNDLE_CHANNEL = 'dsh:load-bundle'
const DSH_FETCH_ABORT_CHANNEL = 'dsh:fetch-abort'
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
})
