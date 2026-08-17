import { afterEach, describe, expect, it } from 'vitest'
import {
  clearTerminalSeat, getTerminalSeat, getTerminalSeatOwner, resetTerminalSeats, setTerminalSeat,
  terminalSeatKey,
} from '../src/client/terminal-seats.ts'

afterEach(resetTerminalSeats)

describe('terminal-seats', () => {
  it('remembers and forgets a tab-to-PTY mapping', () => {
    expect(terminalSeatKey('s1', 't1')).toBe('s1\u0000t1')
    expect(getTerminalSeat('s1', 't1')).toBeUndefined()
    setTerminalSeat('s1', 't1', 'pty-1')
    expect(getTerminalSeat('s1', 't1')).toBe('pty-1')
    expect(getTerminalSeatOwner('s1', 't1')).toBe('s1')
    setTerminalSeat('/ws', 't1', 'pty-2', 's-owner')
    expect(getTerminalSeat('/ws', 't1')).toBe('pty-2')
    expect(getTerminalSeatOwner('/ws', 't1')).toBe('s-owner')
    expect(clearTerminalSeat('s1', 't1')).toBe('pty-1')
    expect(getTerminalSeat('s1', 't1')).toBeUndefined()
    expect(clearTerminalSeat('s1', 't1')).toBeUndefined()
    setTerminalSeat('s1', 't1', 'pty-2')
    resetTerminalSeats()
    expect(getTerminalSeat('s1', 't1')).toBeUndefined()
  })
})
