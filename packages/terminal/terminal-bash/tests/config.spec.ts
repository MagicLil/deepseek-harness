import { describe, expect, it } from 'vitest'
import type { Config } from '@deepseek-ai/dsh-terminal-bash/src/config.ts'
import {
  Config as ConfigSchema, defaultShellInvocation, validateConfig,
} from '@deepseek-ai/dsh-terminal-bash/src/config.ts'

function config(overrides: Partial<Config> = {}): Config {
  return {
    backendType: 'shell', shellPath: '/bin/bash', shellArgs: [], rows: 40, cols: 160,
    scrollbackLines: 100, scrollbackMaxBytes: 1024, maxReadBytes: 512,
    pollIntervalMs: 10, exactProbeAfterMs: 20, idleSilenceMs: 100, handoffGraceMs: 50, timeoutMs: 1000,
    disposeGraceMs: 100,
    ...overrides,
  }
}

describe('terminal-bash config', () => {
  it('accepts resolved positive bounds', () => {
    expect(() => { validateConfig(config()) }).not.toThrow()
  })

  it('rejects empty names, invalid numbers, and a read cap above retention', () => {
    expect(() => { validateConfig(config({ backendType: '' })) }).toThrow('backendType')
    expect(() => { validateConfig(config({ shellPath: '' })) }).toThrow('shellPath')
    expect(() => { validateConfig(config({ rows: 0 })) }).toThrow('rows')
    expect(() => { validateConfig(config({ rows: 1.5 })) }).toThrow('rows')
    expect(() => { validateConfig(config({ maxReadBytes: 2048 })) }).toThrow('must not exceed')
  })

  it('rejects a handoff grace shorter than one readiness poll', () => {
    expect(() => { validateConfig(config({ handoffGraceMs: 9, pollIntervalMs: 10 })) }).toThrow('handoffGraceMs must be at least pollIntervalMs')
    expect(() => { validateConfig(config({ handoffGraceMs: 10, pollIntervalMs: 10 })) }).not.toThrow()
  })

  it('defaults the interactive shell to the host OS', () => {
    const expected = defaultShellInvocation()
    expect(expected.shellPath.length).toBeGreaterThan(0)
    expect(expected.shellArgs.length).toBeGreaterThan(0)
    if (process.platform === 'win32') {
      expect(expected).toEqual({ shellPath: 'powershell.exe', shellArgs: ['-NoLogo', '-NoProfile'] })
    } else {
      expect(expected).toEqual({ shellPath: '/bin/bash', shellArgs: ['--noprofile', '--norc', '-i'] })
    }
    const resolved = ConfigSchema({})
    expect(resolved.shellPath).toBe(expected.shellPath)
    expect(resolved.shellArgs).toEqual(expected.shellArgs)
  })
})
