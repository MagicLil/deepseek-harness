import { describe, expect, it, vi } from 'vitest'
import { desktopIpcTitleBar, syncTitleBarOverlay } from '../src/client/title-bar-sync.ts'

describe('syncTitleBarOverlay', () => {
  it('no-ops when the desktop bridge is missing', () => {
    expect(() => syncTitleBarOverlay('light', undefined)).not.toThrow()
    expect(desktopIpcTitleBar({})).toBeUndefined()
  })

  it('pushes the resolved scheme when the bridge exists', () => {
    const setTitleBarOverlay = vi.fn()
    syncTitleBarOverlay('dark', { setTitleBarOverlay })
    expect(setTitleBarOverlay).toHaveBeenCalledWith('dark')
  })

  it('ignores a bridge that has no setTitleBarOverlay', () => {
    expect(desktopIpcTitleBar({ __DSH_IPC__: {} as never })).toBeUndefined()
  })
})
