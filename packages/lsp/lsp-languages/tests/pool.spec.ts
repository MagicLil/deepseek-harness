import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import { spawnSubprocess } from '@deepseek-ai/dsh-subprocess-local/src/spawn.ts'
import { LspProviderId } from '@deepseek-ai/dsh-lsp'
import { PersistentLspPool } from '../src/pool.ts'
import { TS_EXTENSION_TO_LANGUAGE } from '../src/protocol.ts'
import { typescriptSessionLaunch } from '../src/resolve-typescript.ts'
import { fixtureServer, makePool } from './helpers.ts'

let root: string
let ws: string
let ctx: Context
let pool: PersistentLspPool | undefined

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'lsp-lang-pool-')))
  ws = join(root, 'ws')
  await mkdir(ws)
  await writeFile(join(ws, 'app.ts'), 'const x = 1\n')
  await writeFile(join(ws, 'Foo.java'), 'class Foo {}\n')
  ctx = new Context()
  await ctx.plugin(LocalFileSystem, { cwd: root })
})

afterEach(async () => {
  await pool?.disposeAll()
  pool = undefined
  await ctx.fiber.dispose()
  await rm(root, { recursive: true, force: true })
})

describe('PersistentLspPool', () => {
  it('opens a buffer, returns diagnostics and completions, then queries hover', async () => {
    const created = makePool(ctx.fs, {
      LSP_FAKE_DIAGNOSTICS: JSON.stringify([{
        message: 'x',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      }]),
      LSP_FAKE_HOVER: JSON.stringify({ contents: 'hi' }),
    })
    pool = created
    await created.open(ws, 'app.ts', 'const x = 1', new AbortController().signal)
    await new Promise((resolve) => { setTimeout(resolve, 50) })
    expect((await created.diagnostics(ws, 'app.ts'))[0]?.message).toBe('x')
    expect((await created.complete(ws, 'app.ts', 0, 1))[0]?.label).toBe('Foo')
    await created.change(ws, 'app.ts', 'const x = 2')
    const hover = await created.query({
      operation: 'hover',
      filePath: 'app.ts',
      position: { line: 0, character: 1 },
      workspaceRoot: ws,
      languageId: 'typescript',
    })
    expect(hover).toEqual({ kind: 'hover', hover: { contents: 'hi' } })
    await created.close(ws, 'app.ts')
  })

  it('exposes a TypeScript provider and refuses work after dispose', async () => {
    const created = makePool(ctx.fs)
    pool = created
    const provider = created.asProvider()
    expect(provider.extensionToLanguage['.ts']).toBe('typescript')
    expect(provider.id).toBe(LspProviderId('typescript'))
    await created.disposeAll()
    await expect(created.open(ws, 'app.ts', 'x')).rejects.toThrow(/disposed/)
  })

  it('hosts a Java pool against the same fixture protocol', async () => {
    const created = makePool(ctx.fs, {
      LSP_FAKE_HOVER: JSON.stringify({ contents: 'java' }),
    }, 'java')
    pool = created
    expect(created.extensionToLanguage).toEqual({ '.java': 'java' })
    const hover = await created.asProvider().query({
      operation: 'hover',
      filePath: 'Foo.java',
      position: { line: 0, character: 0 },
      workspaceRoot: ws,
      languageId: 'java',
    })
    expect(hover).toEqual({ kind: 'hover', hover: { contents: 'java' } })
  })

  it('transient-opens a disk source for an agent query', async () => {
    const created = makePool(ctx.fs, {
      LSP_FAKE_HOVER: JSON.stringify({ contents: 'disk' }),
    })
    pool = created
    const hover = await created.asProvider().query({
      operation: 'hover',
      filePath: 'app.ts',
      position: { line: 0, character: 0 },
      workspaceRoot: ws,
      languageId: 'typescript',
    })
    expect(hover).toEqual({ kind: 'hover', hover: { contents: 'disk' } })
  })

  it('refuses an already-aborted signal and resolves the bundled TypeScript runtime', async () => {
    const created = makePool(ctx.fs)
    pool = created
    const controller = new AbortController()
    controller.abort()
    await expect(created.open(ws, 'app.ts', 'x', controller.signal)).rejects.toThrow(/aborted|disposed/)
    const live = new PersistentLspPool({
      id: LspProviderId('typescript'),
      extensionToLanguage: TS_EXTENSION_TO_LANGUAGE,
      fs: ctx.fs,
      spawn: spec => spawnSubprocess({
        ...spec,
        argv: [process.execPath, fixtureServer],
        env: { ...spec.env, LSP_FAKE_HOVER: JSON.stringify({ contents: 'rt' }) },
      }),
      launch: async () => typescriptSessionLaunch(),
    })
    pool = live
    const hover = await live.query({
      operation: 'hover',
      filePath: 'app.ts',
      position: { line: 0, character: 0 },
      workspaceRoot: ws,
      languageId: 'typescript',
    })
    expect(hover).toEqual({ kind: 'hover', hover: { contents: 'rt' } })
  })
})
