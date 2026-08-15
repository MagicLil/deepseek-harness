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
    expect(editor).toMatch(/isolation:\s*isolate/)
    expect(editor).toMatch(/background:\s*var\(--dsw-alias-bg-base\)/)
  })

  it('disables grid easing and descendant pointer events while dragging', () => {
    expect(css).toMatch(/\.frame\[data-dragging\] \{[\s\S]*transition:\s*none/)
    expect(css).toMatch(/\.frame\[data-dragging\] \{[\s\S]*user-select:\s*none/)
    expect(css).toMatch(/\.frame\[data-dragging\] \.editorCol/)
    expect(css).toMatch(/pointer-events:\s*none/)
  })

  it('paints a Cursor-style full-length sash line above the overlay', () => {
    expect(css).toMatch(/\.handle \{[\s\S]*z-index:\s*21/)
    expect(css).toMatch(/\.handleRow \{[\s\S]*z-index:\s*21/)
    expect(css).toMatch(/\.handle::after \{[\s\S]*top:\s*0;[\s\S]*bottom:\s*0;[\s\S]*width:\s*2px/)
    expect(css).toMatch(/--dsw-alias-state-business-primary/)
    expect(css).not.toMatch(/height:\s*32px/)
    expect(css).not.toMatch(/border-radius:\s*10px/)
  })
})
