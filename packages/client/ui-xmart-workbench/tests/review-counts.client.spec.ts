import { describe, expect, it } from 'vitest'
import {
  pickReviewTurn, reviewKindCounts, reviewPendingTotal, showShellOnlyWarn,
} from '../src/client/review-counts.ts'
import type { ReviewSession } from '@deepseek-ai/dsh-host-agent-review/types'

const session: ReviewSession = {
  sessionId: 's',
  turns: [
    {
      turn: 2,
      shellMaybeMutated: false,
      files: [
        {
          path: '/a', kind: 'create', status: 'pending', shadowKey: '', beforeHash: null, afterHash: 'x',
        },
        {
          path: '/b', kind: 'update', status: 'accepted', shadowKey: '', beforeHash: '1', afterHash: '2',
        },
      ],
    },
    {
      turn: 1,
      shellMaybeMutated: true,
      files: [{
        path: '/c', kind: 'delete', status: 'pending', shadowKey: 'k', beforeHash: '1', afterHash: null,
      }],
    },
  ],
}

describe('review-counts', () => {
  it('counts kinds and pending, and picks the newest pending turn', () => {
    expect(reviewKindCounts(session.turns[0])).toEqual({
      create: 1, update: 1, delete: 0, pending: 1,
    })
    expect(reviewPendingTotal(session)).toBe(2)
    expect(pickReviewTurn(session)?.turn).toBe(2)
    expect(reviewKindCounts(undefined).pending).toBe(0)
    expect(pickReviewTurn(undefined)).toBeUndefined()
    expect(pickReviewTurn({ sessionId: 'x', turns: undefined as never })).toBeUndefined()
    expect(reviewPendingTotal({ sessionId: 'x', turns: undefined as never })).toBe(0)
  })

  it('picks shell-only turns and reports showShellOnlyWarn', () => {
    const shellOnly: ReviewSession = {
      sessionId: 's',
      turns: [{ turn: 3, shellMaybeMutated: true, files: [] }],
    }
    expect(pickReviewTurn(shellOnly)?.turn).toBe(3)
    expect(showShellOnlyWarn(shellOnly.turns[0], 0)).toBe(true)
    expect(showShellOnlyWarn(shellOnly.turns[0], 1)).toBe(false)
  })
})
