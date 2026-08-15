import { describe, expect, it } from 'vitest'
import { canCreateTerminal, countTerminalTabs, shouldCreateOnToggle } from '../src/client/terminal-actions.ts'

describe('terminal-actions', () => {
  it('counts only terminal tabs and gates minting', () => {
    const tabs = [
      { type: 'editor' },
      { type: 'terminal' },
      { type: 'terminal' },
    ]
    expect(countTerminalTabs(tabs)).toBe(2)
    expect(canCreateTerminal(tabs)).toBe(true)
    expect(canCreateTerminal([...tabs, { type: 'terminal' }])).toBe(false)
    expect(shouldCreateOnToggle(0)).toBe(true)
    expect(shouldCreateOnToggle(1)).toBe(false)
  })
})
