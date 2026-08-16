/**
 * Windows ConPTY must emit a PowerShell prompt. The workbench xterm stays
 * black when this substrate produces zero bytes.
 */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LocalSubprocessRuntime from '../src/index.ts'

describe.skipIf(process.platform !== 'win32')('Windows ConPTY output', () => {
  it('emits a PowerShell prompt within 5s', async () => {
    const ctx = new Context()
    await ctx.plugin(LocalSubprocessRuntime)
    const chunks: string[] = []
    const handle = await ctx.subprocess.spawnTerminal({
      argv: ['powershell.exe', '-NoLogo', '-NoProfile'],
      cwd: process.cwd(),
      rows: 24,
      cols: 80,
      graceMs: 1000,
    })
    handle.output.on('data', (buf: Buffer | string) => {
      chunks.push(typeof buf === 'string' ? buf : buf.toString('utf8'))
    })
    const deadline = Date.now() + 5000
    while (Date.now() < deadline && !/PS |>/.test(chunks.join(''))) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    const text = chunks.join('')
    try {
      expect(text.length, `empty ConPTY output: ${JSON.stringify(text)}`).toBeGreaterThan(0)
      expect(text, `no prompt in ${JSON.stringify(text)}`).toMatch(/PS |>/)
    } finally {
      await Promise.race([
        handle.terminate(),
        new Promise<void>(resolve => setTimeout(resolve, 3000)),
      ])
    }
  }, 15_000)
})
