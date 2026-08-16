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
    expect(css).toMatch(/\.frame\[data-settling\] \{[\s\S]*transition:\s*none/)
    expect(css).toMatch(/\.frame\[data-dragging\] \.editorCol/)
    expect(css).toMatch(/pointer-events:\s*none/)
  })

  it('reserves a desktop title-bar overlay strip and a no-drag chat toggle', () => {
    expect(css).toMatch(/\.frame\[data-title-overlay\] \.titleBar \{[\s\S]*grid-row:\s*1/)
    expect(css).toMatch(/\.frame\[data-title-overlay\] \.titleBar \{[\s\S]*-webkit-app-region:\s*drag/)
    expect(css).toMatch(/\.titleMenu \{[\s\S]*-webkit-app-region:\s*no-drag/)
    expect(css).toMatch(/\.titleBrand \{[\s\S]*flex-shrink:\s*0/)
    expect(css).toMatch(/\.titleBrand \{[\s\S]*margin-right:\s*8px/)
    expect(css).toMatch(/\.titleBrand \{[\s\S]*gap:\s*6px/)
    expect(css).toMatch(/\.titleBrand \{[\s\S]*pointer-events:\s*none/)
    expect(css).toMatch(/\.titleBrandName \{[\s\S]*font-size:\s*13px/)
    expect(css).toMatch(/\.conversationToggle \{[\s\S]*width:\s*32px/)
    expect(css).toMatch(/\.conversationToggle \{[\s\S]*height:\s*32px/)
    expect(css).toMatch(/\.titleMenu \{[\s\S]*overflow:\s*visible/)
    expect(css).toMatch(/\.titleSpacer \{[\s\S]*flex:\s*1/)
    expect(css).toMatch(/\.frame\[data-title-overlay\] \.titleBar \{[\s\S]*max-width:\s*calc\(100% - 138px\)/)
    expect(css).toMatch(/\.frame\[data-title-overlay\] \.editorCol \{[\s\S]*grid-row:\s*3/)
    expect(css).toMatch(/\.conversationToggle \{[\s\S]*display:\s*none/)
    expect(css).toMatch(/\.conversationToggle \{[\s\S]*-webkit-app-region:\s*no-drag/)
    expect(css).toMatch(/\.frame\[data-title-overlay\] \.conversationToggle \{[\s\S]*display:\s*flex/)
    expect(css).toMatch(/\.frame\[data-title-overlay\] \.conversationToggle \{[\s\S]*position:\s*relative/)
  })

  it('paints a Cursor-style full-length sash line above the overlay', () => {
    expect(css).toMatch(/\.handle \{[\s\S]*z-index:\s*21/)
    expect(css).toMatch(/\.handleRow \{[\s\S]*z-index:\s*21/)
    expect(css).toMatch(/\.handle \{[\s\S]*width:\s*16px/)
    expect(css).toMatch(/\.handle \{[\s\S]*-webkit-app-region:\s*no-drag/)
    expect(css).toMatch(/\.handle::after \{[\s\S]*top:\s*0;[\s\S]*bottom:\s*0;[\s\S]*width:\s*2px/)
    expect(css).toMatch(/--dsw-alias-state-business-primary/)
    expect(block('handle')).not.toMatch(/height:\s*32px/)
    expect(block('handle')).not.toMatch(/border-radius:\s*10px/)
  })
})
