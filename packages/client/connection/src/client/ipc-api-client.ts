/**
 * Electron IPC API carrier: unary and SSE downlink ride `window.__DSH_IPC__`.
 * Leaves WebSocket overrides alone so AbstractApiClient's default SSE path runs.
 *
 * Rebuilds `Response` in the page world — Electron's contextBridge cannot
 * deliver Response/ReadableStream from preload.
 * @module @deepseek-ai/dsh-client-connection/client/ipc-api-client
 */

import { AbstractApiClient } from './api.ts'

/** Minimal bridge shape exposed by the desktop preload script. */
export interface DshIpcFetchBridge {
  fetch(request: {
    url: string
    method?: string
    headers?: Record<string, string>
    body?: string
    requestId?: string
  }): Promise<{
    status: number
    statusText: string
    headers: Record<string, string>
    streamId?: string
    body?: string
  }>
  subscribeFetchStream?(
    streamId: string,
    onChunk: (data: string) => void,
    onEnd: (error?: string) => void,
  ): void
  abortFetch?(requestId: string): void
}

/** Desktop platform subclass: only `doFetch` differs from the in-process client. */
export class IpcApiClient extends AbstractApiClient {
  constructor(private readonly ipc: DshIpcFetchBridge, timeoutMs?: number) {
    super(timeoutMs)
  }

  protected doFetch(input: URL, init?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {}
    if (init?.headers !== undefined) {
      new Headers(init.headers).forEach((value, key) => {
        headers[key] = value
      })
    }
    let body: string | undefined
    if (typeof init?.body === 'string') body = init.body
    else if (init?.body !== undefined && init.body !== null) {
      throw new Error('ipc-api-client: only string request bodies are supported over IPC')
    }
    const requestId = crypto.randomUUID()
    const request: {
      url: string
      method?: string
      headers?: Record<string, string>
      body?: string
      requestId?: string
    } = { url: input.href, headers, requestId }
    if (init?.method !== undefined) request.method = init.method
    if (body !== undefined) request.body = body
    const signal = init?.signal
    if (signal?.aborted === true) {
      this.ipc.abortFetch?.(requestId)
      return Promise.reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'))
    }
    const onAbort = (): void => {
      this.ipc.abortFetch?.(requestId)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    return this.ipc.fetch(request).then(head => this.responseFromHead(head, requestId, signal, onAbort))
  }

  /**
   * Rebuild a Fetch Response from the serializable IPC head.
   * @param head - status/headers and either a full body or a stream id.
   * @param requestId - abort correlation id.
   * @param signal - optional caller cancellation.
   * @param onAbort - listener to detach when the stream settles.
   */
  private responseFromHead(
    head: {
      status: number
      statusText: string
      headers: Record<string, string>
      streamId?: string
      body?: string
    },
    requestId: string,
    signal: AbortSignal | undefined,
    onAbort: () => void,
  ): Response {
    const headers = new Headers(head.headers)
    if (head.streamId === undefined) {
      signal?.removeEventListener('abort', onAbort)
      return new Response(head.body ?? '', {
        status: head.status,
        statusText: head.statusText,
        headers,
      })
    }
    const streamId = head.streamId
    const subscribe = this.ipc.subscribeFetchStream
    if (subscribe === undefined) {
      signal?.removeEventListener('abort', onAbort)
      throw new Error('ipc-api-client: streaming response requires subscribeFetchStream on the IPC bridge')
    }
    const abortFetch = this.ipc.abortFetch
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        subscribe(
          streamId,
          (data) => {
            controller.enqueue(Uint8Array.from(atob(data), c => c.charCodeAt(0)))
          },
          (error) => {
            signal?.removeEventListener('abort', onAbort)
            if (error !== undefined) {
              controller.error(new Error(error))
              return
            }
            controller.close()
          },
        )
      },
      cancel() {
        signal?.removeEventListener('abort', onAbort)
        abortFetch?.(requestId)
      },
    })
    return new Response(body, {
      status: head.status,
      statusText: head.statusText,
      headers,
    })
  }
}
