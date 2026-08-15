# Agent Note: AI commit message and a complete Git graph

Status: implemented

English | [中文](2026-08-15-git-scm-ai-graph.zh.md)

## Problem

The Git tab could stage, commit, sync, and paint a newest-first spine, but two Cursor SCM gestures were still missing: a sparkle that writes the commit message, and a graph that shows ref pills, merge edges, and checkout-from-node.

## Decision

**Auxiliary `host.gitSuggestCommit`, not `session.prompt`.** The host reads `git diff --cached` plus the last eight subjects, appends `session/git-commit-llm-request` with the exact system, prompt, route, and `maxTokens`, then streams through `ctx.llm`. `purpose: 'session-title'` reuses the existing DeepSeek thinking-off path so this package does not widen the LLM purpose union. Empty staged diffs return `git-failed`. Model failures return `model-unavailable`. The method is not an agent tool and is not on the inspect-catalog whitelist.

**`host.gitLog` carries optional `refs`.** After `git log`, the host decorates with `for-each-ref` plus `rev-parse HEAD` / `--abbrev-ref`. Local vs remote names come from the ref namespace, not a `%D` slash heuristic. Decoration failures leave the rows plain.

**`host.gitCheckout` accepts `detach`.** The graph message/node and remote/tag pills call `git switch --detach <hash>` through `workspaces.gitCheckoutCommit`. A local branch pill calls `git switch`. HEAD pills are inert. Create and detach cannot be combined.

**L2 graph paint.** Extra parents become a second lane plus an SVG cubic. The log window is 80 rows (host cap 100).

## Alternatives considered

**Put the sparkle on `session.prompt`.** Rejected: that would enter the chat turn and expose git tools to the model.

**Add a `git-commit` LLM purpose.** Rejected: that is an L3 widen of `packages/llm` plus every adapter serialize path. Reusing `session-title` is the smaller fork cost.

**Parse `%D` for pills.** Rejected: `origin/foo` vs `foo` cannot be distinguished by slashes.

## Consequences

A staged change can fill the commit box from the session model; the exact prompt is reconstructable from the session log. The graph shows HEAD / branch / remote / tag pills and can detach HEAD. Octopus layout, interactive rebase, and Agent Review stay out of scope.
