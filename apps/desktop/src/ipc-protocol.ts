/**
 * Shared IPC wire shapes between Electron main and the preload bridge.
 * @module @deepseek-ai/dsh-desktop/ipc-protocol
 */

/** Channel that carries one unary or streaming fetch round-trip. */
export const DSH_FETCH_CHANNEL = 'dsh:fetch' as const

/** Channel that loads one client-plugin bundle URL for the module system. */
export const DSH_LOAD_BUNDLE_CHANNEL = 'dsh:load-bundle' as const

/** Chunk events for SSE-over-IPC bodies. */
export const DSH_FETCH_CHUNK_CHANNEL = 'dsh:fetch-chunk' as const

/** End events for SSE-over-IPC bodies. */
export const DSH_FETCH_END_CHANNEL = 'dsh:fetch-end' as const

/** Renderer → main: abort one in-flight IPC fetch (unary or stream). */
export const DSH_FETCH_ABORT_CHANNEL = 'dsh:fetch-abort' as const

/** Serializable RequestInit subset the preload sends to main. */
export interface IpcFetchRequest {
  /** Absolute or origin-relative URL (may use the http://dsh.internal fake authority). */
  url: string
  method?: string
  headers?: Record<string, string>
  /** UTF-8 body text when present. */
  body?: string
  /** Correlates this request with a later {@link DSH_FETCH_ABORT_CHANNEL} send. */
  requestId?: string
}

/** First IPC reply for a fetch: headers plus either a full body or a stream id. */
export interface IpcFetchResponseHead {
  status: number
  statusText: string
  headers: Record<string, string>
  /**
   * When set, subsequent `dsh:fetch-chunk` / `dsh:fetch-end` events deliver the
   * body; otherwise `body` holds the complete UTF-8 payload.
   */
  streamId?: string
  body?: string
}

/** One streamed body chunk from main to the renderer. */
export interface IpcFetchChunk {
  streamId: string
  /** Base64-encoded bytes. */
  data: string
}

/** Marks the end of a streamed body (optionally with an error message). */
export interface IpcFetchEnd {
  streamId: string
  error?: string
}

/**
 * Preload → renderer bridge installed as `window.__DSH_IPC__`.
 *
 * Returns only structured-cloneable values: Electron's `contextBridge` cannot
 * deliver a real `Response` / `ReadableStream` into the page world.
 */
export interface DshIpcBridge {
  fetch(request: IpcFetchRequest): Promise<IpcFetchResponseHead>
  /**
   * Subscribe to one streamed body. Callbacks run in the renderer.
   * @param streamId - id from {@link IpcFetchResponseHead.streamId}.
   * @param onChunk - base64 body chunk.
   * @param onEnd - optional error message when the stream fails.
   */
  subscribeFetchStream(
    streamId: string,
    onChunk: (data: string) => void,
    onEnd: (error?: string) => void,
  ): void
  /** Abort the main-process fetch identified by `requestId`. */
  abortFetch(requestId: string): void
  loadBundle(url: string): Promise<void>
}
