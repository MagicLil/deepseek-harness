import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/client/EditorTab.module.css'),
  'utf8',
)

describe('EditorTab fallback textarea', () => {
  it('hides the fallback once Monaco is ready without collapsing the pane', () => {
    expect(css).toMatch(/\.pane:has\(\[data-ready\]\) \.plain/)
    expect(css).toMatch(/visibility:\s*hidden/)
    expect(css).toMatch(/pointer-events:\s*none/)
  })
})
