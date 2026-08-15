import { describe, expect, it } from 'vitest'
import {
  clampWindowState,
  parseWindowState,
} from '../src/window-state.ts'

describe('parseWindowState', () => {
  it('accepts a complete finite geometry', () => {
    expect(parseWindowState({
      x: 10.2, y: 20.8, width: 800.4, height: 600.6, isMaximized: true,
    })).toEqual({ x: 10, y: 21, width: 800, height: 601, isMaximized: true })
  })

  it('rejects missing, tiny, or non-finite values', () => {
    expect(parseWindowState(null)).toBeUndefined()
    expect(parseWindowState({ x: 0, y: 0, width: 100, height: 600 })).toBeUndefined()
    expect(parseWindowState({ x: Number.NaN, y: 0, width: 800, height: 600 })).toBeUndefined()
  })
})

describe('clampWindowState', () => {
  const display = { x: 0, y: 0, width: 1920, height: 1080 }

  it('keeps an on-screen window and caps size to the work area', () => {
    expect(clampWindowState(
      { x: 100, y: 80, width: 3000, height: 700, isMaximized: false },
      [display],
    )).toEqual({ x: 100, y: 80, width: 1920, height: 700, isMaximized: false })
  })

  it('recenters when the saved bounds sit on a disconnected display', () => {
    expect(clampWindowState(
      { x: 4000, y: 2000, width: 800, height: 600, isMaximized: true },
      [display],
    )).toEqual({ x: 560, y: 240, width: 800, height: 600, isMaximized: false })
  })
})
