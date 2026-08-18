/**
 * Reasonix runtime guards. The module contains the runtime protections that
 * cannot be expressed by a persona alone: failed identical tool calls are
 * bounded per agent and the model receives a compact pivot instruction.
 * @module @deepseek-ai/dsh-reasonix-runtime
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import { defineTool, type PostToolDecision, type ToolExecution, type ToolExecutionResult, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { CallId, type MessageSource } from '@deepseek-ai/dsh-llm'

/** Plugin name used by loader diagnostics. */
export const name = 'reasonix-runtime'
/** Services consumed by the event listeners. */
export const inject = ['tools']

/** Configuration for the repeated-failure circuit breaker. */
export interface Config {
  /** Version of the Reasonix runtime contract understood by this plugin. */
  contractVersion?: 1
  /** Reasonix tool surface: economy, balanced, or delivery. */
  runtimeMode?: RuntimeMode
  /** Consecutive identical failed calls before the next call is blocked. */
  failureThreshold?: number
  /** Tool-name wildcard patterns excluded from the breaker. */
  exclude?: string[]
  /** Expose one stable proxy for optional capabilities. */
  capabilityProxy?: boolean
}

/** The three progressively capable Reasonix tool surfaces. */
export type RuntimeMode = 'economy' | 'balanced' | 'delivery'

export const Config: z<Config> = z.object({
  contractVersion: z.const(1).default(1),
  runtimeMode: z.union([z.const('economy'), z.const('balanced'), z.const('delivery')]).default('balanced'),
  failureThreshold: z.number().default(3),
  exclude: z.array(z.string()).default([]),
  capabilityProxy: z.boolean().default(false),
})

const ECONOMY_TOOLS = new Set([
  'read', 'write', 'edit', 'str_replace_editor', 'bash', 'pwsh',
  'ask_user_question', 'todo_write',
])

const BALANCED_EXTRA_TOOLS = new Set([
  'glob', 'grep', 'web_search', 'web_fetch', 'skill', 'create_goal', 'get_goal', 'update_goal',
  'subagent', 'subagent_fork', 'job_output', 'job_list', 'job_kill',
])

const CAPABILITY_PROXY_NAME = 'use_capability'
const NOVELTY_IGNORE = new Set(['read', 'glob', 'grep', 'get_goal', 'job_output', 'job_list'])

const capabilityProxy = defineTool({
  name: CAPABILITY_PROXY_NAME,
  description: 'Call an optional capability by its registered name through the stable Reasonix proxy.',
  parameters: {
    capability: { type: 'string', required: true },
    arguments: { type: 'json' },
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        capability: { type: 'string', required: true },
        ok: { type: 'boolean', required: true },
        value: { type: 'json' },
        error: { type: 'string' },
      },
    },
    render(_args, value): { type: 'text'; text: string }[] {
      return [{ type: 'text', text: JSON.stringify(value) }]
    },
  },
  async execute(args, exec: ToolRunContext) {
    if (args.capability === CAPABILITY_PROXY_NAME) {
      throw new Error('use_capability cannot call itself')
    }
    const visible = exec.agent?.ctx.tools.schemas().some(schema => schema.name === args.capability) ?? false
    if (!visible) throw new Error(`unknown or unavailable capability "${args.capability}"`)
    const result = await exec.agent?.ctx.tools.execute({
      callId: CallId(`${exec.callId}:capability:${args.capability}`),
      rootCallId: exec.rootCallId,
      name: args.capability,
      arguments: args.arguments ?? {},
      agent: exec.agent,
      signal: exec.signal,
    })
    if (result === undefined) throw new Error('use_capability requires an agent-scoped execution')
    for (const context of result.additionalContexts ?? []) exec.deferContext(context)
    return result.isError
      ? { capability: args.capability, ok: false, error: result.error.message }
      : { capability: args.capability, ok: true, value: result.value }
  },
})

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

const PLUGIN_SOURCE: Extract<MessageSource, { kind: 'plugin' }> = { kind: 'plugin', plugin: 'reasonix-runtime' }

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

function noveltyFeedback(exec: ToolExecution, previous: PostToolDecision): PostToolDecision {
  const text = `No novel progress was observed from repeated successful calls to ${exec.name}. Change the target or approach, verify the current state, or report the blocker.`
  const context = createUserMessage({
    content: [{ type: 'text', text }],
    source: { ...PLUGIN_SOURCE, form: 'notice', summary: `${exec.name} novelty stall` },
  })
  return { kind: 'block', feedback: [{ type: 'text', text }], additionalContexts: [context, ...previous.additionalContexts ?? []] }
}

