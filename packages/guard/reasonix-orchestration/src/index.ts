/**
 * Reasonix planner/executor collaboration. A root Reasonix Agent delegates a
 * compact planning pass to a child session, then logs that plan as context for
 * its own executor turn. Child agents are excluded from planning to prevent
 * recursive planner trees.
 * @module @deepseek-ai/dsh-reasonix-orchestration
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import { delegationDepthOf } from '@deepseek-ai/dsh-subagent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { defineTool, type PostToolDecision, type PreToolDecision, type ToolExecution, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-session'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Durable planner/executor hand-off state, replayed when a session resumes. */
    'reasonix/plan-handoff': {
      planId: string
      state: 'pending' | 'accepted' | 'failed'
      attempt: number
      summary: string
      criterionIds?: string[]
      evidenceSummaries?: string[]
    }
  }
}

/** Plugin name used by loader diagnostics. */
export const name = 'reasonix-orchestration'
/** Services consumed by the planner delegation. */
export const inject = ['subagents', 'tools']

/** Configuration for the planner/executor hand-off. */
export interface Config {
  /** Version of the planner/executor contract understood by this plugin. */
  contractVersion?: 1
  /** Whether the planner pass is enabled. */
  enabled?: boolean
  /** Registered subagent provider used for the planner child. */
  providerName?: string
  /** Optional provider route override for the planner model. */
  plannerProvider?: string | null
  /** Optional model override for the planner pass. */
  plannerModel?: string | null
  /** Maximum characters copied from the planner output into executor context. */
  maxPlanChars?: number
  /** Keep planner output explicitly pending until the parent verifies it. */
  requireParentAcceptance?: boolean
  /** Failure convergence contract for planner startup or settlement. */
  failureStrategy?: 'retry-narrow-report' | 'report'
  /** Maximum planner attempts before reporting the failure. */
  maxAttempts?: number
}

export const Config: z<Config> = z.object({
  contractVersion: z.const(1).default(1),
  enabled: z.boolean().default(true),
  providerName: z.string().default('spawn'),
  plannerProvider: z.union([z.string(), z.const(null)]),
  plannerModel: z.union([z.string(), z.const(null)]),
  maxPlanChars: z.number().default(8000),
  requireParentAcceptance: z.boolean().default(true),
  failureStrategy: z.union([z.const('retry-narrow-report'), z.const('report')]).default('retry-narrow-report'),
  maxAttempts: z.number().default(2),
})

const PLUGIN_SOURCE = { kind: 'plugin', plugin: 'reasonix-orchestration', form: 'notice' } as const
const PLANNER_PERSONA = 'You are the Reasonix planning specialist. Produce only a concise implementation plan: facts to inspect, smallest changes, risks, and focused checks. Do not edit files, do not run tools, and do not answer the user directly.'
const ACCEPT_PLAN_NAME = 'reasonix_accept_plan'
const READ_ONLY_TOOLS = new Set(['read', 'glob', 'grep', 'web_search', 'web_fetch', 'get_goal', 'job_list', 'job_output', 'list_agents', ACCEPT_PLAN_NAME])

interface PendingPlan {
  readonly planId: string
  readonly createdAtStep: number
}

function restoredPendingPlan(agent: Agent): PendingPlan | undefined {
  if (agent.session === undefined) return undefined
  let pending: PendingPlan | undefined
  for (const event of agent.session.events as readonly { type: string; data: unknown }[]) {
    if (event.type !== 'reasonix/plan-handoff' || event.data === null || typeof event.data !== 'object') continue
    const data = event.data as Record<string, unknown>
    if (typeof data.planId !== 'string' || typeof data.state !== 'string') continue
    if (data.state === 'pending') pending = { planId: data.planId, createdAtStep: typeof data.attempt === 'number' ? data.attempt : 1 }
    else if (data.state === 'accepted' || data.state === 'failed') pending = undefined
  }
  return pending
}

function appendHandoff(agent: Agent, data: {
  planId: string
  state: 'pending' | 'accepted' | 'failed'
  attempt: number
  summary: string
  criterionIds?: string[]
  evidenceSummaries?: string[]
}): void {
  if (agent.session !== undefined && typeof agent.session.append === 'function') agent.session.append('reasonix/plan-handoff', data)
}

