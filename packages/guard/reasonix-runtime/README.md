# @deepseek-ai/dsh-reasonix-runtime

Reasonix-specific runtime guards for a DSH agent-scoped composition. The plugin
does not change the model provider or the default DSH runtime. `runtimeMode`
selects a scoped tool surface: `economy` keeps direct file/shell/approval/todo
tools, `balanced` adds search, web, skill, goal, and subagent tools, and
`delivery` keeps every currently visible tool. It counts
consecutive identical failed tool calls per Agent and blocks the next repeated
attempt after `failureThreshold`, injecting a compact instruction to pivot.

The package is intentionally separate from `repeat-tool-reminder`: the existing
guard is advisory, while this runtime adapter is an opt-in circuit breaker for
the Reasonix profile. Oversized result retention should use the existing
`@deepseek-ai/dsh-spill-policy` host capability.

```yaml
- id: reasonix-runtime
  name: '@deepseek-ai/dsh-reasonix-runtime'
  config:
    runtimeMode: balanced
    failureThreshold: 3
    exclude: [todo_write]
```