/** Install Reasonix's failed-repeat circuit breaker on one agent scope. */
export function apply(ctx: Context, config: Config): void {
  const runtimeMode = config.runtimeMode ?? 'balanced'
  if (config.capabilityProxy === true) ctx.tools.register(capabilityProxy)
  let restricted = false
  const installRestriction = (): void => {
    if (restricted) return
    const visibleTools = ctx.tools.schemas().map(schema => schema.name)
    const allow = allowedTools(visibleTools, runtimeMode)
    if (config.capabilityProxy === true && !allow.includes(CAPABILITY_PROXY_NAME)) allow.push(CAPABILITY_PROXY_NAME)
    if (allow.length === 0) {
      throw new Error(`reasonix-runtime: ${runtimeMode} mode resolved no visible tools; load tool providers before reasonix-runtime`)
    }
    ctx.tools.restrict({ allow })
    restricted = true
  }
  // Preset loader entries can be applied in parallel. Defer the restriction
  // until the first agent step when sibling tool providers have registered.
  // The guard still runs before the model request, while avoiding a false
  // empty-tool failure during composition.
  const initialVisible = ctx.tools.schemas().map(schema => schema.name)
  const initialAllow = allowedTools(initialVisible, runtimeMode)
  if (config.capabilityProxy === true && !initialAllow.includes(CAPABILITY_PROXY_NAME)) initialAllow.push(CAPABILITY_PROXY_NAME)
  if (initialAllow.length > 0) installRestriction()
  else ctx.on('agent/pre-step', async (_payload, next) => {
    installRestriction()
    return next()
  })
  const threshold = validateThreshold(config.failureThreshold ?? 3)
  const excluded = (config.exclude ?? []).map(wildcard)
  const chains = new WeakMap<Agent, FailureChain>()
  const novelty = new WeakMap<Agent, Map<string, number>>()

  // Re-resolve the proxy target immediately before dispatch. A capability can
  // disappear or be shadowed after prompt assembly; cached visibility is never
  // treated as authorization.
  ctx.on('tools/pre-execute', async (exec, next) => {
    if (exec.name !== CAPABILITY_PROXY_NAME) return next()
    const capability = (exec.arguments as { capability?: unknown }).capability
    if (typeof capability !== 'string' || capability === CAPABILITY_PROXY_NAME) {
      return { kind: 'deny', reason: 'use_capability requires a non-recursive capability name' }
    }
    const visible = exec.agent?.ctx.tools.schemas().some(schema => schema.name === capability) ?? false
    if (!visible) return { kind: 'deny', reason: `capability "${capability}" is not registered in the current Agent scope` }
    return next()
  })

  function isExcluded(name: string): boolean {
    return excluded.some(pattern => pattern.test(name))
  }

  ctx.on('tools/post-execute', async (exec, result, next): Promise<PostToolDecision> => {
    const decision = await next()
    const agent = exec.agent
    if (agent === undefined || isExcluded(exec.name)) return decision
    if (!isFailure(result)) {
      chains.delete(agent)
      if (!NOVELTY_IGNORE.has(exec.name) && !isExcluded(exec.name)) {
        const key = `${exec.name}\0${canonicalArguments(exec.arguments)}`
        const counts = novelty.get(agent) ?? new Map<string, number>()
        const count = (counts.get(key) ?? 0) + 1
        counts.set(key, count)
        novelty.set(agent, counts)
        if (count >= 3) return noveltyFeedback(exec, decision)
      }
      return decision
    }
    const key = `${exec.name}\0${canonicalArguments(exec.arguments)}`
    const previous = chains.get(agent)
    const count = previous?.key === key ? previous.count + 1 : 1
    chains.set(agent, { key, count })
    return count >= threshold ? pivotFeedback(exec, decision) : decision
  })

  ctx.on('agent/pre-step', ({ agent, messages }, next): Promise<PreStepDecision> => {
    if (messages.some(message => message.source.kind === 'user')) {
      chains.delete(agent)
      novelty.delete(agent)
    }
    return next()
  })
}

function isFailure(result: ToolExecutionResult): boolean {
  return result.isError
}