const acceptPlanTool = defineTool({
  name: ACCEPT_PLAN_NAME,
  description: 'Accept a pending Reasonix planner hand-off after checking its criteria and evidence.',
  parameters: {
    criterionIds: { type: 'array', items: { type: 'string' }, required: true },
    evidence: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          criterionId: { type: 'string', required: true },
          summary: { type: 'string', required: true },
        },
      },
    },
    note: { type: 'string' },
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        accepted: { type: 'boolean', required: true },
        criterionIds: { type: 'array', items: { type: 'string' }, required: true },
        evidenceCount: { type: 'number', required: true },
      },
    },
    render(_args, value): { type: 'text'; text: string }[] {
      return [{ type: 'text', text: JSON.stringify(value) }]
    },
  },
  async execute(args, _exec: ToolRunContext) {
    return { accepted: true, criterionIds: args.criterionIds, evidenceCount: args.evidence.length }
  },
})

function promptText(messages: readonly { content: readonly ContentBlock[] }[]): string {
  return messages.flatMap(message => message.content)
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map(block => block.text)
    .join('\n')
}

/** Skip planner startup for conversational acknowledgements and greetings. */
function isPlanningCandidate(prompt: string): boolean {
  const normalized = prompt.trim().toLocaleLowerCase()
  if (normalized.length === 0) return false
  return !/^(你好|您好|嗨|哈喽|在吗|谢谢|感谢|收到|好的|好吧|ok(?:ay)?|hi|hello|hey|test|测试)[!！。,.、\s]*$/iu.test(normalized)
}

function boundedPlan(output: readonly ContentBlock[], maxChars: number): ContentBlock[] {
  const text = output
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map(block => block.text)
    .join('\n')
    .trim()
  if (text.length === 0) return []
  return [{ type: 'text', text: text.length > maxChars ? `${text.slice(0, maxChars)}\n[planner output truncated]` : text }]
}

