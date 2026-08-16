import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/markdown/MarkdownText.module.css'),
  'utf8',
)

describe('markdown link chrome', () => {
  it('binds anchors and file mentions to body text, not business-primary', () => {
    expect(css).toMatch(/\.markdown a \{[\s\S]*color:\s*var\(--dsw-alias-label-primary\)/)
    expect(css).toMatch(
      /\.markdown a:hover,[\s\S]*text-decoration:\s*underline var\(--dsw-alias-label-primary\)/,
    )
    expect(css).toMatch(/\.fileMention \{[\s\S]*color:\s*var\(--dsw-alias-label-primary\)/)
    expect(css).not.toMatch(/\.markdown a \{[\s\S]*--dsw-alias-state-business-primary/)
  })
})
