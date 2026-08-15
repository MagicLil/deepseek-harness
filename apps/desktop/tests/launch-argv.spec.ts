import { describe, expect, it } from 'vitest'
import { desktopElectronUserArgv } from '../src/launch-argv.ts'

describe('desktopElectronUserArgv', () => {
  it('strips the Electron binary and main entry when unpackaged', () => {
    expect(desktopElectronUserArgv(
      ['electron', 'lib/electron-main.js', 'desktop', '--patch', 'a.yml'],
      false,
    )).toEqual(['desktop', '--patch', 'a.yml'])
  })

  it('injects the desktop alias when a packaged exe is launched with no profile', () => {
    expect(desktopElectronUserArgv(['C:\\Program Files\\xmart\\xmart.exe'], true))
      .toEqual(['desktop'])
  })

  it('keeps an explicit packaged profile and prepends desktop only when missing', () => {
    expect(desktopElectronUserArgv(['xmart.exe', 'desktop', '--help'], true))
      .toEqual(['desktop', '--help'])
    expect(desktopElectronUserArgv(['xmart.exe', '--profile', 'desktop'], true))
      .toEqual(['--profile', 'desktop'])
    expect(desktopElectronUserArgv(['xmart.exe', '--patch', 'extra.yml'], true))
      .toEqual(['desktop', '--patch', 'extra.yml'])
  })
})
