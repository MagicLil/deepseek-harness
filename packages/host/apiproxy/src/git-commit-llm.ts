/**
 * Auxiliary commit-message generation. The exact prompt is appended to the
 * session log before dispatch so the model-visible input can be rebuilt.
 */
import { BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { FinishReason, GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'

/** Exact auxiliary commit-message request recorded before dispatch. */
export interface GitCommitLlmRequestEventData {
  /** Absolute repository root the staged diff was read from. */
  readonly root: string
  /** Provider id used for the auxiliary call. */
  readonly provider: string
  /** Model id used for the auxiliary call. */
  readonly model: string
  /** Exact system instruction. */
  readonly system: string
  /** Exact user prompt, including any truncation marker. */
  readonly prompt: string
  /** Auxiliary output-token cap. */
  readonly maxTokens: number
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Log-only pre-dispatch record of one Git commit-message model request. */
    'session/git-commit-llm-request': GitCommitLlmRequestEventData
  }
}

/** UTF-8 byte ceiling for the framed user prompt. */
export const GIT_COMMIT_MAX_INPUT_BYTES = 24_576

/** Auxiliary output-token cap. */
export const GIT_COMMIT_MAX_OUTPUT_TOKENS = 256

const SYSTEM = [
  'Write a git commit message for the staged changes.',
  'Return only the message. No quotes, preface, or explanation.',
  'Use conventional commits (feat/fix/chore/docs/refactor/test) when it fits.',
  'Match the language of the diff comments and recent subjects.',
  'Keep the subject at most 72 characters. Add a body only when the diff needs it.',
].join('\n')

/**
 * Frame the staged diff and recent subjects into the exact user prompt.
 * @param stagedDiff - `git diff --cached` text.
 * @param recentSubjects - newest-first subjects.
 */
export function frameGitCommitPrompt(
  stagedDiff: string,
  recentSubjects: readonly string[],
): string {
  const recent = recentSubjects.length === 0
    ? '(none)'
    : recentSubjects.map(subject => `- ${subject}`).join('\n')
  const raw = `Recent subjects:\n${recent}\n\nStaged diff:\n${stagedDiff}`
  return truncateUtf8(raw, GIT_COMMIT_MAX_INPUT_BYTES)
}

/**
 * Strip fences and surrounding quotes from a model commit message.
 * @param text - raw model output.
 */
export function normalizeCommitMessage(text: string): string {
  let out = text.trim()
  if (out.startsWith('```')) {
    out = out.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim()
  }
  if (
    (out.startsWith('"') && out.endsWith('"'))
    || (out.startsWith("'") && out.endsWith("'"))
  ) {
    out = out.slice(1, -1).trim()
  }
  return out
}

/**
 * Generate one commit message and log the exact request first.
 * @param opts - staged input, session, route, and stream.
 */
export async function generateGitCommitMessage(opts: {
  root: string
  stagedDiff: string
  recentSubjects: readonly string[]
  session: Session
  provider: string
  model: string
  sessionId: GenerateOptions['sessionId']
  stream: (options: GenerateOptions) => AsyncIterable<StreamChunk>
  signal: AbortSignal
}): Promise<string> {
  if (opts.stagedDiff.trim() === '') {
    throw new Error('nothing staged')
  }
  const prompt = frameGitCommitPrompt(opts.stagedDiff, opts.recentSubjects)
  const messages = [createUserMessage({
    content: [{ type: 'text', text: prompt }],
    source: { kind: 'plugin', plugin: 'dsh-host-apiproxy' },
  })]
  opts.session.append('session/git-commit-llm-request', {
    root: opts.root,
    provider: opts.provider,
    model: opts.model,
    system: SYSTEM,
    prompt,
    maxTokens: GIT_COMMIT_MAX_OUTPUT_TOKENS,
  })
  opts.signal.throwIfAborted()
  const timeout = AbortSignal.timeout(30_000)
  const signal = AbortSignal.any([opts.signal, timeout])
  const options: GenerateOptions = {
    provider: opts.provider,
    model: opts.model,
    messages,
    system: SYSTEM,
    maxTokens: GIT_COMMIT_MAX_OUTPUT_TOKENS,
    purpose: 'session-title',
    signal,
    ...opts.sessionId === undefined ? {} : { sessionId: opts.sessionId },
  }
  const assembler = new BlockAssembler()
  for await (const chunk of opts.stream(options)) {
    signal.throwIfAborted()
    assembler.push(chunk)
  }
  signal.throwIfAborted()
  const terminalError = finishError(assembler.finish)
  if (terminalError !== undefined) throw terminalError
  const blocks = assembler.blocks()
  if (blocks.some(block => block.type === 'tool-call')) {
    throw new Error('commit-message model unexpectedly requested a tool')
  }
  const text = blocks
    .filter((block): block is Extract<(typeof blocks)[number], { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join(' ')
  const message = normalizeCommitMessage(text)
  if (message.length === 0) throw new Error('commit-message model produced no text')
  return message
}

function finishError(finish: FinishReason): Error | undefined {
  switch (finish.kind) {
    case 'stop':
      return undefined
    case 'error':
    case 'aborted':
      return new Error(finish.failure.message)
    case 'max-tokens':
      return new Error('commit-message output reached maxOutputTokens')
    case 'tool-calls':
      return new Error('commit-message model unexpectedly requested a tool')
    default:
      return new Error(`commit-message unsupported finish reason "${String((finish as { kind?: unknown }).kind)}"`)
  }
}

function truncateUtf8(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text
  const suffix = '\n\n[truncated]'
  const budget = maxBytes - Buffer.byteLength(suffix, 'utf8')
  let cut = text.length
  while (cut > 0 && Buffer.byteLength(text.slice(0, cut), 'utf8') > budget) {
    cut = Math.floor(cut * 0.9)
  }
  while (
    cut < text.length
    && Buffer.byteLength(text.slice(0, cut + 1), 'utf8') <= budget
  ) {
    cut += 1
  }
  return `${text.slice(0, cut)}${suffix}`
}
