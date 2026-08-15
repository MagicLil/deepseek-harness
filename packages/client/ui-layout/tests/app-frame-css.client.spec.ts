import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/client/AppFrame.module.css'),
  'utf8',
)

function block(name: string): string {
  const match = css.match(new RegExp(`\\.${name} \\{([^}]+)\\}`))
  if (match?.[1] === undefined) throw new Error(`missing .${name}`)
  return match[1]
}

describe('AppFrame column layout contract', () => {
  it('gives the editor column the same flex seat as the primary sidebar', () => {
    const editor = block('editorCol')
    const primary = block('primaryCol')
    for (const rule of [editor, primary]) {
      expect(rule).toMatch(/position:\s*relative/)
      expect(rule).toMatch(/display:\s*flex/)
      expect(rule).toMatch(/flex-direction:\s*column/)
      expect(rule).toMatch(/min-height:\s*0/)
      expect(rule).toMatch(/min-width:\s*0/)
      expect(rule).toMatch(/overflow:\s*hidden/)
    }
  })
})
