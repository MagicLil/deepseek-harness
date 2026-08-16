import { describe, expect, it } from 'vitest'
import { listLanIpv4 } from '../src/lan-address.ts'

describe('listLanIpv4', () => {
  it('keeps non-internal IPv4 and skips the rest', () => {
    expect(listLanIpv4({
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true } as never],
      eth0: [
        { address: '192.168.1.5', family: 'IPv4', internal: false } as never,
        { address: 'fe80::1', family: 'IPv6', internal: false } as never,
        { address: '10.0.0.2', family: 4, internal: false } as never,
      ],
      empty: undefined,
    })).toEqual(['192.168.1.5', '10.0.0.2'])
  })
})
