import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import { spawnSubprocess } from '@deepseek-ai/dsh-subprocess-local/src/spawn.ts'
import { scrubbedParentEnv } from '@deepseek-ai/dsh-subprocess'
import { VueLspPool } from '../src/provider.ts'
import { fixtureRuntime } from './helpers.ts'

let root: string
let ws: string
let ctx: Context
let pool: VueLspPool | undefined

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'lsp-vue-pool-')))
  ws = join(root, 'ws')
  await mkdir(ws)
  await writeFile(join(ws, 'App.vue'), '<template><div /></template>\n')
  ctx = new Context()
  await ctx.plugin(LocalFileSystem, { cwd: root })
})

afterEach(async () => {
  await pool?.disposeAll()
  pool = undefined
  await ctx.fiber.dispose()
  await rm(root, { recursive: true, force: true })
})

function makePool(env: Record<string, string> = {}): VueLspPool {
  pool = new VueLspPool({
    fs: ctx.fs,
    spawn: spawnSubprocess,
    runtime: fixtureRuntime(),
    env: { ...scrubbedParentEnv(), ...env },
  })
  return pool
}

describe('VueLspPool', () => {
  it('warms a session without opening a buffer', async () => {
    const created = makePool()
    await created.warmup(ws)
    expect(await created.diagnostics(ws, 'App.vue')).toEqual([])
  })

  it('opens a buffer, returns diagnostics and completions, then queries hover', async () => {
    const created = makePool({
      LSP_FAKE_DIAGNOSTICS: JSON.stringify([{
        message: 'x',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      }]),
      LSP_FAKE_HOVER: JSON.stringify({ contents: 'hi' }),
    })
    await created.open(ws, 'App.vue', '<template />', new AbortController().signal)
    await new Promise((resolve) => { setTimeout(resolve, 50) })
    expect((await created.diagnostics(ws, 'App.vue'))[0]?.message).toBe('x')
    expect((await created.complete(ws, 'App.vue', 0, 1))[0]?.label).toBe('Foo')
    await created.change(ws, 'App.vue', '<template><p /></template>')
    const hover = await created.query({
      operation: 'hover',
      filePath: 'App.vue',
      position: { line: 0, character: 1 },
      workspaceRoot: ws,
      languageId: 'vue',
    })
    expect(hover).toEqual({ kind: 'hover', hover: { contents: 'hi' } })
    expect(await created.navigate('hover', ws, 'App.vue', 0, 1)).toEqual({
      kind: 'hover', hover: { contents: 'hi' },
    })
    await created.close(ws, 'App.vue')
  })

  it('exposes a .vue-only provider and refuses work after dispose', async () => {
    const created = makePool()
    const provider = created.asProvider()
    expect(provider.extensionToLanguage).toEqual({ '.vue': 'vue' })
    await created.disposeAll()
    await expect(created.open(ws, 'App.vue', 'x')).rejects.toThrow(/disposed/)
  })

  it('transient-opens a disk source for an agent query', async () => {
    const created = makePool({
      LSP_FAKE_HOVER: JSON.stringify({ contents: 'disk' }),
    })
    const hover = await created.asProvider().query({
      operation: 'hover',
      filePath: 'App.vue',
      position: { line: 0, character: 0 },
      workspaceRoot: ws,
      languageId: 'vue',
    })
    expect(hover).toEqual({ kind: 'hover', hover: { contents: 'disk' } })
  })

  it('refuses an already-aborted signal and resolves the bundled Vue runtime', async () => {
    const created = makePool()
    const controller = new AbortController()
    controller.abort()
    await expect(created.open(ws, 'App.vue', 'x', controller.signal)).rejects.toThrow(/aborted|disposed/)
    const live = new VueLspPool({
      fs: ctx.fs,
      spawn: spec => spawnSubprocess({
        ...spec,
        argv: [process.execPath, fixtureRuntime().bin],
        env: { ...spec.env, LSP_FAKE_HOVER: JSON.stringify({ contents: 'rt' }) },
      }),
    })
    pool = live
    const hover = await live.query({
      operation: 'hover',
      filePath: 'App.vue',
      position: { line: 0, character: 0 },
      workspaceRoot: ws,
      languageId: 'vue',
    })
    expect(hover).toEqual({ kind: 'hover', hover: { contents: 'rt' } })
  })
})
