import { describe, expect, it } from 'vitest'
import { guardVerdict } from '../src/guard.ts'
import { createToken } from '../src/token.ts'

describe('guardVerdict', () => {
  it('allows loopback without a token', () => {
    expect(guardVerdict({
      enabled: false,
      token: undefined,
      hostHeader: '127.0.0.1:3080',
    })).toBe('allow')
  })

  it('denies non-loopback when the switch is off', () => {
    expect(guardVerdict({
      enabled: false,
      token: createToken(),
      hostHeader: '192.168.1.5:3080',
    })).toBe('deny')
  })

  it('denies a wrong token', () => {
    expect(guardVerdict({
      enabled: true,
      token: createToken(),
      hostHeader: '192.168.1.5:3080',
      cookie: 'xmart_lan=nope',
    })).toBe('deny')
  })

  it('allows a matching token', () => {
    const token = createToken()
    expect(guardVerdict({
      enabled: true,
      token,
      hostHeader: '192.168.1.5:3080',
      xToken: token,
    })).toBe('allow')
  })

  it('denies an enabled switch with no stored token', () => {
    expect(guardVerdict({
      enabled: true,
      token: undefined,
      hostHeader: '192.168.1.5:3080',
      xToken: createToken(),
    })).toBe('deny')
  })
})
