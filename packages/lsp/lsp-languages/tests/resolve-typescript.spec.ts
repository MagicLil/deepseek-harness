import { describe, expect, it } from 'vitest'
import { dirname, join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import {
  resolveTypescriptRuntime,
  typescriptServerArgv,
  typescriptSessionLaunch,
} from '../src/resolve-typescript.ts'

describe('resolveTypescriptRuntime', () => {
  it('joins typescript/lib and the language-server CLI', () => {
    const root = mkdtempSync(join(tmpdir(), 'lsp-lang-ts-'))
    const tsPkg = join(root, 'typescript', 'package.json')
    const serverPkg = join(root, 'tls', 'package.json')
    const bin = join(root, 'tls', 'lib', 'cli.mjs')
    mkdirSync(dirname(bin), { recursive: true })
    mkdirSync(join(root, 'typescript', 'lib'), { recursive: true })
    writeFileSync(tsPkg, '{}')
    writeFileSync(serverPkg, '{}')
    writeFileSync(bin, '')
    const runtime = resolveTypescriptRuntime({
      resolve: id => id.startsWith('typescript-language-server') ? serverPkg : tsPkg,
    })
    expect(runtime.tsdk).toBe(join(root, 'typescript', 'lib'))
    expect(runtime.bin).toBe(bin)
    rmSync(root, { recursive: true, force: true })
  })

  it('throws when the CLI or tsdk is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'lsp-lang-ts-miss-'))
    const tsPkg = join(root, 'typescript', 'package.json')
    const serverPkg = join(root, 'tls', 'package.json')
    mkdirSync(dirname(tsPkg), { recursive: true })
    mkdirSync(dirname(serverPkg), { recursive: true })
    writeFileSync(tsPkg, '{}')
    writeFileSync(serverPkg, '{}')
    expect(() => resolveTypescriptRuntime({
      resolve: id => id.startsWith('typescript-language-server') ? serverPkg : tsPkg,
    })).toThrow(/CLI missing/)
    mkdirSync(join(root, 'tls', 'lib'), { recursive: true })
    writeFileSync(join(root, 'tls', 'lib', 'cli.mjs'), '')
    rmSync(join(root, 'typescript', 'lib'), { recursive: true, force: true })
    expect(() => resolveTypescriptRuntime({
      resolve: id => id.startsWith('typescript-language-server') ? serverPkg : tsPkg,
    })).toThrow(/typescript\/lib missing/)
    rmSync(root, { recursive: true, force: true })
  })

  it('resolves the workspace packages in this repo', () => {
    const runtime = resolveTypescriptRuntime()
    expect(runtime.bin.endsWith('cli.mjs')).toBe(true)
    expect(runtime.tsdk.endsWith('lib')).toBe(true)
  })
})

describe('typescriptServerArgv / typescriptSessionLaunch', () => {
  it('runs the CLI under the chosen Node with --stdio and tsserver.path', () => {
    expect(typescriptServerArgv(
      { bin: '/tls.mjs', tsdk: '/ts/lib' },
      { command: '/node', extraEnv: { ELECTRON_RUN_AS_NODE: '1' } },
    )).toEqual({
      command: '/node',
      args: ['/tls.mjs', '--stdio'],
      extraEnv: { ELECTRON_RUN_AS_NODE: '1' },
      initializationOptions: { tsserver: { path: join('/ts/lib', 'tsserver.js') } },
    })
  })

  it('composes resolve + nodeLaunch', () => {
    const launch = typescriptSessionLaunch(
      { env: {}, versions: {} as NodeJS.ProcessVersions, execPath: '/node' },
    )
    expect(launch.command).toBe('/node')
    expect(launch.args[1]).toBe('--stdio')
    expect(launch.initializationOptions.tsserver.path.endsWith('tsserver.js')).toBe(true)
  })
})
