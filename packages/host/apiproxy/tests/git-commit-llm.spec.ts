import { describe, expect, it, vi } from 'vitest'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'
import {
  frameGitCommitPrompt, generateGitCommitMessage, GIT_COMMIT_MAX_INPUT_BYTES,
  normalizeCommitMessage,
} from '../src/git-commit-llm.ts'

const SCRIPT: StreamChunk[] = [
  { type: 'block-start', index: 0, blockType: 'text' },
  { type: 'text-delta', index: 0, text: 'feat: hello' },
  { type: 'finish', reason: { kind: 'stop' } },
]

function session() {
  const append = vi.fn()
  return { append, fake: { append } as unknown as Session }
}

async function* chunks(script: readonly StreamChunk[]): AsyncIterable<StreamChunk> {
  yield* script
}

const baseOpts = {
  root: '/repo',
  stagedDiff: 'diff --git a/a.ts',
  recentSubjects: ['init'] as readonly string[],
  provider: 'deepseek',
  model: 'v3',
  sessionId: undefined as GenerateOptions['sessionId'],
}

describe('frameGitCommitPrompt / normalizeCommitMessage', () => {
  it('frames subjects and truncates oversized diffs', () => {
    expect(frameGitCommitPrompt('diff --git a', [])).toContain('(none)')
    expect(frameGitCommitPrompt('diff --git a', ['init'])).toContain('- init')
    const huge = 'x'.repeat(GIT_COMMIT_MAX_INPUT_BYTES + 50)
    const framed = frameGitCommitPrompt(huge, [])
    expect(framed.endsWith('[truncated]')).toBe(true)
    expect(Buffer.byteLength(framed, 'utf8')).toBeLessThanOrEqual(GIT_COMMIT_MAX_INPUT_BYTES)
    const wide = '你'.repeat(Math.ceil((GIT_COMMIT_MAX_INPUT_BYTES + 80) / 3))
    const cut = frameGitCommitPrompt(wide, [])
    expect(cut.endsWith('[truncated]')).toBe(true)
    expect(Buffer.byteLength(cut, 'utf8')).toBeLessThanOrEqual(GIT_COMMIT_MAX_INPUT_BYTES)
  })

  it('strips fences and quotes', () => {
    expect(normalizeCommitMessage('  feat: x  ')).toBe('feat: x')
    expect(normalizeCommitMessage('```\nfeat: x\n```')).toBe('feat: x')
    expect(normalizeCommitMessage('```text\nfeat: x\n```')).toBe('feat: x')
    expect(normalizeCommitMessage('"feat: x"')).toBe('feat: x')
    expect(normalizeCommitMessage("'feat: x'")).toBe('feat: x')
  })
})

describe('generateGitCommitMessage', () => {
  it('logs the exact prompt then returns the model text', async () => {
    const { append, fake } = session()
    const seen: GenerateOptions[] = []
    const message = await generateGitCommitMessage({
      ...baseOpts,
      session: fake,
      stream: (options) => {
        seen.push(options)
        return chunks(SCRIPT)
      },
      signal: new AbortController().signal,
    })
    expect(message).toBe('feat: hello')
    expect(append).toHaveBeenCalledWith('session/git-commit-llm-request', expect.objectContaining({
      root: '/repo',
      provider: 'deepseek',
      model: 'v3',
      prompt: expect.stringContaining('diff --git a/a.ts'),
    }))
    expect(seen[0]?.purpose).toBe('session-title')
    expect(seen[0]?.system).toContain('conventional commits')
    expect(seen[0]?.sessionId).toBeUndefined()
  })

  it('forwards sessionId and normalizes fenced output', async () => {
    const { fake } = session()
    const seen: GenerateOptions[] = []
    const message = await generateGitCommitMessage({
      ...baseOpts,
      sessionId: 'sid' as GenerateOptions['sessionId'],
      session: fake,
      stream: (options) => {
        seen.push(options)
        return chunks([
          { type: 'block-start', index: 0, blockType: 'text' },
          { type: 'text-delta', index: 0, text: '```\nfeat: boxed\n```' },
        ])
      },
      signal: new AbortController().signal,
    })
    expect(message).toBe('feat: boxed')
    expect(seen[0]?.sessionId).toBe('sid')
  })

  it('rejects an empty staged diff before logging', async () => {
    const { append, fake } = session()
    await expect(generateGitCommitMessage({
      ...baseOpts,
      stagedDiff: '   ',
      session: fake,
      stream: () => chunks(SCRIPT),
      signal: new AbortController().signal,
    })).rejects.toThrow('nothing staged')
    expect(append).not.toHaveBeenCalled()
  })

  it('rejects an already-aborted signal after logging', async () => {
    const { append, fake } = session()
    const controller = new AbortController()
    controller.abort()
    await expect(generateGitCommitMessage({
      ...baseOpts,
      session: fake,
      stream: () => chunks(SCRIPT),
      signal: controller.signal,
    })).rejects.toThrow()
    expect(append).toHaveBeenCalled()
  })

  it('rejects tool calls, empty text, and non-stop finishes', async () => {
    const { fake } = session()
    const run = (script: readonly StreamChunk[]) => generateGitCommitMessage({
      ...baseOpts,
      recentSubjects: [],
      stagedDiff: 'diff',
      session: fake,
      stream: () => chunks(script),
      signal: new AbortController().signal,
    })
    await expect(run([
      { type: 'block-start', index: 0, blockType: 'tool-call' },
      { type: 'finish', reason: { kind: 'stop' } },
    ])).rejects.toThrow(/tool/)
    await expect(run([
      { type: 'block-start', index: 0, blockType: 'text' },
      { type: 'finish', reason: { kind: 'stop' } },
    ])).rejects.toThrow(/no text/)
    await expect(run([{ type: 'finish', reason: { kind: 'max-tokens' } }]))
      .rejects.toThrow(/maxOutputTokens/)
    await expect(run([{
      type: 'finish',
      reason: { kind: 'error', failure: { code: 'x', message: 'boom' } },
    }])).rejects.toThrow('boom')
    await expect(run([{
      type: 'finish',
      reason: { kind: 'aborted', failure: { code: 'x', message: 'stop' } },
    }])).rejects.toThrow('stop')
    await expect(run([{ type: 'finish', reason: { kind: 'tool-calls' } }]))
      .rejects.toThrow(/tool/)
    await expect(run([{
      type: 'finish',
      reason: { kind: 'other' } as never,
    }])).rejects.toThrow(/unsupported/)
  })
})
