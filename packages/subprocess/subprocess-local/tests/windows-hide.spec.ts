/**
 * Windows console-hide contract for ordinary trees. This file must stay off
 * the win32 bash-exclusion list: spawn.spec.ts never runs on Windows, and
 * that is the host where a GUI parent flashes a console without windowsHide.
 */
const { spawnMock, spawnSyncMock } = vi.hoisted(() => ({
  spawnMock: vi.fn<(...args: unknown[]) => unknown>(),
  spawnSyncMock: vi.fn<(...args: unknown[]) => unknown>(),
}))

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    spawn(...args: Parameters<typeof actual.spawn>) {
      spawnMock(...args)
      return actual.spawn(...args)
    },
    spawnSync(...args: Parameters<typeof actual.spawnSync>) {
      spawnSyncMock(...args)
      return actual.spawnSync(...args)
    },
  }
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { spawnSubprocess, taskkillProcessTree } from '../src/spawn.ts'

describe('Windows console hide', () => {
  afterEach(() => {
    spawnMock.mockClear()
    spawnSyncMock.mockClear()
  })

  it('hides the Windows console window on ordinary spawn and taskkill', async () => {
    const running = spawnSubprocess({
      argv: [process.execPath, '-e', 'process.exit(0)'],
      cwd: process.cwd(),
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: 1024 },
        stderr: { maxBytes: 1024 },
      },
      graceMs: 3_000,
    })
    await running.done
    const spawnCall = spawnMock.mock.calls.find(call => call[0] === process.execPath)
    const spawnOptions = spawnCall?.[2] as { windowsHide?: boolean } | undefined
    expect(spawnOptions).toEqual(expect.objectContaining({ windowsHide: true }))

    taskkillProcessTree(2 ** 30)
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'taskkill',
      ['/PID', String(2 ** 30), '/T', '/F'],
      expect.objectContaining({ stdio: 'ignore', windowsHide: true }),
    )
  })
})
