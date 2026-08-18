import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type { PostToolDecision, ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import * as ReasonixRuntime from '@deepseek-ai/dsh-reasonix-runtime'

type PostListener = (exec: ToolExecution, result: Readonly<ToolExecutionResult>, next: () => Promise<PostToolDecision>) => Promise<PostToolDecision>
type PreListener = (input: { agent: Agent; messages: readonly { source: { kind: string } }[] }, next: () => Promise<PreStepDecision>) => Promise<PreStepDecision>

function harness(config: ReasonixRuntime.Config = {}): { post: PostListener; pre: PreListener } {
  let post: PostListener | undefined
  let pre: PreListener | undefined
  const ctx = {
    tools: {
      schemas: () => [{ name: 'read' }, { name: 'write' }, { name: 'bash' }, { name: 'glob' }],
      restrict: (): (() => void) => () => undefined,
    },
    on(event: string, listener: PostListener | PreListener): void {
      if (event === 'tools/post-execute') post = listener as PostListener
      if (event === 'agent/pre-step') pre = listener as PreListener
    },
  } as unknown as Context
  ReasonixRuntime.apply(ctx, config)
  if (post === undefined || pre === undefined) throw new Error('Reasonix listeners were not registered')
  return { post, pre }
}

function execution(agent: Agent, argumentsValue: unknown): ToolExecution {
  return {
    agent,
    callId: 'call' as never,
    rootCallId: 'call' as never,
    name: 'read_file',
    arguments: argumentsValue,
    signal: new AbortController().signal,
    token: Symbol('token') as never,
  }
}

const failure: ToolExecutionResult = {
  isError: true,
  error: { message: 'missing file' },
  content: [{ type: 'text', text: 'Error: missing file' }],
}

describe('reasonix runtime', () => {
  it('projects progressively wider tool surfaces', () => {
    const tools = ['read', 'write', 'bash', 'glob', 'grep', 'web_search', 'create_goal', 'run_code', 'mystery']
    expect(ReasonixRuntime.allowedTools(tools, 'economy')).toEqual(['read', 'write', 'bash'])
    expect(ReasonixRuntime.allowedTools(tools, 'balanced')).toEqual(['read', 'write', 'bash', 'glob', 'grep', 'web_search', 'create_goal'])
    expect(ReasonixRuntime.allowedTools(tools, 'delivery')).toEqual(['read', 'write', 'bash', 'glob', 'grep', 'web_search', 'create_goal', 'mystery'])
  })
  it('blocks the configured repeated failed call and preserves a pivot notice', async () => {
    const { post } = harness({ failureThreshold: 2 })
    const agent = {} as Agent
    const exec = execution(agent, { path: 'missing.ts' })
    const next = async (): Promise<PostToolDecision> => ({ kind: 'accept' })

    expect((await post(exec, failure, next)).kind).toBe('accept')
    const blocked = await post(exec, failure, next)
    expect(blocked.kind).toBe('block')
    if (blocked.kind === 'block') {
      expect(blocked.feedback[0]).toEqual({ type: 'text', text: expect.stringContaining('Stop retrying') })
      expect(blocked.additionalContexts).toHaveLength(1)
    }
  })

  it('resets the failed-call chain after a user step', async () => {
    const { post, pre } = harness({ failureThreshold: 2 })
    const agent = {} as Agent
    const exec = execution(agent, { path: 'missing.ts' })
    const next = async (): Promise<PostToolDecision> => ({ kind: 'accept' })
    await post(exec, failure, next)
    await pre({ agent, messages: [{ source: { kind: 'user' } }] }, async () => ({ kind: 'accept', messages: [] }))
    expect((await post(exec, failure, next)).kind).toBe('accept')
  })
})
