/**
 * Smoke: resolve pnpm + wrap .cmd under cmd.exe, capture --version.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import WorkspaceChecksGateway from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

describe('WorkspaceChecksGateway Windows pnpm smoke', () => {
  it.skipIf(process.platform !== 'win32')('runs pnpm --version through cmd shim', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(LocalSubprocessRuntime)
    await ctx.plugin(WorkspaceChecksGateway)
    const gw = ctx.get('workspaceChecks') as WorkspaceChecksGateway
    const started = await gw.start({
      workspaceRoot: process.cwd(),
      argv: ['pnpm', '--version'],
      label: 'version',
    })
    expect(started.ok).toBe(true)
    if (!started.ok) return
    let stdout = ''
    let stderr = ''
    let status = 'running'
    let exitCode: number | null = null
    let stdoutFrom = 0
    let stderrFrom = 0
    for (let i = 0; i < 50; i++) {
      const polled = await gw.poll({
        runId: started.runId,
        stdoutFrom,
        stderrFrom,
      })
      stdout += polled.stdout
      stderr += polled.stderr
      stdoutFrom = polled.stdoutNext
      stderrFrom = polled.stderrNext
      status = polled.status
      exitCode = polled.exitCode
      if (polled.status !== 'running') break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    expect({ status, exitCode, stdout, stderr }).toEqual(expect.objectContaining({
      status: 'passed',
      exitCode: 0,
    }))
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
  }, 15_000)
})
