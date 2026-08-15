import { describe, expect, it } from 'vitest'
import { desktopTrayMenuSpec } from '../src/tray-menu.ts'

describe('desktopTrayMenuSpec', () => {
  it('lists show, update check, and quit', () => {
    expect(desktopTrayMenuSpec()).toEqual([
      { id: 'show', label: 'Show xmart' },
      { id: 'check-updates', label: 'Check for Updates' },
      { id: 'separator' },
      { id: 'quit', label: 'Quit' },
    ])
  })
})
