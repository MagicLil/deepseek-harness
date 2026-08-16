import { describe, expect, it } from 'vitest'
import { contentHash } from '../src/hash.ts'

describe('contentHash', () => {
  it('is stable for the same text', () => {
    expect(contentHash('a')).toBe(contentHash('a'))
    expect(contentHash('a')).not.toBe(contentHash('b'))
    expect(contentHash('')).toMatch(/^[a-f0-9]{64}$/)
  })
})
