import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))

function css(rel: string): string {
  return readFileSync(join(dir, rel), 'utf8')
}

describe('conversation chrome density', () => {
  it('keeps assistant, user, and composer text at 13px', () => {
    expect(css('../src/client/chat/AssistantMarkdown.module.css')).toMatch(
      /\.root\s*\{[^}]*font-size:\s*13px/s,
    )
    expect(css('../src/client/chat/MessageItem.module.css')).toMatch(
      /\.bubble\s*\{[^}]*font-size:\s*13px/s,
    )
    expect(css('../src/client/skeleton/InputBar.module.css')).toMatch(
      /\.card\s*\{[^}]*font-size:\s*13px/s,
    )
  })

  it('rebinds markdown tokens on the chat column so prose is not 16px', () => {
    const column = css('../src/client/chat/ChatView.module.css')
    expect(column).toMatch(/--dsw-font-markdown-base:\s*13px\/20px/)
    expect(column).toMatch(/--dsw-font-markdown-h2:\s*600 14px\/20px/)
    expect(column).toMatch(/--dsw-font-markdown-code-block:\s*12px\/18px/)
  })
})
