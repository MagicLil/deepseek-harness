import { describe, expect, it } from 'vitest'
import { desktopElectronUserArgv } from '../src/launch-argv.ts'

describe('desktopElectronUserArgv', () => {
  it('strips the Electron binary and main entry when unpackaged', () => {
    expect(desktopElectronUserArgv(
      ['electron', 'lib/electron-main.js', 'desktop', '--patch', 'a.yml'],
      false,
    )).toEqual(['--profile', 'desktop', '--patch', 'a.yml'])
  })

  it('injects --profile desktop when a packaged exe is launched with no profile', () => {
    expect(desktopElectronUserArgv(['C:\\Program Files\\xmart\\xmart.exe'], true))
      .toEqual(['--profile', 'desktop'])
  })

  it('keeps an explicit packaged profile and expands the desktop alias', () => {
    expect(desktopElectronUserArgv(['xmart.exe', 'desktop', '--help'], true))
      .toEqual(['--profile', 'desktop', '--help'])
    expect(desktopElectronUserArgv(['xmart.exe', '--profile', 'desktop'], true))
      .toEqual(['--profile', 'desktop'])
    expect(desktopElectronUserArgv(['xmart.exe', '--patch', 'extra.yml'], true))
      .toEqual(['--profile', 'desktop', '--patch', 'extra.yml'])
  })
})
