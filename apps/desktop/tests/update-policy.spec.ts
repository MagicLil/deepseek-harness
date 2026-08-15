import { describe, expect, it } from 'vitest'
import { isPortableInstall, resolveAutoUpdateGate, updatePromptSurface } from '../src/update-policy.ts'

describe('isPortableInstall', () => {
  it('is true only when electron-builder set PORTABLE_EXECUTABLE_DIR', () => {
    expect(isPortableInstall({})).toBe(false)
    expect(isPortableInstall({ PORTABLE_EXECUTABLE_DIR: '  ' })).toBe(false)
    expect(isPortableInstall({ PORTABLE_EXECUTABLE_DIR: 'C:\\Users\\me\\App' })).toBe(true)
  })
})

describe('resolveAutoUpdateGate', () => {
  it('blocks source launches and portable exes', () => {
    expect(resolveAutoUpdateGate({ isPackaged: false, portable: false })).toEqual({
      ok: false,
      reason: 'unpackaged',
    })
    expect(resolveAutoUpdateGate({ isPackaged: true, portable: true })).toEqual({
      ok: false,
      reason: 'portable',
    })
    expect(resolveAutoUpdateGate({ isPackaged: true, portable: false })).toEqual({ ok: true })
  })
})

describe('updatePromptSurface', () => {
  it('uses a dialog when the window is visible, otherwise a notification', () => {
    expect(updatePromptSurface(true)).toBe('dialog')
    expect(updatePromptSurface(false)).toBe('notification')
  })
})
