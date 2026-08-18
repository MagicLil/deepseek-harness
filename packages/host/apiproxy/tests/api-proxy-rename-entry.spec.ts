/**
 * host.renameEntry / host.deleteEntry mutate one tree row for the
 * workbench explorer. Rename stays in the same parent (one path segment);
 * delete removes a file or a directory tree. UI-only — not an agent tool.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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
  return { rpcId: RpcId(`entry-${String(nextRpc++)}`), payload }
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

describe('host.renameEntry', () => {
  it('renames a file in the same directory and keeps the contents', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-rename-file-'))
    roots.push(root)
    const path = join(root, 'old.txt')
    await writeFile(path, 'keep\n', 'utf8')
    const api = await harness()
    const response = await api.host.renameEntry(request({ path, name: 'new.txt' }))
    expect(response.result.ok).toBe(true)
    if (!response.result.ok) throw new Error('unreachable')
    expect(response.result.value.path).toBe(join(root, 'new.txt'))
    expect(await readFile(response.result.value.path, 'utf8')).toBe('keep\n')
    await expect(readFile(path, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('renames a directory and keeps its children', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-rename-dir-'))
    roots.push(root)
    const path = join(root, 'src')
    await mkdir(path)
    await writeFile(join(path, 'a.ts'), 'export {}\n', 'utf8')
    const api = await harness()
    const response = await api.host.renameEntry(request({ path, name: 'lib' }))
    expect(response.result.ok).toBe(true)
    if (!response.result.ok) throw new Error('unreachable')
    expect(await readFile(join(response.result.value.path, 'a.ts'), 'utf8')).toBe('export {}\n')
  })

  it('returns the same path when the name is unchanged', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-rename-same-'))
    roots.push(root)
    const path = join(root, 'note.txt')
    await writeFile(path, 'x\n', 'utf8')
    const api = await harness()
    const response = await api.host.renameEntry(request({ path, name: 'note.txt' }))
    expect(response.result.ok).toBe(true)
    if (!response.result.ok) throw new Error('unreachable')
    expect(response.result.value.path).toBe(path)
    expect(await readFile(path, 'utf8')).toBe('x\n')
  })

  it('refuses a destination that already exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-rename-exists-'))
    roots.push(root)
    const path = join(root, 'a.txt')
    await writeFile(path, 'a\n', 'utf8')
    await writeFile(join(root, 'b.txt'), 'b\n', 'utf8')
    const api = await harness()
    const response = await api.host.renameEntry(request({ path, name: 'b.txt' }))
    expect(response.result.ok).toBe(false)
    if (response.result.ok) throw new Error('unreachable')
    expect(response.result.error.code).toBe('file-exists')
    expect(await readFile(path, 'utf8')).toBe('a\n')
  })

  it.skipIf(process.platform !== 'win32')('renames with only a case change on Windows', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-rename-case-'))
    roots.push(root)
    const path = join(root, 'Note.txt')
    await writeFile(path, 'keep\n', 'utf8')
    const api = await harness()
    const response = await api.host.renameEntry(request({ path, name: 'note.txt' }))
    expect(response.result.ok).toBe(true)
    if (!response.result.ok) throw new Error('unreachable')
    expect(response.result.value.path.toLowerCase()).toBe(join(root, 'note.txt').toLowerCase())
    expect(await readFile(response.result.value.path, 'utf8')).toBe('keep\n')
  })

  it('refuses a missing source', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-rename-missing-'))
    roots.push(root)
    const api = await harness()
    const response = await api.host.renameEntry(request({ path: join(root, 'gone.txt'), name: 'x.txt' }))
    expect(response.result.ok).toBe(false)
    if (response.result.ok) throw new Error('unreachable')
    expect(response.result.error.code).toBe('file-unreadable')
  })
})

describe('host.deleteEntry', () => {
  it('deletes a file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-delete-file-'))
    roots.push(root)
    const path = join(root, 'gone.txt')
    await writeFile(path, 'bye\n', 'utf8')
    const api = await harness()
    const response = await api.host.deleteEntry(request({ path }))
    expect(response.result.ok).toBe(true)
    if (!response.result.ok) throw new Error('unreachable')
    expect(response.result.value.path).toBe(path)
    await expect(readFile(path, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('deletes a directory tree', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-delete-dir-'))
    roots.push(root)
    const path = join(root, 'src')
    await mkdir(join(path, 'nested'), { recursive: true })
    await writeFile(join(path, 'nested', 'a.ts'), 'export {}\n', 'utf8')
    const api = await harness()
    const response = await api.host.deleteEntry(request({ path }))
    expect(response.result.ok).toBe(true)
    await expect(readFile(join(path, 'nested', 'a.ts'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses a missing path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-delete-missing-'))
    roots.push(root)
    const api = await harness()
    const response = await api.host.deleteEntry(request({ path: join(root, 'gone.txt') }))
    expect(response.result.ok).toBe(false)
    if (response.result.ok) throw new Error('unreachable')
    expect(response.result.error.code).toBe('file-unreadable')
  })
})
