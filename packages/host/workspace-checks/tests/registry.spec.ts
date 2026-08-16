/**
 * CheckRunRegistry unit tests with a fake subprocess handle.
 */
import { describe, expect, it, vi } from 'vitest'
import type { SubprocessHandle, SubprocessOutcome } from '@deepseek-ai/dsh-subprocess'
import { CheckRunRegistry, InvalidCheckError, SpawnFailedError } from '../src/registry.ts'

function fakeHandle(opts: {
  stdout?: string
  stderr?: string
  outcome?: SubprocessOutcome
  terminate?: () => void
}): SubprocessHandle {
  const stdoutText = opts.stdout ?? ''
  const stderrText = opts.stderr ?? ''
  let settled = false
  const outcome = opts.outcome ?? { exitCode: 0, signal: null }
  const done = Promise.resolve().then(() => {
    settled = true
    return outcome
  })
  return {
    pid: 1,
    stdin: undefined,
    stdout: undefined,
    stderr: undefined,
    collected: {
      stdout: {
        readFrom(from) {
          return {
            text: settled || from === 0 ? stdoutText.slice(from) : '',
            nextOffset: stdoutText.length,
            lossy: false,
          }
        },
      },
      stderr: {
        readFrom(from) {
          return {
            text: stderrText.slice(from),
            nextOffset: stderrText.length,
            lossy: false,
          }
        },
      },
    },
    done,
    terminate: opts.terminate ?? (() => undefined),
    waitForExit: async () => true,
  }
}

describe('CheckRunRegistry', () => {
  it('rejects empty argv / cwd', async () => {
    const reg = new CheckRunRegistry(() => fakeHandle({}))
    await expect(reg.start('', ['pnpm'])).rejects.toBeInstanceOf(InvalidCheckError)
    await expect(reg.start('/w', [])).rejects.toBeInstanceOf(InvalidCheckError)
  })

  it('surfaces spawn failures', async () => {
    const reg = new CheckRunRegistry(() => {
      throw new Error('boom')
    })
    await expect(reg.start('/w', ['pnpm', 'run', 'lint'])).rejects.toBeInstanceOf(SpawnFailedError)
  })

  it('starts, polls, and settles as passed', async () => {
    const reg = new CheckRunRegistry(() => fakeHandle({
      stdout: 'ok\n',
      outcome: { exitCode: 0, signal: null },
    }))
    const { runId } = await reg.start('/w', ['pnpm', 'run', 'lint'], 'lint')
    await Promise.resolve()
    await Promise.resolve()
    const polled = reg.poll(runId, 0, 0)
    expect(polled.ok).toBe(true)
    expect(polled.status).toBe('passed')
    expect(polled.stdout).toContain('ok')
    expect(polled.label).toBe('lint')
  })

  it('emits async spawn rejection into stderr once', async () => {
    const base = fakeHandle({ outcome: { exitCode: 1, signal: null } })
    const handle: SubprocessHandle = {
      ...base,
      done: Promise.reject(new Error('spawn pnpm ENOENT')),
    }
    const reg = new CheckRunRegistry(() => handle)
    const { runId } = await reg.start('/w', ['pnpm', 'run', 'lint'])
    await Promise.resolve()
    await Promise.resolve()
    const first = reg.poll(runId, 0, 0)
    expect(first.status).toBe('failed')
    expect(first.stderr).toContain('spawn failed: spawn pnpm ENOENT')
    expect(first.stderrNext).toBeGreaterThan(0)
    const second = reg.poll(runId, 0, first.stderrNext)
    expect(second.stderr).toBe('')
  })

  it('marks non-zero exit as failed and stop as stopped', async () => {
    let resolveDone!: (o: SubprocessOutcome) => void
    const done = new Promise<SubprocessOutcome>((resolve) => { resolveDone = resolve })
    const terminate = vi.fn(() => {
      resolveDone({ exitCode: null, signal: 'SIGTERM' })
    })
    const handle: SubprocessHandle = {
      ...fakeHandle({}),
      done,
      terminate,
      waitForExit: async () => true,
      collected: {
        stdout: { readFrom: from => ({ text: '', nextOffset: from, lossy: false }) },
        stderr: { readFrom: from => ({ text: '', nextOffset: from, lossy: false }) },
      },
    }
    const reg = new CheckRunRegistry(() => handle)
    const { runId } = await reg.start('/w', ['pnpm', 'run', 'test'])
    expect(reg.poll(runId, 0, 0).status).toBe('running')
    expect(await reg.stop(runId)).toBe(true)
    expect(terminate).toHaveBeenCalledOnce()
    expect(reg.poll(runId, 0, 0).status).toBe('stopped')
    expect(reg.poll('missing', 0, 0).ok).toBe(false)
  })

  it('replaces a live run on a second start', async () => {
    let n = 0
    let resolveFirst!: (o: SubprocessOutcome) => void
    const firstDone = new Promise<SubprocessOutcome>((resolve) => { resolveFirst = resolve })
    const terminate = vi.fn(() => {
      resolveFirst({ exitCode: null, signal: 'SIGTERM' })
    })
    const reg = new CheckRunRegistry(() => {
      n += 1
      if (n === 1) {
        return {
          ...fakeHandle({ stdout: 'run1', terminate }),
          done: firstDone,
        }
      }
      return fakeHandle({
        stdout: 'run2',
        outcome: { exitCode: 0, signal: null },
      })
    })
    const first = await reg.start('/w', ['a'])
    expect(reg.poll(first.runId, 0, 0).status).toBe('running')
    const second = await reg.start('/w', ['b'])
    expect(first.runId).not.toBe(second.runId)
    expect(terminate).toHaveBeenCalled()
    await Promise.resolve()
    await Promise.resolve()
    expect(reg.poll(second.runId, 0, 0).status).toBe('passed')
  })
},
)
