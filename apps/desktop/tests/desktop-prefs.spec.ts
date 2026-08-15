import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { consumeCloseToTrayHint, parseDesktopPrefs } from '../src/desktop-prefs.ts'

const previousHome = process.env.DSH_HOME

afterEach(() => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
})

describe('parseDesktopPrefs', () => {
  it('defaults the hint to unseen', () => {
    expect(parseDesktopPrefs(null)).toEqual({ closeToTrayHintShown: false })
    expect(parseDesktopPrefs({ closeToTrayHintShown: true })).toEqual({ closeToTrayHintShown: true })
    expect(parseDesktopPrefs({ closeToTrayHintShown: 'yes' })).toEqual({ closeToTrayHintShown: false })
  })
})

describe('consumeCloseToTrayHint', () => {
  it('returns true once, then persists the flag', () => {
    process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'dsh-desktop-prefs-'))
    expect(consumeCloseToTrayHint()).toBe(true)
    expect(consumeCloseToTrayHint()).toBe(false)
    const written = JSON.parse(readFileSync(join(process.env.DSH_HOME, 'desktop-prefs.json'), 'utf8')) as {
      closeToTrayHintShown: boolean
    }
    expect(written.closeToTrayHintShown).toBe(true)
  })
})
