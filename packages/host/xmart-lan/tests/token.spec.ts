import { describe, expect, it } from 'vitest'
import { createToken, tokenFromRequest, tokensEqual } from '../src/token.ts'

describe('token', () => {
  it('parses header over cookie and rejects a wrong token', () => {
    const token = createToken()
    expect(token.length).toBeGreaterThan(20)
    expect(tokenFromRequest('xmart_lan=cookie', token)).toBe(token)
    expect(tokensEqual(token, token)).toBe(true)
    expect(tokensEqual(token, createToken())).toBe(false)
  })

  it('reads the cookie when the header is absent and skips empty values', () => {
    expect(tokenFromRequest('other=1; xmart_lan=abc', undefined)).toBe('abc')
    expect(tokenFromRequest('xmart_lan=', undefined)).toBeUndefined()
    expect(tokenFromRequest(undefined, undefined)).toBeUndefined()
    expect(tokenFromRequest('plain', undefined)).toBeUndefined()
    expect(tokenFromRequest(undefined, '')).toBeUndefined()
  })
})
