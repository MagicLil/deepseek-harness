import { delimiter, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  bundledNodePath,
  installDesktopRuntime,
  resolveDesktopCliEntry,
  resolveDesktopNodePath,
} from '../src/runtime-node.ts'

const NODE = 'C:\\Program Files\\nodejs\\node.exe'
const BUNDLED = 'C:\\app\\resources\\node\\node.exe'
const CLI = 'C:\\app\\resources\\app\\node_modules\\@deepseek-ai\\dsh\\lib\\bin.js'

describe('bundledNodePath', () => {
  it('puts node.exe under resources/node on Windows', () => {
    expect(bundledNodePath('C:\\app\\resources', 'win32')).toBe(join('C:\\app\\resources', 'node', 'node.exe'))
  })

  it('puts a bare node binary under resources/node on POSIX', () => {
    expect(bundledNodePath('/app/resources', 'linux')).toBe(join('/app/resources', 'node', 'node'))
  })
})

describe('resolveDesktopNodePath', () => {
  it('prefers a recorded DSH_NODE_EXEC_PATH that still exists', () => {
    expect(resolveDesktopNodePath({
      existingNode: NODE,
      resourcesPath: 'C:\\app\\resources',
      platform: 'win32',
      exists: path => path === NODE,
    })).toBe(NODE)
  })

  it('uses the bundled Node when nothing was recorded', () => {
    expect(resolveDesktopNodePath({
      resourcesPath: 'C:\\app\\resources',
      platform: 'win32',
      exists: path => path === BUNDLED,
    })).toBe(BUNDLED)
  })

  it('falls back to the bundled Node when the recorded path is gone', () => {
    expect(resolveDesktopNodePath({
      existingNode: NODE,
      resourcesPath: 'C:\\app\\resources',
      platform: 'win32',
      exists: path => path === BUNDLED,
    })).toBe(BUNDLED)
  })

  it('treats an empty recorded path as missing', () => {
    expect(resolveDesktopNodePath({
      existingNode: '',
      resourcesPath: 'C:\\app\\resources',
      platform: 'win32',
      exists: path => path === BUNDLED,
    })).toBe(BUNDLED)
  })

  it('returns undefined when neither recorded nor bundled Node exists', () => {
    expect(resolveDesktopNodePath({
      resourcesPath: 'C:\\app\\resources',
      platform: 'win32',
      exists: () => false,
    })).toBeUndefined()
  })
})

describe('installDesktopRuntime', () => {
  it('writes DSH_NODE_EXEC_PATH and prepends a dsh shim on PATH', () => {
    const env: NodeJS.ProcessEnv = { PATH: 'C:\\Windows\\System32' }
    const result = installDesktopRuntime({
      env,
      resourcesPath: 'C:\\app\\resources',
      platform: 'win32',
      existingNode: NODE,
      cliEntry: CLI,
      exists: path => path === NODE || path === CLI,
      writeShim: (spec) => {
        expect(spec).toEqual({ node: NODE, execArgv: [], entry: CLI })
        return 'C:\\tmp\\dsh-desktop-cli'
      },
    })
    expect(result).toEqual({ node: NODE, shimDir: 'C:\\tmp\\dsh-desktop-cli' })
    expect(env.DSH_NODE_EXEC_PATH).toBe(NODE)
    expect(env.PATH?.startsWith(`C:\\tmp\\dsh-desktop-cli${delimiter}`)).toBe(true)
  })

  it('sets DSH_NODE_EXEC_PATH from the bundled Node when relaunch did not record one', () => {
    const env: NodeJS.ProcessEnv = {}
    const result = installDesktopRuntime({
      env,
      resourcesPath: 'C:\\app\\resources',
      platform: 'win32',
      cliEntry: CLI,
      exists: path => path === BUNDLED || path === CLI,
      writeShim: () => 'C:\\tmp\\dsh-desktop-cli',
    })
    expect(result.node).toBe(BUNDLED)
    expect(env.DSH_NODE_EXEC_PATH).toBe(BUNDLED)
    expect(result.shimDir).toBe('C:\\tmp\\dsh-desktop-cli')
  })

  it('skips the shim when the CLI entry is missing', () => {
    const env: NodeJS.ProcessEnv = { PATH: 'C:\\Windows' }
    const result = installDesktopRuntime({
      env,
      resourcesPath: 'C:\\app\\resources',
      platform: 'win32',
      existingNode: NODE,
      cliEntry: CLI,
      exists: path => path === NODE,
      writeShim: () => {
        throw new Error('should not write a shim')
      },
    })
    expect(result).toEqual({ node: NODE, shimDir: undefined })
    expect(env.DSH_NODE_EXEC_PATH).toBe(NODE)
    expect(env.PATH).toBe('C:\\Windows')
  })

  it('leaves env alone when no Node is available', () => {
    const env: NodeJS.ProcessEnv = { PATH: 'C:\\Windows' }
    expect(installDesktopRuntime({
      env,
      resourcesPath: 'C:\\app\\resources',
      platform: 'win32',
      exists: () => false,
    })).toEqual({ node: undefined, shimDir: undefined })
    expect(env.DSH_NODE_EXEC_PATH).toBeUndefined()
    expect(env.PATH).toBe('C:\\Windows')
  })
})

describe('resolveDesktopCliEntry', () => {
  it('resolves the workspace CLI package from this desktop package', () => {
    const entry = resolveDesktopCliEntry(import.meta.url)
    expect(entry?.replaceAll('\\', '/')).toMatch(/\/apps\/cli\/lib\/bin\.js$/)
  })
})
