import { describe, expect, it } from 'vitest'
import { nodeLaunch } from '../src/node-launch.ts'

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
      env: { DSH_NODE_EXEC_PATH: '' },
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

  it('reads the real process when internals are omitted', () => {
    const launch = nodeLaunch()
    expect(launch.command).toBe(process.execPath)
  })
})
