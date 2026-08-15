/**
 * Pure helpers for minting and closing UI terminal tabs.
 */
import { TERMINAL_TAB_LIMIT } from './types.ts'

/** Count open terminal tabs in a session snapshot. */
export function countTerminalTabs(tabs: readonly { type: string }[]): number {
  return tabs.filter(tab => tab.type === 'terminal').length
}

/** True when a toggle with zero tabs should mint instead of only flipping height. */
export function shouldCreateOnToggle(count: number): boolean {
  return count === 0
}

/** True when another terminal tab may be minted. */
export function canCreateTerminal(tabs: readonly { type: string }[]): boolean {
  return countTerminalTabs(tabs) < TERMINAL_TAB_LIMIT
}
