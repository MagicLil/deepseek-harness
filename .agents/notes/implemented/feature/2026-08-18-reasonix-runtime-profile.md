# Agent Note: Reasonix runtime guards stay opt-in and agent-scoped

Status: implemented

English | [中文](2026-08-18-reasonix-runtime-profile.zh.md)

## Problem

Reasonix contains runtime protections that cannot be reproduced by a system prompt: large tool results are bounded, and repeated failed calls force a change of approach. Applying those protections to the host composition would change the behavior of standard, Claude, and OpenCode modes.

## Decision

The Reasonix mode mounts `@deepseek-ai/dsh-reasonix-runtime` inside its agent composition. The plugin restricts only that Agent scope to an explicit Economy, Balanced, or Delivery tool surface, then tracks consecutive identical failed calls for each live Agent, resets after a user step or a successful call, and blocks calls at the configured threshold while injecting a compact pivot notice. It owns no durable state and therefore requires no session event.

The mode reuses the host `spill-policy` for lossless oversized-result retention. The guard does not duplicate storage, alter the model provider, or move cache policy into the global base composition.

## Alternatives considered

- Extending `repeat-tool-reminder` with a global hard-stop option would make a Reasonix choice affect every mode and would couple unrelated deployments.
- Copying Reasonix's Go Agent loop into DSH would duplicate the existing agent and tool seams; the adapter instead attaches at `tools/post-execute` and `agent/pre-step`.
- A prompt-only rule was rejected because it cannot enforce a stop after repeated failures.

## Consequences

Reasonix mode now has an explicit tool surface and an enforced failed-repeat circuit breaker while other modes retain their existing tool registry and advisory behavior. The restriction is registered after the preset's tool providers through `agent.ctx`. The guard is in-memory and resets when the Agent instance is replaced; a resumed session does not reconstruct its heuristic chain.

## Verification

- `pnpm exec tsc -p packages/guard/reasonix-runtime/tsconfig.json --noEmit`
- `pnpm exec vitest run packages/guard/reasonix-runtime/tests/reasonix-runtime.spec.ts`
- `npm test` in `D:\mycode\deepseek\dsh-agent-modes`

## Coverage gap

The current adapter does not yet provide Reasonix's planner/executor two-session collaboration. That requires an explicit DSH subagent model-routing seam and remains follow-up work.
