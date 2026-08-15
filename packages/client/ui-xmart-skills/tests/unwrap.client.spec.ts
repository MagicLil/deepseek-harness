import { describe, expect, it } from 'vitest'
import { unwrapRemote } from '../src/client/unwrap.ts'

describe('unwrapRemote', () => {
  it('returns the value or throws the wire error', () => {
    expect(unwrapRemote('m', { ok: true, value: 3 })).toBe(3)
    expect(() => unwrapRemote('m', { ok: false, error: { code: 'E', message: 'nope' } }))
      .toThrow('m failed: E: nope')
  })
})
