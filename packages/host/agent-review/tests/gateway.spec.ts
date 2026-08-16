import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import type { ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import AgentReviewGateway, { resolveToolPath } from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

function fakeExec(over: {
  name: string
  arguments: unknown
  sessionId: string
  cwd: string
  turn: number
}): ToolExecution {
  return {
    callId: 'c1' as ToolExecution['callId'],
    rootCallId: 'c1' as ToolExecution['rootCallId'],
    token: Symbol('t') as ToolExecution['token'],
    signal: new AbortController().signal,
    name: over.name,
    arguments: over.arguments,
    agent: {
      session: {
        header: { id: over.sessionId, cwd: over.cwd },
        events: [{ type: 'turn/start', data: { turn: over.turn } }],
      },
    },
  } as unknown as ToolExecution
}

describe('AgentReviewGateway', () => {
  it('publishes remotes and captures through tools/pre-execute', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-review-gw-'))
    const workspace = await mkdtemp(join(tmpdir(), 'dsh-review-gwws-'))
    const file = join(workspace, 'a.txt')
    await writeFile(file, 'one\n', 'utf8')

    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(AgentReviewGateway, { dshHome: home })
    const gw = ctx.get('agentReview') as AgentReviewGateway
    expect(gw.typertRemote).toMatchObject({ serviceKey: 'agentReview', namespace: 'agentReview' })
    expect(remoteMethods(gw).map(item => item.method).sort()).toEqual([
      'accept',
      'acceptAll',
      'diff',
      'dismissShell',
      'get',
      'revert',
      'revertAll',
    ])

    const exec = fakeExec({
      name: 'edit',
      arguments: { file_path: 'a.txt' },
      sessionId: 'sess-1',
      cwd: workspace,
      turn: 1,
    })
    const decision = await ctx.waterfall(
      'tools/pre-execute',
      exec,
      () => Promise.resolve({ kind: 'allow' as const }),
    )
    expect(decision).toEqual({ kind: 'allow' })

    await writeFile(file, 'two\n', 'utf8')
    ctx.emit('tools/result', exec, { isError: false, content: [] } as ToolExecutionResult)

    await new Promise(resolve => setTimeout(resolve, 30))
    const review = await gw.get({ sessionId: 'sess-1' })
    expect(review.turns[0]!.files[0]).toMatchObject({
      path: file,
      kind: 'update',
      status: 'pending',
    })
    expect((await gw.diff({ sessionId: 'sess-1', turn: 1, path: file })).before).toBe('one\n')
    expect((await gw.accept({ sessionId: 'sess-1', turn: 1, path: file })).ok).toBe(true)
    expect((await gw.acceptAll({ sessionId: 'sess-1', turn: 1 })).ok).toBe(true)
    expect((await gw.revert({ sessionId: 'sess-1', turn: 1, path: file })).error).toBe('not-pending')
    expect((await gw.revertAll({ sessionId: 'sess-1', turn: 1 })).ok).toBe(true)
  })

  it('marks shell tools and resolveToolPath joins cwd', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-review-shell-'))
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(AgentReviewGateway, { dshHome: home })
    const gw = ctx.get('agentReview') as AgentReviewGateway
    const exec = fakeExec({
      name: 'bash',
      arguments: { command: 'echo hi' },
      sessionId: 'sess-2',
      cwd: '/tmp',
      turn: 4,
    })
    await ctx.waterfall('tools/pre-execute', exec, () => Promise.resolve({ kind: 'allow' as const }))
    expect((await gw.get({ sessionId: 'sess-2' })).turns[0]).toMatchObject({
      turn: 4,
      shellMaybeMutated: true,
      files: [],
    })
    expect(resolveToolPath('/abs/x', '/cwd')).toBe('/abs/x')
    const cwd = join(tmpdir(), 'review-cwd')
    expect(resolveToolPath('rel.txt', cwd)).toBe(join(cwd, 'rel.txt'))
  })

  it('captures pwsh Remove-Item as pending delete and reverts', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-review-pwsh-'))
    const workspace = await mkdtemp(join(tmpdir(), 'dsh-review-pwshws-'))
    const file = join(workspace, 'tmp-test-file.txt')
    await writeFile(file, 'temp\n', 'utf8')

    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(AgentReviewGateway, { dshHome: home })
    const gw = ctx.get('agentReview') as AgentReviewGateway
    const exec = fakeExec({
      name: 'pwsh',
      arguments: { command: 'Remove-Item tmp-test-file.txt' },
      sessionId: 'sess-pwsh',
      cwd: workspace,
      turn: 7,
    })
    await ctx.waterfall('tools/pre-execute', exec, () => Promise.resolve({ kind: 'allow' as const }))
    await rm(file)
    ctx.emit('tools/result', exec, {
      isError: false,
      value: null,
      content: [],
    } as ToolExecutionResult)
    await new Promise(resolve => setTimeout(resolve, 30))
    const review = await gw.get({ sessionId: 'sess-pwsh' })
    expect(review.turns[0]).toMatchObject({ shellMaybeMutated: true })
    expect(review.turns[0]!.files[0]).toMatchObject({
      path: file,
      kind: 'delete',
      status: 'pending',
    })
    expect((await gw.revert({ sessionId: 'sess-pwsh', turn: 7, path: file })).ok).toBe(true)
    expect(await readFile(file, 'utf8')).toBe('temp\n')
  })
})
