import { describe, expect, it } from 'vitest'
import { pickReviewTurnForPath, resolveCardReviewTurn } from '../src/client/file-change-actions.ts'
import type { ReviewSessionRow } from '../src/client/review-client.ts'

const session: ReviewSessionRow = {
  sessionId: 's',
  turns: [
    {
      turn: 2,
      shellMaybeMutated: false,
      files: [{ path: 'D:\\ws\\a.ts', kind: 'update', status: 'accepted' }],
    },
    {
      turn: 5,
      shellMaybeMutated: false,
      files: [{ path: 'D:\\ws\\a.ts', kind: 'update', status: 'pending' }],
    },
  ],
}

describe('pickReviewTurnForPath', () => {
  it('picks the pending turn for a path and ignores slash or case differences', () => {
    expect(pickReviewTurnForPath(session, 'D:/ws/a.ts')?.turn).toBe(5)
    expect(pickReviewTurnForPath(session, 'D:\\ws\\a.ts')?.turn).toBe(5)
    expect(pickReviewTurnForPath(undefined, '/a')).toBeUndefined()
    expect(pickReviewTurnForPath({ sessionId: 'x', turns: undefined as never }, '/a')).toBeUndefined()
    expect(pickReviewTurnForPath({
      sessionId: 'x',
      turns: [{ turn: 9, shellMaybeMutated: false, files: undefined as never }],
    }, '/a')).toBeUndefined()
    expect(pickReviewTurnForPath({
      sessionId: 's',
      turns: [{
        turn: 3,
        shellMaybeMutated: false,
        files: [{ path: '/done.ts', kind: 'update', status: 'accepted' }],
      }],
    }, '/done.ts')?.turn).toBe(3)
  })
})

describe('resolveCardReviewTurn', () => {
  it('returns the pending turn that owns the path', async () => {
    await expect(resolveCardReviewTurn(async () => session, 'D:/ws/a.ts')).resolves.toBe(5)
  })

  it('returns undefined when the path is not in review or the load fails', async () => {
    await expect(resolveCardReviewTurn(async () => session, '/other.ts')).resolves.toBeUndefined()
    await expect(resolveCardReviewTurn(async () => {
      throw new Error('offline')
    }, 'D:/ws/a.ts')).resolves.toBeUndefined()
  })
})
