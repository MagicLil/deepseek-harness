import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/client/skeleton/ConversationRoot.module.css'),
  'utf8',
)

describe('composer review-dock attach', () => {
  it('flattens the input card top when a review dock is present', () => {
    expect(css).toMatch(/\[data-review-dock\]/)
    expect(css).toMatch(/\[data-composer-card\]/)
    expect(css).toMatch(/border-top-left-radius:\s*0/)
    expect(css).toMatch(/border-top-right-radius:\s*0/)
    expect(css).toMatch(/border-top:\s*none/)
  })
})
