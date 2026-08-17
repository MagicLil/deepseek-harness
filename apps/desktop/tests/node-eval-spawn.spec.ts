import { EventEmitter } from 'node:events'
import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
  createRestartHelperStub,
  installElectronEvalSpawn,
  isMarketRestartEval,
  planElectronEvalSpawn,
  runDesktopRelaunch,
  sameExecPath,
  type SpawnTarget,
} from '../src/node-eval-spawn.ts'

const ELECTRON = 'C:\\app\\electron.exe'
const NODE = 'C:\\Program Files\\nodejs\\node.exe'

const MARKET_HELPER = [
  "const { spawn } = require('node:child_process')",
  'const fs = require(\'node:fs\')',
  'const file = "dsh"',
  'const args = ["--profile","desktop"]',
  'const cwd = "D:\\\\mycode\\\\deepseek\\\\deepseek-harness"',
  'const viaShell = true',
  'const logOut = "C:\\\\Users\\\\x\\\\AppData\\\\Local\\\\Temp\\\\dsh-market-restart-2026-08-16T20-53-29.out.log"',
  'const logErr = "C:\\\\Users\\\\x\\\\AppData\\\\Local\\\\Temp\\\\dsh-market-restart-2026-08-16T20-53-29.err.log"',
  'setTimeout(() => {',
  '  try {',
  '    const out = fs.openSync(logOut, "a")',
  '    const err = fs.openSync(logErr, "a")',
  '    const child = spawn(file, args, { cwd, detached: true, stdio: ["ignore", out, err], env: process.env, shell: viaShell })',
  '    child.unref()',
  '  } catch {}',
  '}, 1500)',
].join('\n')

describe('planElectronEvalSpawn', () => {
  it('passes through ordinary children', () => {
    expect(planElectronEvalSpawn({
      file: 'dsh',
      args: ['--profile', 'desktop'],
      env: { PATH: 'C:\\bin' },
      execPath: ELECTRON,
      nodePath: NODE,
    })).toEqual({ kind: 'passthrough' })
  })

  it('passes through Electron children that are not node -e eval', () => {
    expect(planElectronEvalSpawn({
      file: ELECTRON,
      args: ['lib/electron-main.js', '--profile', 'desktop'],
      execPath: ELECTRON,
      nodePath: NODE,
    })).toEqual({ kind: 'passthrough' })
  })

  it('relaunches when dsh-market hands Electron its restart helper as -e', () => {
    expect(planElectronEvalSpawn({
      file: ELECTRON,
      args: ['-e', MARKET_HELPER],
      env: { PATH: 'C:\\bin' },
      execPath: ELECTRON,
      nodePath: NODE,
    })).toEqual({ kind: 'relaunch' })
  })

  it('matches the Electron path case-insensitively on Windows-style paths', () => {
    expect(planElectronEvalSpawn({
      file: 'c:\\app\\electron.exe',
      args: ['-e', MARKET_HELPER],
      execPath: ELECTRON,
      nodePath: NODE,
    })).toEqual({ kind: 'relaunch' })
  })

  it('rewrites a non-market Electron -e to the recorded Node binary', () => {
    expect(planElectronEvalSpawn({
      file: ELECTRON,
      args: ['-e', 'console.log(1)'],
      env: { PATH: 'C:\\bin' },
      execPath: ELECTRON,
      nodePath: NODE,
    })).toEqual({
      kind: 'node-eval',
      file: NODE,
      args: ['-e', 'console.log(1)'],
      env: { PATH: 'C:\\bin' },
    })
  })

  it('sets ELECTRON_RUN_AS_NODE when no real Node path was recorded', () => {
    expect(planElectronEvalSpawn({
      file: ELECTRON,
      args: ['-e', 'console.log(1)'],
      env: { PATH: 'C:\\bin' },
      execPath: ELECTRON,
    })).toEqual({
      kind: 'node-eval',
      file: ELECTRON,
      args: ['-e', 'console.log(1)'],
      env: { PATH: 'C:\\bin', ELECTRON_RUN_AS_NODE: '1' },
    })
  })

  it('treats an empty nodePath as missing', () => {
    expect(planElectronEvalSpawn({
      file: ELECTRON,
      args: ['-e', 'console.log(1)'],
      env: {},
      execPath: ELECTRON,
      nodePath: '',
    })).toEqual({
      kind: 'node-eval',
      file: ELECTRON,
      args: ['-e', 'console.log(1)'],
      env: { ELECTRON_RUN_AS_NODE: '1' },
    })
  })
})

