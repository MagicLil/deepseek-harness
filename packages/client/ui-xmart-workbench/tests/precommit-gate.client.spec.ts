/**
 * Commit button gate: staged files, message, and user confirm.
 */
import { describe, expect, it } from 'vitest'
import { canCreateCommit, precommitBlockReason } from '../src/client/precommit-gate.ts'

describe('precommit-gate', () => {
  it('blocks until staged files, a message, and confirm are ready', () => {
    expect(precommitBlockReason({
      message: 'feat: x',
      stagedCount: 0,
      confirmed: true,
    })).toBe('nothing-staged')
    expect(precommitBlockReason({
      message: '   ',
      stagedCount: 1,
      confirmed: true,
    })).toBe('empty-message')
    expect(precommitBlockReason({
      message: 'feat: x',
      stagedCount: 1,
      confirmed: false,
    })).toBe('unconfirmed')
    expect(canCreateCommit({
      message: 'feat: x',
      stagedCount: 1,
      confirmed: true,
    })).toBe(true)
  })
})
