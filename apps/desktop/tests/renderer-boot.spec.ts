import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('desktop renderer boot invariants', () => {
  it('keeps preload CommonJS so the sandbox can load it', () => {
    const preload = readFileSync(new URL('../preload.mjs', import.meta.url), 'utf8')
    expect(preload).toContain("require('electron')")
    expect(preload).not.toMatch(/^import /m)
    expect(preload).toContain('dsh:title-bar-overlay')
    expect(preload).toContain('setTitleBarOverlay')
  })

  it('allows unsafe-eval so the inlined cordis loader can construct !!js evaluators', () => {
    const shell = readFileSync(new URL('../src/shell.ts', import.meta.url), 'utf8')
    expect(shell).toContain("'unsafe-eval'")
  })
})