/** Install the planner pass and executor context hand-off. */
export function apply(ctx: Context, config: Config): void {
  if (config.enabled === false) return
  const maxPlanChars = config.maxPlanChars ?? 8000
  if (!Number.isInteger(maxPlanChars) || maxPlanChars < 256) {
    throw new Error(`reasonix-orchestration: maxPlanChars must be an integer >= 256 (got ${maxPlanChars})`)
  }
  const pending = new WeakMap<Agent, PendingPlan>()
  if (ctx.tools !== undefined) ctx.tools.register(acceptPlanTool)

  ctx.on('tools/pre-execute', async (exec: ToolExecution, next): Promise<PreToolDecision> => {
    const plan = exec.agent === undefined ? undefined : pending.get(exec.agent) ?? restoredPendingPlan(exec.agent)
    if (exec.name === ACCEPT_PLAN_NAME) {
      const criterionIds = (exec.arguments as { criterionIds?: unknown }).criterionIds
      const evidence = (exec.arguments as { evidence?: unknown }).evidence
      if (plan === undefined) return { kind: 'deny', reason: 'no pending planner hand-off is waiting for acceptance' }
      if (!Array.isArray(criterionIds) || criterionIds.length === 0 || criterionIds.some(id => typeof id !== 'string' || id.trim().length === 0)) {
        return { kind: 'deny', reason: `${ACCEPT_PLAN_NAME} requires at least one non-empty verified criterionId` }
      }
      if (!Array.isArray(evidence) || evidence.length !== criterionIds.length || evidence.some(item => item === null || typeof item !== 'object' || typeof (item as { criterionId?: unknown }).criterionId !== 'string' || typeof (item as { summary?: unknown }).summary !== 'string' || (item as { summary: string }).summary.trim().length === 0)) {
        return { kind: 'deny', reason: `${ACCEPT_PLAN_NAME} requires one non-empty evidence receipt per criterionId` }
      }
      const evidenceIds = evidence.map(item => (item as { criterionId: string }).criterionId)
      if (evidenceIds.some(id => !criterionIds.includes(id)) || criterionIds.some(id => !evidenceIds.includes(id))) {
        return { kind: 'deny', reason: `${ACCEPT_PLAN_NAME} evidence receipts must bind exactly to criterionIds` }
      }
      return next()
    }
    if (plan === undefined || READ_ONLY_TOOLS.has(exec.name)) return next()
    return {
      kind: 'deny',
      reason: `planner hand-off is pending from step ${plan.createdAtStep}; inspect it and call ${ACCEPT_PLAN_NAME} with verified criterionIds before using ${exec.name}`,
    }
  })

  ctx.on('tools/post-execute', async (exec, result, next): Promise<PostToolDecision> => {
    const decision = await next()
    if (exec.name === ACCEPT_PLAN_NAME && !result.isError && exec.agent !== undefined) {
      const plan = pending.get(exec.agent) ?? restoredPendingPlan(exec.agent)
      pending.delete(exec.agent)
      if (plan) {
        const criterionIds = (exec.arguments as { criterionIds?: unknown }).criterionIds
        const evidence = (exec.arguments as { evidence?: unknown }).evidence
        appendHandoff(exec.agent, {
          planId: plan.planId,
          state: 'accepted',
          attempt: plan.createdAtStep,
          summary: 'parent accepted planner hand-off',
          ...Array.isArray(criterionIds) ? { criterionIds: criterionIds.filter((id): id is string => typeof id === 'string') } : {},
          ...Array.isArray(evidence) ? { evidenceSummaries: evidence.filter((item): item is { summary: string } => item !== null && typeof item === 'object' && typeof (item as { summary?: unknown }).summary === 'string').map(item => item.summary) } : {},
        })
      }
    }
    return decision
  })

  ctx.on('agent/pre-step', async ({ agent, messages, step, signal }, next): Promise<PreStepDecision> => {
    const decision = await next()
    if (step !== 1 || delegationDepthOf(agent) > 0 || !messages.some(message => message.source.kind === 'user')) return decision
    if (decision.kind !== 'enter') return decision
    const prompt = promptText(messages)
    if (!isPlanningCandidate(prompt)) return decision
    const agentOptions = {
      ...config.plannerProvider == null ? {} : { provider: config.plannerProvider },
      ...config.plannerModel == null ? {} : { model: config.plannerModel },
    }
    const maxAttempts = config.maxAttempts ?? 2
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) throw new Error(`reasonix-orchestration: maxAttempts must be an integer from 1 to 3 (got ${maxAttempts})`)
    const planId = `${String(agent.id)}:${step}`
    let plan: ContentBlock[] = []
    let lastFailure = ''
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let run: Awaited<ReturnType<NonNullable<Context['subagents']>['start']>> | undefined
      try {
        run = await ctx.subagents.start(config.providerName ?? 'spawn', {
          label: 'Reasonix planner',
          parent: agent,
          prompt: [{ type: 'text', text: `Plan this user request for the executor. Include facts to verify, a stable criterion id for each step, and focused checks. A failed or truncated observation is unknown, not evidence. Do not edit files or run tools.${attempt > 1 ? ' This is a narrowed retry: reduce scope and return only the smallest verifiable plan.' : ''}\n\n${prompt}` }],
          signal,
          persona: PLANNER_PERSONA,
          ...Object.keys(agentOptions).length === 0 ? {} : { agentOptions },
        })
        plan = boundedPlan((await run.result).output, maxPlanChars)
        if (plan.length > 0) break
        lastFailure = 'planner returned no plan'
      } catch (error: unknown) {
        lastFailure = error instanceof Error ? error.message : String(error)
      } finally {
        if (run) await run.dispose()
      }
    }
    if (plan.length === 0) {
      appendHandoff(agent, { planId, state: 'failed', attempt: maxAttempts, summary: lastFailure || 'planner failed' })
      if (config.failureStrategy === 'retry-narrow-report') {
        const context = createUserMessage({ content: [{ type: 'text', text: `Reasonix planner could not produce a verified plan after ${maxAttempts} attempt(s). Narrow the scope or report the blocker: ${lastFailure || 'unknown planner failure'}` }], source: { ...PLUGIN_SOURCE, summary: 'planner failure report' } })
        return { kind: 'enter', messages: [...decision.messages, context] }
      }
      return decision
    }
    try {
      const context = createUserMessage({
        content: [{ type: 'text', text: config.requireParentAcceptance === false
          ? 'Reasonix planner hand-off. Verify the plan before acting.'
          : 'Reasonix planner hand-off pending parent acceptance. Do not treat it as evidence or execute it until each step has been verified.' }, ...plan],
        source: { ...PLUGIN_SOURCE, summary: 'planner hand-off' },
      })
      pending.set(agent, { planId, createdAtStep: step })
      appendHandoff(agent, { planId, state: 'pending', attempt: maxAttempts, summary: 'planner hand-off pending parent acceptance' })
      return { kind: 'enter', messages: [...decision.messages, context] }
    } catch (error: unknown) {
      appendHandoff(agent, { planId, state: 'failed', attempt: maxAttempts, summary: error instanceof Error ? error.message : String(error) })
      throw error
    }
  })
}
