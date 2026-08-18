/**
 * Reasonix runtime guards. The module contains the runtime protections that
 * cannot be expressed by a persona alone: failed identical tool calls are
 * bounded per agent and the model receives a compact pivot instruction.
 * @module @deepseek-ai/dsh-reasonix-runtime
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type { PostToolDecision, ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { MessageSource } from '@deepseek-ai/dsh-llm'

/** Plugin name used by loader diagnostics. */
export const name = 'reasonix-runtime'
/** Services consumed by the event listeners. */
export const inject = ['tools']

/** Configuration for the repeated-failure circuit breaker. */
export interface Config {
  /** Reasonix tool surface: economy, balanced, or delivery. */
  runtimeMode?: RuntimeMode
  /** Consecutive identical failed calls before the next call is blocked. */
  failureThreshold?: number
  /** Tool-name wildcard patterns excluded from the breaker. */
  exclude?: string[]
}

/** The three progressively capable Reasonix tool surfaces. */
export type RuntimeMode = 'economy' | 'balanced' | 'delivery'

export const Config: z<Config> = z.object({
  runtimeMode: z.union([z.const('economy'), z.const('balanced'), z.const('delivery')]).default('balanced'),
  failureThreshold: z.number().default(3),
  exclude: z.array(z.string()).default([]),
})

const ECONOMY_TOOLS = new Set([
  'read', 'write', 'edit', 'str_replace_editor', 'bash', 'pwsh',
  'ask_user_question', 'todo_write',
])

const BALANCED_EXTRA_TOOLS = new Set([
  'glob', 'grep', 'web_search', 'web_fetch', 'skill', 'create_goal', 'get_goal', 'update_goal',
  'subagent', 'subagent_fork',
])

/**
 * Resolve a visible tool list into the allowlist for a Reasonix mode.
 * @param toolNames - names currently visible in the scoped registry.
 * @param mode - the selected Reasonix runtime mode.
 * @returns the names retained by the mode, excluding the Code Mode transport.
 */
export function allowedTools(toolNames: readonly string[], mode: RuntimeMode): string[] {
  if (mode === 'delivery') return [...toolNames].filter(name => name !== 'run_code')
  const allow = new Set(ECONOMY_TOOLS)
  if (mode === 'balanced') for (const name of BALANCED_EXTRA_TOOLS) allow.add(name)
  return toolNames.filter(name => allow.has(name))
}

const PLUGIN_SOURCE: MessageSource = { kind: 'plugin', plugin: 'reasonix-runtime' }

interface FailureChain {
  key: string
  count: number
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort()) result[key] = sortJson(source[key])
    return result
  }
  return value
}

function canonicalArguments(value: unknown): string {
  return JSON.stringify(sortJson(value))
}

function wildcard(pattern: string): RegExp {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, String.raw`\$&`)
  return new RegExp(`^${escaped.replaceAll('*', '.*')}$`)
}

function validateThreshold(value: number): number {
  if (!Number.isInteger(value) || value < 2) {
    throw new Error(`reasonix-runtime: failureThreshold must be an integer >= 2 (got ${value})`)
  }
  return value
}

function pivotFeedback(exec: ToolExecution, previous: PostToolDecision): PostToolDecision {
  const text = `The same tool call has failed repeatedly (${exec.name}). Stop retrying it with identical arguments. Inspect the latest error, change the approach or arguments, or report the blocker.`
  const context = createUserMessage({
    content: [{ type: 'text', text }],
    source: { ...PLUGIN_SOURCE, form: 'notice', summary: `${exec.name} failure loop` },
  })
  return {
    kind: 'block',
    feedback: [{ type: 'text', text }],
    additionalContexts: [context, ...previous.additionalContexts ?? []],
  }
}

/** Install Reasonix's failed-repeat circuit breaker on one agent scope. */
export function apply(ctx: Context, config: Config): void {
  const runtimeMode = config.runtimeMode ?? 'balanced'
  const visibleTools = ctx.tools.schemas().map(schema => schema.name)
  const allow = allowedTools(visibleTools, runtimeMode)
  if (allow.length === 0) {
    throw new Error(`reasonix-runtime: ${runtimeMode} mode resolved no visible tools; load tool providers before reasonix-runtime`)
  }
  ctx.tools.restrict({ allow })
  const threshold = validateThreshold(config.failureThreshold ?? 3)
  const excluded = (config.exclude ?? []).map(wildcard)
  const chains = new WeakMap<Agent, FailureChain>()

  function isExcluded(name: string): boolean {
    return excluded.some(pattern => pattern.test(name))
  }

  ctx.on('tools/post-execute', async (exec, result, next): Promise<PostToolDecision> => {
    const decision = await next()
    const agent = exec.agent
    if (agent === undefined || isExcluded(exec.name)) return decision
    if (!isFailure(result)) {
      chains.delete(agent)
      return decision
    }
    const key = `${exec.name}\0${canonicalArguments(exec.arguments)}`
    const previous = chains.get(agent)
    const count = previous?.key === key ? previous.count + 1 : 1
    chains.set(agent, { key, count })
    return count >= threshold ? pivotFeedback(exec, decision) : decision
  })

  ctx.on('agent/pre-step', ({ agent, messages }, next): Promise<PreStepDecision> => {
    if (messages.some(message => message.source.kind === 'user')) chains.delete(agent)
    return next()
  })
}

function isFailure(result: ToolExecutionResult): boolean {
  return result.isError
}
