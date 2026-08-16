import { describe, expect, it } from 'vitest'
import {
  applyDesktopTitleBarOverlay, DESKTOP_TITLE_BAR_HEIGHT, desktopSecondInstanceAction,
  desktopTitleBarChrome, desktopTitleBarOverlay, resolveInitialTitleBarScheme,
} from '../src/title-bar.ts'

describe('applyDesktopTitleBarOverlay', () => {
  it('applies hidden title plus caption overlay for the chat toggle', () => {
    expect(applyDesktopTitleBarOverlay()).toBe(true)
  })
})

describe('desktopTitleBarOverlay', () => {
  it('uses the locked light and dark chrome pairs', () => {
    expect(desktopTitleBarOverlay('dark')).toEqual({
      color: '#141414',
      symbolColor: '#C8C8C8',
      height: DESKTOP_TITLE_BAR_HEIGHT,
    })
    expect(desktopTitleBarOverlay('light')).toEqual({
      color: '#F5F5F5',
      symbolColor: '#333333',
      height: DESKTOP_TITLE_BAR_HEIGHT,
    })
  })
})

describe('resolveInitialTitleBarScheme', () => {
  it('maps the OS dark flag to a scheme', () => {
    expect(resolveInitialTitleBarScheme(true)).toBe('dark')
    expect(resolveInitialTitleBarScheme(false)).toBe('light')
  })
})

describe('desktopTitleBarChrome', () => {
  it('hides the title bar and keeps a 32px caption overlay', () => {
    expect(desktopTitleBarChrome('light')).toEqual({
      titleBarStyle: 'hidden',
      titleBarOverlay: desktopTitleBarOverlay('light'),
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
