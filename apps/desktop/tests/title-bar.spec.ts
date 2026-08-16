import { describe, expect, it } from 'vitest'
import {
  applyDesktopTitleBarOverlay, DESKTOP_TITLE_BAR_HEIGHT, desktopSecondInstanceAction,
  desktopTitleBarChrome,
} from '../src/title-bar.ts'

describe('applyDesktopTitleBarOverlay', () => {
  it('applies hidden title plus caption overlay for the chat toggle', () => {
    expect(applyDesktopTitleBarOverlay()).toBe(true)
  })
})

describe('desktopTitleBarChrome', () => {
  it('hides the title bar and keeps a 32px caption overlay', () => {
    expect(desktopTitleBarChrome()).toEqual({
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#151517',
        symbolColor: '#c8c8c8',
        height: DESKTOP_TITLE_BAR_HEIGHT,
      },
    })
    expect(DESKTOP_TITLE_BAR_HEIGHT).toBe(32)
  })
})

describe('desktopSecondInstanceAction', () => {
  it('relaunches unpackaged so a rebuilt main is loaded', () => {
    expect(desktopSecondInstanceAction(false)).toBe('relaunch')
    expect(desktopSecondInstanceAction(true)).toBe('focus')
  })
})
