/**
 * host.readFileBytes returns base64 plus a MIME guess for image preview.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import type { RpcRequest } from '@deepseek-ai/dsh-host-apiproxy/api'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { IMAGE_FILE_MAX_BYTES } from '../src/image-mime.ts'
import { createApiProxy } from '../src/api-proxy.ts'

let nextRpc = 1
function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`read-bytes-${String(nextRpc++)}`), payload }
}

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function harness() {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(AgentRegistry)
  return createApiProxy(ctx, { defaultModelSelection: () => ({ provider: 'p', model: 'm' }), cwd: '/tmp' })
}

describe('host.readFileBytes', () => {
  it('returns base64 and a MIME guess, including NUL bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-read-bytes-'))
    roots.push(root)
    const path = join(root, 'a.png')
    const raw = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0a])
    await writeFile(path, raw)
    const api = await harness()
    const response = await api.host.readFileBytes(request({ path }), new AbortController().signal)
    expect(response.result.ok).toBe(true)
    if (!response.result.ok) return
    expect(response.result.value.mimeType).toBe('image/png')
    expect(Buffer.from(response.result.value.contentBase64, 'base64')).toEqual(raw)
  })

  it('maps a missing path to file-unreadable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-read-bytes-miss-'))
    roots.push(root)
    const api = await harness()
    const response = await api.host.readFileBytes(
      request({ path: join(root, 'gone.png') }),
      new AbortController().signal,
    )
    expect(response.result.ok).toBe(false)
    if (response.result.ok) return
    expect(response.result.error.code).toBe('file-unreadable')
  })

  it('refuses a file past the image preview bound', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-read-bytes-big-'))
    roots.push(root)
    const path = join(root, 'big.bin')
    await writeFile(path, Buffer.alloc(IMAGE_FILE_MAX_BYTES + 1))
    const api = await harness()
    const response = await api.host.readFileBytes(request({ path }), new AbortController().signal)
    expect(response.result.ok).toBe(false)
    if (response.result.ok) return
    expect(response.result.error.code).toBe('file-too-large')
  })

  it('maps an aborted read to cancelled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-read-bytes-abort-'))
    roots.push(root)
    const path = join(root, 'a.png')
    await writeFile(path, Buffer.from([1, 2, 3]))
    const api = await harness()
    const signal = AbortSignal.abort()
    const response = await api.host.readFileBytes(request({ path }), signal)
    expect(response.result.ok).toBe(false)
    if (response.result.ok) return
    expect(response.result.error.code).toBe('cancelled')
  })

  it('maps a directory read to file-unreadable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-read-bytes-dir-'))
    roots.push(root)
    const path = join(root, 'folder')
    await mkdir(path)
    const api = await harness()
    const response = await api.host.readFileBytes(request({ path }), new AbortController().signal)
    expect(response.result.ok).toBe(false)
    if (response.result.ok) return
    expect(response.result.error.code).toBe('file-unreadable')
  })
})