describe('sameExecPath', () => {
  it('normalizes slashes and rejects a different binary', () => {
    expect(sameExecPath('C:\\app\\electron.exe', 'C:/app/electron.exe')).toBe(true)
    expect(sameExecPath('C:\\app\\electron.exe', 'C:\\app\\node.exe')).toBe(false)
    expect(sameExecPath('/opt/electron', '/opt/electron')).toBe(true)
  })
})

describe('isMarketRestartEval', () => {
  it('requires the dsh-market-restart helper source', () => {
    expect(isMarketRestartEval(['-e', MARKET_HELPER])).toBe(true)
    expect(isMarketRestartEval(['-e', 'console.log(1)'])).toBe(false)
    expect(isMarketRestartEval(['lib/electron-main.js'])).toBe(false)
  })
})

describe('runDesktopRelaunch', () => {
  it('marks quitting, relaunches, then exits 0 so the market helper need not SIGTERM', () => {
    const calls: string[] = []
    runDesktopRelaunch({
      markQuitting: () => { calls.push('quit') },
      relaunch: () => { calls.push('relaunch') },
      exit: (code) => { calls.push(`exit:${String(code)}`) },
    })
    expect(calls).toEqual(['quit', 'relaunch', 'exit:0'])
  })
})

describe('createRestartHelperStub', () => {
  it('exposes a pid and no-op unref for the market helper', () => {
    const stub = createRestartHelperStub()
    expect(stub.pid).toBe(1)
    expect(stub.unref()).toBe(stub)
  })
})

describe('installElectronEvalSpawn', () => {
  function fakeTarget(): SpawnTarget & { calls: Array<{ file: string; args: readonly string[] }> } {
    const calls: Array<{ file: string; args: readonly string[] }> = []
    const spawn = ((file: string, args?: readonly string[] | SpawnOptions) => {
      const argv = Array.isArray(args) ? args : []
      calls.push({ file, args: argv })
      return new EventEmitter() as ChildProcess
    }) as SpawnTarget['spawn']
    return { spawn, calls }
  }

  it('calls onRelaunch and returns a stub for the market helper', () => {
    let relaunched = 0
    const target = fakeTarget()
    const restore = installElectronEvalSpawn({
      execPath: ELECTRON,
      nodePath: NODE,
      onRelaunch: () => { relaunched += 1 },
    }, target)
    const child = target.spawn(ELECTRON, ['-e', MARKET_HELPER], { stdio: 'ignore' })
    expect(relaunched).toBe(1)
    expect(child.pid).toBe(1)
    expect(target.calls).toEqual([])
    child.unref()
    restore()
  })

  it('restores the original spawn so later children pass through', () => {
    let relaunched = 0
    const target = fakeTarget()
    const original = target.spawn
    const restore = installElectronEvalSpawn({
      execPath: ELECTRON,
      onRelaunch: () => { relaunched += 1 },
    }, target)
    restore()
    expect(target.spawn).toBe(original)
    target.spawn(ELECTRON, ['-e', MARKET_HELPER])
    expect(relaunched).toBe(0)
    expect(target.calls).toEqual([{ file: ELECTRON, args: ['-e', MARKET_HELPER] }])
  })

  it('rewrites a non-market Electron -e onto the recorded Node', () => {
    const target = fakeTarget()
    const restore = installElectronEvalSpawn({
      execPath: ELECTRON,
      nodePath: NODE,
      onRelaunch: () => {
        throw new Error('should not relaunch')
      },
    }, target)
    target.spawn(ELECTRON, ['-e', 'console.log(1)'], { stdio: 'ignore' })
    expect(target.calls).toEqual([{ file: NODE, args: ['-e', 'console.log(1)'] }])
    restore()
  })

  it('passes through spawn(file, options) without an argv array', () => {
    const target = fakeTarget()
    const restore = installElectronEvalSpawn({
      execPath: ELECTRON,
      onRelaunch: () => {
        throw new Error('should not relaunch')
      },
    }, target)
    target.spawn('dsh', { cwd: 'D:\\repo' })
    expect(target.calls).toEqual([{ file: 'dsh', args: [] }])
    restore()
  })

  it('syncs builtin ESM exports when patching the real child_process', () => {
    let synced = 0
    const restore = installElectronEvalSpawn({
      execPath: process.execPath,
      onRelaunch: () => {},
      syncExports: () => { synced += 1 },
    })
    expect(synced).toBe(1)
    restore()
    expect(synced).toBe(2)
  })

  it('does not sync ESM exports when tests pass a fake spawn target', () => {
    let synced = 0
    const target = fakeTarget()
    const restore = installElectronEvalSpawn({
      execPath: ELECTRON,
      onRelaunch: () => {},
      syncExports: () => { synced += 1 },
    }, target)
    expect(synced).toBe(0)
    restore()
    expect(synced).toBe(0)
  })
})
