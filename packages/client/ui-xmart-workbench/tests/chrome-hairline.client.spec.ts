import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const column = readFileSync(join(dir, '../src/client/WorkbenchColumn.module.css'), 'utf8')
const editor = readFileSync(join(dir, '../src/client/EditorTab.module.css'), 'utf8')

describe('editor / conversation header hairline', () => {
  it('keeps the file tab strip on the 36px conversation header seat', () => {
    expect(column).toMatch(/\.bar\s*\{[^}]*height:\s*36px/s)
    expect(column).toMatch(/\.bar\s*\{[^}]*border-bottom:\s*1px solid var\(--dsw-alias-border-l2\)/s)
  })

  it('does not paint a second rule under the editor path / save row', () => {
    const bar = editor.match(/\.bar\s*\{[^}]*\}/s)?.[0] ?? ''
    expect(bar).not.toMatch(/border-bottom/)
  })
})
