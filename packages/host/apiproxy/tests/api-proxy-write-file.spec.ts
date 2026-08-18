/**
 * host.writeFile replaces a document through writeFileAtomic (sibling temp +
 * rename). Crash atomicity lives in that primitive; this spec pins the
 * gateway contract: complete replacement, no leftover temps, parent must exist.
 */
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import type { RpcRequest } from '@deepseek-ai/dsh-host-apiproxy/api'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '../src/api-proxy.ts'

let nextRpc = 1
function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`write-file-${String(nextRpc++)}`), payload }
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

describe('host.writeFile', () => {
  it('replaces an existing file with the new complete content and leaves no tmp sibling', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-write-ok-'))
    roots.push(root)
    const path = join(root, 'note.txt')
    await writeFile(path, 'old\n', 'utf8')
    const api = await harness()
    const response = await api.host.writeFile(request({ path, content: 'new-complete\n' }))
    expect(response.result.ok).toBe(true)
    expect(await readFile(path, 'utf8')).toBe('new-complete\n')
    expect((await readdir(root)).filter(name => name.endsWith('.tmp'))).toEqual([])
  })

  it('refuses a missing parent directory instead of creating it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-write-parent-'))
    roots.push(root)
    const path = join(root, 'missing', 'note.txt')
    const api = await harness()
    const response = await api.host.writeFile(request({ path, content: 'nope\n' }))
    expect(response.result.ok).toBe(false)
    if (response.result.ok) throw new Error('unreachable')
    expect(response.result.error.code).toBe('file-write-failed')
  })

  it('creates a new file when the parent already exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-write-new-'))
    roots.push(root)
    await mkdir(join(root, 'src'))
    const path = join(root, 'src', 'fresh.ts')
    const api = await harness()
    const response = await api.host.writeFile(request({ path, content: 'export {}\n' }))
    expect(response.result.ok).toBe(true)
    expect(await readFile(path, 'utf8')).toBe('export {}\n')
  })
})
