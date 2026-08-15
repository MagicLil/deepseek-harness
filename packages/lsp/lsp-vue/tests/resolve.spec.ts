import { describe, expect, it } from 'vitest'
import { dirname, join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { nodeLaunch, resolveVueRuntime, vueServerArgv } from '../src/resolve.ts'

describe('nodeLaunch', () => {
  it('prefers DSH_NODE_EXEC_PATH under Electron', () => {
    expect(nodeLaunch({
      env: { DSH_NODE_EXEC_PATH: '/real-node' },
      versions: { electron: '1' } as NodeJS.ProcessVersions,
      execPath: '/electron',
    })).toEqual({ command: '/real-node', extraEnv: {} })
  })

  it('sets ELECTRON_RUN_AS_NODE when Electron has no recorded Node', () => {
    expect(nodeLaunch({
      env: {},
      versions: { electron: '1' } as NodeJS.ProcessVersions,
      execPath: '/electron',
    })).toEqual({ command: '/electron', extraEnv: { ELECTRON_RUN_AS_NODE: '1' } })
  })

  it('uses process.execPath on plain Node', () => {
    const launch = nodeLaunch({
      env: {},
      versions: {} as NodeJS.ProcessVersions,
      execPath: '/node',
    })
    expect(launch).toEqual({ command: '/node', extraEnv: {} })
  })
})

describe('resolveVueRuntime', () => {
  it('joins typescript/lib and the Vue language-server bin', () => {
    const root = mkdtempSync(join(tmpdir(), 'lsp-vue-res-'))
    const tsPkg = join(root, 'typescript', 'package.json')
    const vuePkg = join(root, 'vue', 'package.json')
    const bin = join(root, 'vue', 'bin', 'vue-language-server.js')
    mkdirSync(dirname(bin), { recursive: true })
    mkdirSync(join(root, 'typescript', 'lib'), { recursive: true })
    writeFileSync(tsPkg, '{}')
    writeFileSync(vuePkg, '{}')
    writeFileSync(bin, '')
    const runtime = resolveVueRuntime({
      resolve: id => id.startsWith('typescript') ? tsPkg : vuePkg,
    })
    expect(runtime.tsdk).toBe(join(root, 'typescript', 'lib'))
    expect(runtime.bin).toBe(bin)
    rmSync(root, { recursive: true, force: true })
  })

  it('throws when the bin or tsdk is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'lsp-vue-miss-'))
    const tsPkg = join(root, 'typescript', 'package.json')
    const vuePkg = join(root, 'vue', 'package.json')
    mkdirSync(dirname(tsPkg), { recursive: true })
    mkdirSync(dirname(vuePkg), { recursive: true })
    writeFileSync(tsPkg, '{}')
    writeFileSync(vuePkg, '{}')
    expect(() => resolveVueRuntime({
      resolve: id => id.startsWith('typescript') ? tsPkg : vuePkg,
    })).toThrow(/bin missing/)
    mkdirSync(join(root, 'vue', 'bin'), { recursive: true })
    writeFileSync(join(root, 'vue', 'bin', 'vue-language-server.js'), '')
    rmSync(join(root, 'typescript', 'lib'), { recursive: true, force: true })
    expect(() => resolveVueRuntime({
      resolve: id => id.startsWith('typescript') ? tsPkg : vuePkg,
    })).toThrow(/typescript\/lib missing/)
    rmSync(root, { recursive: true, force: true })
  })

  it('resolves the workspace packages in this repo', () => {
    const runtime = resolveVueRuntime()
    expect(runtime.bin.endsWith('vue-language-server.js')).toBe(true)
    expect(runtime.tsdk.endsWith('lib')).toBe(true)
  })
})

describe('vueServerArgv', () => {
  it('runs the bin under the chosen Node with --stdio and --tsdk', () => {
    expect(vueServerArgv(
      { bin: '/vue.js', tsdk: '/ts/lib' },
      { command: '/node', extraEnv: { ELECTRON_RUN_AS_NODE: '1' } },
    )).toEqual({
      command: '/node',
      args: ['/vue.js', '--stdio', '--tsdk=/ts/lib'],
      extraEnv: { ELECTRON_RUN_AS_NODE: '1' },
    })
  })
})
