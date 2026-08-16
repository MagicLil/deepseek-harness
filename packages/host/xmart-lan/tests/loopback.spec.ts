import { describe, expect, it } from 'vitest'
import { isLoopbackHost, readHostName } from '../src/loopback.ts'

describe('loopback', () => {
  it('accepts 127/8, localhost, and IPv6 loopback', () => {
    expect(isLoopbackHost('127.0.0.1')).toBe(true)
    expect(isLoopbackHost('127.1.2.3')).toBe(true)
    expect(isLoopbackHost('localhost')).toBe(true)
    expect(isLoopbackHost('[::1]')).toBe(true)
    expect(isLoopbackHost('192.168.1.5')).toBe(false)
    expect(isLoopbackHost('example.com')).toBe(false)
  })

  it('strips the port and keeps IPv6 brackets', () => {
    expect(readHostName('127.0.0.1:3080')).toBe('127.0.0.1')
    expect(readHostName('[::1]:3080')).toBe('[::1]')
    expect(readHostName('localhost')).toBe('localhost')
    expect(readHostName(undefined)).toBe('')
    expect(readHostName('')).toBe('')
    expect(readHostName('[::1')).toBe('[::1')
    expect(readHostName('example.com:443')).toBe('example.com')
  })
})
