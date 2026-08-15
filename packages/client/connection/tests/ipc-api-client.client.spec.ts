import { describe, expect, it, vi } from 'vitest'
import { IpcApiClient } from '../src/client/ipc-api-client.ts'

describe('IpcApiClient', () => {
  it('forwards doFetch to the IPC bridge and rebuilds a Response', async () => {
    const fetch = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
    }))
    const client = new IpcApiClient({ fetch })
    const response = await (client as unknown as {
      doFetch(input: URL, init?: RequestInit): Promise<Response>
    }).doFetch(new URL('http://dsh.internal/api/session.list'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"type":"client-request"}',
    })
    expect(fetch).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://dsh.internal/api/session.list',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"type":"client-request"}',
      requestId: expect.any(String),
    }))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"ok":true}')
  })

  it('rebuilds streaming bodies through subscribeFetchStream', async () => {
    const fetch = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/event-stream' },
      streamId: 's1',
    }))
    const subscribeFetchStream = vi.fn((streamId: string, onChunk: (data: string) => void, onEnd: (error?: string) => void) => {
      expect(streamId).toBe('s1')
      onChunk(btoa('data: hi\n\n'))
      onEnd()
    })
    const client = new IpcApiClient({ fetch, subscribeFetchStream })
    const response = await (client as unknown as {
      doFetch(input: URL, init?: RequestInit): Promise<Response>
    }).doFetch(new URL('http://dsh.internal/api/events/mux'))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('data: hi\n\n')
  })

  it('aborts an already-cancelled signal without calling fetch', async () => {
    const fetch = vi.fn()
    const abortFetch = vi.fn()
    const client = new IpcApiClient({ fetch, abortFetch })
    const signal = AbortSignal.abort()
    await expect((client as unknown as {
      doFetch(input: URL, init?: RequestInit): Promise<Response>
    }).doFetch(new URL('http://dsh.internal/api/events.mux'), { signal })).rejects.toBeDefined()
    expect(fetch).not.toHaveBeenCalled()
    expect(abortFetch).toHaveBeenCalledOnce()
  })

  it('forwards stream cancel to abortFetch', async () => {
    const fetch = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/event-stream' },
      streamId: 's2',
    }))
    const abortFetch = vi.fn()
    const subscribeFetchStream = vi.fn()
    const client = new IpcApiClient({ fetch, abortFetch, subscribeFetchStream })
    const response = await (client as unknown as {
      doFetch(input: URL, init?: RequestInit): Promise<Response>
    }).doFetch(new URL('http://dsh.internal/api/events.mux'))
    await response.body?.cancel()
    expect(abortFetch).toHaveBeenCalledOnce()
  })
})
