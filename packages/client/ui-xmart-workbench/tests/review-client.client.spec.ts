import { describe, expect, it } from 'vitest'
import { roughLineStats, unwrapReview } from '../src/client/review-client.ts'

describe('unwrapReview', () => {
  it('unwraps Typert { ok, value } and passes through job payloads with ok but no value', async () => {
    await expect(unwrapReview(Promise.resolve({ ok: true, value: { turns: [] } }))).resolves.toEqual({
      turns: [],
    })
    await expect(unwrapReview(Promise.resolve({
      ok: false,
      error: { message: 'boom' },
    }))).rejects.toThrow('boom')
    await expect(unwrapReview(Promise.resolve({
      ok: false,
      error: 'conflict',
    }))).resolves.toEqual({ ok: false, error: 'conflict' })
  })
})

describe('roughLineStats', () => {
  it('counts create/delete/update deltas', () => {
    expect(roughLineStats('', 'a\nb\nc')).toEqual({ add: 3, del: 0 })
    expect(roughLineStats('a\nb', '')).toEqual({ add: 0, del: 2 })
    expect(roughLineStats('a\nb', 'a\nb\nc')).toEqual({ add: 1, del: 0 })
  })
})
