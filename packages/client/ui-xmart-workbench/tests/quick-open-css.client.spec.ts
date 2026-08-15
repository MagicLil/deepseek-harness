import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/client/QuickOpen.module.css'),
  'utf8',
)

describe('QuickOpen palette surface', () => {
  it('uses the opaque menu surface so editor text cannot show through', () => {
    expect(css).toMatch(/\.panel[\s\S]*background:\s*var\(--dsw-specific-menu\)/)
    expect(css).not.toMatch(/--dsw-alias-bg-elevated/)
    expect(css).toMatch(/\.backdrop[\s\S]*background:\s*var\(--dsw-alias-bg-mask-1\)/)
  })
})
