/**
 * spawnDialogWorker launch plan: Electron children must run as node, and
 * the source vs built argv arms stay distinct. `child_process.spawn` is
 * mocked so this file never opens a real dialog.
 */

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn<(...args: unknown[]) => { pid: number }>(() => ({ pid: 1 })),
}))

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}))

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import { spawnDialogWorker } from '../src/win32-dialog-host.ts'

const fakeChild = { pid: 1 }

describe('spawnDialogWorker', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    spawnMock.mockReturnValue(fakeChild)
  })

  it('bootstraps tsx from a source-plane metaUrl and leaves Electron unset', () => {
    const run = vi.fn(() => fakeChild)
    const child = spawnDialogWorker({ title: 'Select Workspace Directory' }, {
      execPath: '/node',
      env: { PATH: '/bin' },
      metaUrl: import.meta.url,
      spawn: run as never,
    })
    expect(child).toBe(fakeChild)
    expect(run).toHaveBeenCalledOnce()
    const [command, args, options] = run.mock.calls[0] as unknown as [
      string, string[], { env: NodeJS.ProcessEnv },
    ]
    expect(command).toBe('/node')
    expect(args[0]).toBe('--import')
    expect(String(args[2])).toMatch(/win32-dialog-worker\.ts$/)
    expect(options).toMatchObject({
      windowsHide: true,
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      env: { PATH: '/bin', DSH_DIALOG_TITLE: 'Select Workspace Directory' },
    })
    expect(options.env).not.toHaveProperty('ELECTRON_RUN_AS_NODE')
  })

  it('launches the sibling worker.cjs from a built-plane metaUrl', () => {
    const run = vi.fn(() => fakeChild)
    const metaUrl = new URL('./win32-dialog-host.js', import.meta.url).href
    spawnDialogWorker({ title: 'Pick' }, {
      execPath: '/node',
      env: {},
      metaUrl,
      spawn: run as never,
    })
    const args = (run.mock.calls[0] as unknown as [string, string[]])[1]
    expect(args).toEqual([fileURLToPath(new URL('./worker.cjs', metaUrl))])
  })

  it('forces ELECTRON_RUN_AS_NODE when the host is Electron', () => {
    const run = vi.fn(() => fakeChild)
    spawnDialogWorker({ title: 'Pick' }, {
      execPath: '/electron',
      env: { FOO: '1' },
      electron: '37.2.0',
      metaUrl: import.meta.url,
      spawn: run as never,
    })
    expect((run.mock.calls[0] as unknown as [string, string[], { env: NodeJS.ProcessEnv }])[2]).toMatchObject({
      env: { FOO: '1', DSH_DIALOG_TITLE: 'Pick', ELECTRON_RUN_AS_NODE: '1' },
    })
  })

  it('reads live process facts and the default spawn when internals are omitted', () => {
    const child = spawnDialogWorker({ title: 'Live' })
    expect(child).toBe(fakeChild)
    expect(spawnMock).toHaveBeenCalledOnce()
    const [command, args, options] = spawnMock.mock.calls[0] as unknown as [
      string, string[], { env: NodeJS.ProcessEnv },
    ]
    expect(command).toBe(process.execPath)
    expect(args[0]).toBe('--import')
    expect(options.env.DSH_DIALOG_TITLE).toBe('Live')
    if (process.versions.electron === undefined) {
      expect(options.env.ELECTRON_RUN_AS_NODE).toBeUndefined()
    } else {
      expect(options.env.ELECTRON_RUN_AS_NODE).toBe('1')
    }
  })
})
