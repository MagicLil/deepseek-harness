/**
 * WorkspaceChecksGateway remote surface.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import WorkspaceChecksGateway from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

class FakeSubprocess extends SubprocessRuntime {
  spawnImpl = vi.fn((spec: SubprocessSpawnSpec): SubprocessHandle => ({
    pid: 42,
    stdin: undefined,
    stdout: undefined,
    stderr: undefined,
    collected: {
      stdout: {
        readFrom: from => ({
          text: from === 0 ? `cwd=${spec.cwd}\nargv0=${spec.argv[0]}\n` : '',
          nextOffset: `cwd=${spec.cwd}\nargv0=${spec.argv[0]}\n`.length,
          lossy: false,
        }),
      },
      stderr: {
        readFrom: from => ({ text: '', nextOffset: from, lossy: false }),
      },
    },
    done: Promise.resolve({ exitCode: 0, signal: null }),
    terminate: () => undefined,
    waitForExit: async () => true,
  }))

  resolveExecutable(command: string): Promise<string> {
    return Promise.resolve(command === 'pnpm' ? String.raw`C:\tools\pnpm.cmd` : command)
  }

  spawn(spec: SubprocessSpawnSpec): SubprocessHandle {
    return this.spawnImpl(spec)
  }

  spawnTerminal(): never {
    throw new Error('unused')
  }
}

describe('WorkspaceChecksGateway', () => {
  it('publishes remotes and runs through subprocess', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(FakeSubprocess)
    await ctx.plugin(WorkspaceChecksGateway)
    const gw = ctx.get('workspaceChecks') as WorkspaceChecksGateway
    const sub = ctx.get('subprocess') as FakeSubprocess
    expect(gw.typertRemote).toMatchObject({
      serviceKey: 'workspaceChecks',
      namespace: 'workspaceChecks',
    })
    expect(remoteMethods(gw).map(item => item.method)).toEqual(['start', 'poll', 'stop'])
    const started = await gw.start({
      workspaceRoot: '/w',
      argv: ['pnpm', 'run', 'lint'],
      label: 'lint',
    })
    expect(started).toEqual({ ok: true, runId: expect.any(String) })
    expect(sub.spawnImpl).toHaveBeenCalledOnce()
    const spawnArg = sub.spawnImpl.mock.calls[0]?.[0] as SubprocessSpawnSpec
    if (process.platform === 'win32') {
      expect(spawnArg.argv[0]).toBe('cmd.exe')
      expect(spawnArg.env).toMatchObject({
        DSH_WORKSPACE_CHECKS_EXECUTABLE: String.raw`"C:\tools\pnpm.cmd"`,
      })
    } else {
      expect(spawnArg.argv[0]).toBe(String.raw`C:\tools\pnpm.cmd`)
    }
    if (!started.ok) throw new Error('expected ok')
    await Promise.resolve()
    await Promise.resolve()
    const polled = await gw.poll({ runId: started.runId, stdoutFrom: 0, stderrFrom: 0 })
    expect(polled.ok).toBe(true)
    expect(polled.status).toBe('passed')
    expect(polled.stdout).toContain('cwd=/w')
    expect(await gw.stop({ runId: started.runId })).toEqual({ ok: false })
    expect(await gw.start({ workspaceRoot: '', argv: ['x'] })).toMatchObject({
      ok: false,
      error: { code: 'invalid' },
    })
  })
})
