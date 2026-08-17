import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import type { ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import AgentReviewGateway, { resolveToolPath } from '../src/index.ts'

const execFileAsync = promisify(execFile)

function okResult(): ToolExecutionResult {
  return { isError: false, value: null, content: [] }
}

function errResult(): ToolExecutionResult {
  return { isError: true, error: { message: 'failed' }, content: [] }
}

async function waitForTurn(
  gw: AgentReviewGateway,
  sessionId: string,
  timeoutMs = 8_000,
): Promise<NonNullable<Awaited<ReturnType<AgentReviewGateway['get']>>['turns'][0]>> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const review = await gw.get({ sessionId })
    const turn = review.turns[0]
    if (turn !== undefined) return turn
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`review turn for ${sessionId} did not appear`)
}

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd, windowsHide: true })
}

async function initRepo(cwd: string): Promise<void> {
  await git(cwd, ['init'])
  await git(cwd, ['config', 'user.email', 'review@test'])
  await git(cwd, ['config', 'user.name', 'review'])
}

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

function fakeExec(over: {
  name: string
  arguments: unknown
  sessionId: string
  cwd?: string
  turn: number
  callId?: string
}): ToolExecution {
  return {
    callId: (over.callId ?? 'c1') as ToolExecution['callId'],
    rootCallId: (over.callId ?? 'c1') as ToolExecution['rootCallId'],
    token: Symbol('t') as ToolExecution['token'],
    signal: new AbortController().signal,
    name: over.name,
    arguments: over.arguments,
    agent: {
      session: {
        header: {
          id: over.sessionId,
          ...(over.cwd !== undefined ? { cwd: over.cwd } : {}),
        },
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
    ctx.emit('tools/result', exec, okResult())

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
    ctx.emit('tools/result', exec, okResult())
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

  it('captures cursor_agent creates from a git status diff so Keep/Undo work', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-review-acp-'))
    const workspace = await mkdtemp(join(tmpdir(), 'dsh-review-acpws-'))
    await initRepo(workspace)
    const created = join(workspace, 'temp-cursor.txt')
    const preexisting = join(workspace, 'already.txt')
    await writeFile(preexisting, 'leave-me\n', 'utf8')

    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(AgentReviewGateway, { dshHome: home })
    const gw = ctx.get('agentReview') as AgentReviewGateway
    const exec = fakeExec({
      name: 'cursor_agent',
      arguments: { description: 'write temp', prompt: 'write a temp file' },
      sessionId: 'sess-acp',
      cwd: workspace,
      turn: 3,
    })
    await ctx.waterfall('tools/pre-execute', exec, () => Promise.resolve({ kind: 'allow' as const }))
    await writeFile(created, '我爱你\n', 'utf8')
    ctx.emit('tools/result', exec, okResult())
    const turn = await waitForTurn(gw, 'sess-acp')
    expect(turn.files).toHaveLength(1)
    const path = turn.files[0]!.path
    expect(path.replaceAll('\\', '/').endsWith('temp-cursor.txt')).toBe(true)
    expect(turn.files[0]).toMatchObject({
      kind: 'create',
      status: 'pending',
    })
    expect((await gw.diff({ sessionId: 'sess-acp', turn: 3, path })).after).toBe('我爱你\n')
    expect((await gw.revert({ sessionId: 'sess-acp', turn: 3, path })).ok).toBe(true)
    await expect(readFile(created, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(preexisting, 'utf8')).toBe('leave-me\n')
  })

  it('captures cursor_agent updates of a committed file from HEAD', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-review-acpup-'))
    const workspace = await mkdtemp(join(tmpdir(), 'dsh-review-acpupws-'))
    await initRepo(workspace)
    const tracked = join(workspace, 'tracked.txt')
    await writeFile(tracked, 'old\n', 'utf8')
    await git(workspace, ['add', 'tracked.txt'])
    await git(workspace, ['commit', '-m', 'init', '--no-gpg-sign'])

    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(AgentReviewGateway, { dshHome: home })
    const gw = ctx.get('agentReview') as AgentReviewGateway
    const exec = fakeExec({
      name: 'cursor_agent',
      arguments: { prompt: 'edit' },
      sessionId: 'sess-up',
      cwd: workspace,
      turn: 1,
    })
    await ctx.waterfall('tools/pre-execute', exec, () => Promise.resolve({ kind: 'allow' as const }))
    await writeFile(tracked, 'new\n', 'utf8')
    ctx.emit('tools/result', exec, okResult())
    const path = (await waitForTurn(gw, 'sess-up')).files[0]!.path
    expect((await gw.diff({ sessionId: 'sess-up', turn: 1, path })).before).toBe('old\n')
    expect((await gw.revert({ sessionId: 'sess-up', turn: 1, path })).ok).toBe(true)
    expect(await readFile(tracked, 'utf8')).toBe('old\n')
  })

  it('captures cursor_agent creates from prompt paths when git is missing', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-review-hint-'))
    const workspace = await mkdtemp(join(tmpdir(), 'dsh-review-hintws-'))
    const created = join(workspace, 'temp-who-are-you.txt')
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(AgentReviewGateway, { dshHome: home })
    const gw = ctx.get('agentReview') as AgentReviewGateway
    const exec = fakeExec({
      name: 'cursor_agent',
      arguments: { prompt: `create temp-who-are-you.txt at ${workspace}` },
      sessionId: 'sess-hint',
      cwd: workspace,
      turn: 2,
    })
    await ctx.waterfall('tools/pre-execute', exec, () => Promise.resolve({ kind: 'allow' as const }))
    await writeFile(created, '你是谁\n', 'utf8')
    ctx.emit('tools/result', exec, {
      isError: false,
      value: null,
      content: [{ type: 'text', text: `created ${created}` }],
    })
    const turn = await waitForTurn(gw, 'sess-hint')
    expect(turn.shellMaybeMutated).toBe(false)
    expect(turn.files).toHaveLength(1)
    expect(turn.files[0]).toMatchObject({
      path: created,
      kind: 'create',
      status: 'pending',
    })
    expect((await gw.revert({ sessionId: 'sess-hint', turn: 2, path: created })).ok).toBe(true)
    await expect(readFile(created, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('captures a gitignored cursor_agent create mentioned in the prompt', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-review-ign-'))
    const workspace = await mkdtemp(join(tmpdir(), 'dsh-review-ignws-'))
    await initRepo(workspace)
    await writeFile(join(workspace, '.gitignore'), 'temp-hidden.txt\n', 'utf8')
    const created = join(workspace, 'temp-hidden.txt')
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(AgentReviewGateway, { dshHome: home })
    const gw = ctx.get('agentReview') as AgentReviewGateway
    const exec = fakeExec({
      name: 'cursor_agent',
      arguments: { prompt: `create temp-hidden.txt in ${workspace}` },
      sessionId: 'sess-ign',
      cwd: workspace,
      turn: 1,
    })
    await ctx.waterfall('tools/pre-execute', exec, () => Promise.resolve({ kind: 'allow' as const }))
    await writeFile(created, 'hidden\n', 'utf8')
    ctx.emit('tools/result', exec, okResult())
    const turn = await waitForTurn(gw, 'sess-ign')
    expect(turn.files.some(file => file.path === created && file.kind === 'create')).toBe(true)
    expect(turn.shellMaybeMutated).toBe(false)
  })

  it('captures cursor_agent updates and deletes from prompt paths without git', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-review-hintud-'))
    const workspace = await mkdtemp(join(tmpdir(), 'dsh-review-hintudws-'))
    const edited = join(workspace, 'edit-me.txt')
    const removed = join(workspace, 'drop-me.txt')
    await writeFile(edited, 'old\n', 'utf8')
    await writeFile(removed, 'bye\n', 'utf8')
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(AgentReviewGateway, { dshHome: home })
    const gw = ctx.get('agentReview') as AgentReviewGateway
    const exec = fakeExec({
      name: 'cursor_agent',
      arguments: { prompt: `edit edit-me.txt and delete drop-me.txt in ${workspace}` },
      sessionId: 'sess-hintud',
      cwd: workspace,
      turn: 8,
    })
    await ctx.waterfall('tools/pre-execute', exec, () => Promise.resolve({ kind: 'allow' as const }))
    await writeFile(edited, 'new\n', 'utf8')
    await rm(removed)
    ctx.emit('tools/result', exec, okResult())
    const turn = await waitForTurn(gw, 'sess-hintud')
    expect(turn.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: edited, kind: 'update', status: 'pending' }),
      expect.objectContaining({ path: removed, kind: 'delete', status: 'pending' }),
    ]))
    expect((await gw.revert({ sessionId: 'sess-hintud', turn: 8, path: edited })).ok).toBe(true)
    expect(await readFile(edited, 'utf8')).toBe('old\n')
  })

  it('imports a result-only create and skips an unchanged mentioned file', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-review-res-'))
    const workspace = await mkdtemp(join(tmpdir(), 'dsh-review-resws-'))
    const keep = join(workspace, 'keep.txt')
    const created = join(workspace, 'fresh.txt')
    await writeFile(keep, 'same\n', 'utf8')
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(AgentReviewGateway, { dshHome: home, maxShadowBytes: 8 })
    const gw = ctx.get('agentReview') as AgentReviewGateway
    const unchanged = fakeExec({
      name: 'cursor_agent',
      arguments: { prompt: 'touch keep.txt' },
      sessionId: 'sess-keep',
      cwd: workspace,
      turn: 1,
      callId: 'keep',
    })
    await ctx.waterfall('tools/pre-execute', unchanged, () => Promise.resolve({ kind: 'allow' as const }))
    ctx.emit('tools/result', unchanged, okResult())
    expect(await waitForTurn(gw, 'sess-keep')).toMatchObject({
      shellMaybeMutated: true,
      files: [],
    })

    const oversize = join(workspace, 'big.txt')
    await writeFile(oversize, '1234567890', 'utf8')
    const bigExec = fakeExec({
      name: 'cursor_agent',
      arguments: { prompt: `edit big.txt in ${workspace}` },
      sessionId: 'sess-big',
      cwd: workspace,
      turn: 2,
      callId: 'big',
    })
    await ctx.waterfall('tools/pre-execute', bigExec, () => Promise.resolve({ kind: 'allow' as const }))
    await writeFile(oversize, 'changed-oversize', 'utf8')
    ctx.emit('tools/result', bigExec, okResult())
    expect(await waitForTurn(gw, 'sess-big')).toMatchObject({
      shellMaybeMutated: false,
      files: [expect.objectContaining({ path: oversize, kind: 'update', status: 'irreversible' })],
    })

    const createExec = fakeExec({
      name: 'cursor_agent',
      arguments: { prompt: 'write something' },
      sessionId: 'sess-res',
      cwd: workspace,
      turn: 3,
      callId: 'res',
    })
    await ctx.waterfall('tools/pre-execute', createExec, () => Promise.resolve({ kind: 'allow' as const }))
    await writeFile(created, 'hi\n', 'utf8')
    ctx.emit('tools/result', createExec, {
      isError: false,
      value: null,
      content: [{ type: 'text', text: `created ${created}` }],
    })
    const createdTurn = await waitForTurn(gw, 'sess-res')
    expect(createdTurn.files.some(file => file.path === created && file.kind === 'create')).toBe(true)
  })

  it('marks shell when opaque capture has no git, no cwd, or a missing snapshot', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-review-opaque-miss-'))
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(AgentReviewGateway, {
      dshHome: home,
      opaqueMutationTools: ['my_bot'],
    })
    const gw = ctx.get('agentReview') as AgentReviewGateway

    const noGit = fakeExec({
      name: 'my_bot',
      arguments: {},
      sessionId: 'sess-nogit',
      cwd: await mkdtemp(join(tmpdir(), 'dsh-review-nongit-')),
      turn: 1,
    })
    await ctx.waterfall('tools/pre-execute', noGit, () => Promise.resolve({ kind: 'allow' as const }))
    ctx.emit('tools/result', noGit, okResult())
    expect(await waitForTurn(gw, 'sess-nogit')).toMatchObject({
      shellMaybeMutated: true,
      files: [],
    })
    expect((await gw.dismissShell({ sessionId: 'sess-nogit', turn: 1 })).ok).toBe(true)
    expect((await gw.get({ sessionId: 'sess-nogit' })).turns[0]!.shellMaybeMutated).toBe(false)

    const emptyCwd = fakeExec({
      name: 'cursor_agent',
      arguments: {},
      sessionId: 'sess-emptycwd',
      cwd: '',
      turn: 5,
    })
    await ctx.waterfall('tools/pre-execute', emptyCwd, () => Promise.resolve({ kind: 'allow' as const }))
    ctx.emit('tools/result', emptyCwd, okResult())
    await new Promise(resolve => setTimeout(resolve, 30))
    expect((await gw.get({ sessionId: 'sess-emptycwd' })).turns[0]!.shellMaybeMutated).toBe(true)

    const noCwd = fakeExec({
      name: 'cursor_agent',
      arguments: {},
      sessionId: 'sess-nocwd',
      turn: 2,
    })
    await ctx.waterfall('tools/pre-execute', noCwd, () => Promise.resolve({ kind: 'allow' as const }))
    ctx.emit('tools/result', noCwd, okResult())
    await new Promise(resolve => setTimeout(resolve, 30))
    expect((await gw.get({ sessionId: 'sess-nocwd' })).turns[0]!.shellMaybeMutated).toBe(true)

    const workspace = await mkdtemp(join(tmpdir(), 'dsh-review-cwdswap-'))
    await initRepo(workspace)
    const snapExec = fakeExec({
      name: 'cursor_agent',
      arguments: {},
      sessionId: 'sess-cwdswap',
      cwd: workspace,
      turn: 6,
      callId: 'swap',
    })
    await ctx.waterfall('tools/pre-execute', snapExec, () => Promise.resolve({ kind: 'allow' as const }))
    const settleEmpty = fakeExec({
      name: 'cursor_agent',
      arguments: {},
      sessionId: 'sess-cwdswap',
      cwd: '',
      turn: 6,
      callId: 'swap',
    })
    ctx.emit('tools/result', settleEmpty, okResult())
    await new Promise(resolve => setTimeout(resolve, 30))
    expect((await gw.get({ sessionId: 'sess-cwdswap' })).turns[0]!.shellMaybeMutated).toBe(true)

    const orphan = fakeExec({
      name: 'cursor_agent',
      arguments: {},
      sessionId: 'sess-orphan',
      cwd: home,
      turn: 4,
      callId: 'orphan',
    })
    ctx.emit('tools/result', orphan, okResult())
    await new Promise(resolve => setTimeout(resolve, 30))
    expect((await gw.get({ sessionId: 'sess-orphan' })).turns[0]!.shellMaybeMutated).toBe(true)

    const dirty = join(workspace, 'dirty.txt')
    await writeFile(dirty, 'dirt\n', 'utf8')
    const tracked = join(workspace, 'tracked-head.txt')
    await writeFile(tracked, 'head\n', 'utf8')
    await git(workspace, ['add', 'tracked-head.txt'])
    await git(workspace, ['commit', '-m', 'head', '--no-gpg-sign'])
    const snapHint = fakeExec({
      name: 'cursor_agent',
      arguments: {},
      sessionId: 'sess-inbefore',
      cwd: workspace,
      turn: 8,
      callId: 'inbefore',
    })
    await ctx.waterfall('tools/pre-execute', snapHint, () => Promise.resolve({ kind: 'allow' as const }))
    const settleHint = fakeExec({
      name: 'cursor_agent',
      arguments: {},
      sessionId: 'sess-inbefore',
      cwd: '',
      turn: 8,
      callId: 'inbefore',
    })
    ctx.emit('tools/result', settleHint, {
      isError: false,
      value: null,
      content: [{ type: 'text', text: `touched ${dirty} and ${tracked} and ${join(workspace, 'missing-nope.txt')}` }],
    })
    const hintedTurn = await waitForTurn(gw, 'sess-inbefore')
    expect(hintedTurn.shellMaybeMutated).toBe(false)
    expect(hintedTurn.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: dirty, kind: 'update' }),
    ]))
  })

  it('imports a same-content overwrite named in the prompt and result without git', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-review-same-'))
    const workspace = await mkdtemp(join(tmpdir(), 'dsh-review-samews-'))
    const target = join(workspace, 'temp-who-are-you.txt')
    await writeFile(target, '你是谁\n', 'utf8')
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(AgentReviewGateway, { dshHome: home })
    const gw = ctx.get('agentReview') as AgentReviewGateway
    const exec = fakeExec({
      name: 'cursor_agent',
      arguments: {
        prompt: `在当前工作区 ${workspace} 中创建或覆盖临时文本文件 temp-who-are-you.txt。文件内容必须仅为：你是谁`,
      },
      sessionId: 'sess-same',
      cwd: workspace,
      turn: 1,
    })
    await ctx.waterfall('tools/pre-execute', exec, () => Promise.resolve({ kind: 'allow' as const }))
    ctx.emit('tools/result', exec, {
      isError: false,
      value: null,
      content: [{ type: 'text', text: `文件已写好：${target}` }],
    })
    const turn = await waitForTurn(gw, 'sess-same')
    expect(turn.shellMaybeMutated).toBe(false)
    expect(turn.files).toEqual([
      expect.objectContaining({ path: target, kind: 'update', status: 'pending' }),
    ])
  })

  it('marks shell when git disappears between snapshot and settle', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-review-gitgone-'))
    const workspace = await mkdtemp(join(tmpdir(), 'dsh-review-gitgonews-'))
    await initRepo(workspace)
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(AgentReviewGateway, { dshHome: home })
    const gw = ctx.get('agentReview') as AgentReviewGateway
    const exec = fakeExec({
      name: 'subagent',
      arguments: {},
      sessionId: 'sess-gone',
      cwd: workspace,
      turn: 9,
    })
    await ctx.waterfall('tools/pre-execute', exec, () => Promise.resolve({ kind: 'allow' as const }))
    await rm(join(workspace, '.git'), { recursive: true, force: true })
    ctx.emit('tools/result', exec, errResult())
    expect((await waitForTurn(gw, 'sess-gone')).shellMaybeMutated).toBe(true)
  })
})
