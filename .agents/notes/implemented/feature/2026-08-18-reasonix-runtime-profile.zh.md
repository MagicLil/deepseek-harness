# Agent Note: Reasonix 运行时保护保持可选且按 Agent 隔离

Status: implemented

[English](2026-08-18-reasonix-runtime-profile.md) | 中文

## Problem

Reasonix 包含无法仅靠 system prompt 复现的运行时保护：限制超大的工具结果，并在连续失败调用时强制更换方案。如果把这些保护放进宿主组合，标准、Claude 和 OpenCode 模式也会被改变。

## Decision

Reasonix 模式在自己的 Agent 组合中挂载 `@deepseek-ai/dsh-reasonix-runtime`。该插件只在当前 Agent 作用域内选择显式的 Economy、Balanced 或 Delivery 工具面，然后按每个运行中 Agent 统计连续相同且失败的调用，在达到配置阈值后阻止调用并注入简短的改换方案提示；用户新输入或调用成功后重置。插件不拥有持久状态，因此不需要新增会话事件。

该模式复用宿主的 `spill-policy` 保存超大结果，不重复实现存储、不改变模型提供方，也不把缓存策略移入全局 base 组合。

## Alternatives considered

- 给 `repeat-tool-reminder` 增加全局硬停止选项会让 Reasonix 选择影响所有模式，并耦合无关部署。
- 把 Reasonix 的 Go Agent loop 复制到 DSH 会重复已有 Agent 和工具 seam；适配器改为挂载在 `tools/post-execute` 与 `agent/pre-step` 上。
- 仅增加提示词规则无法在连续失败后真正强制停止，因此不采用。

## Consequences

Reasonix 模式现在拥有显式工具面和强制性的重复失败熔断，而其他模式继续保持原有工具注册表与建议性提醒。工具限制在预设工具提供方之后通过 `agent.ctx` 注册到当前作用域。该保护只存在于内存中；Agent 实例替换后会重置，恢复会话不会重建这条启发式链。

## Verification

- `pnpm exec tsc -p packages/guard/reasonix-runtime/tsconfig.json --noEmit`
- `pnpm exec vitest run packages/guard/reasonix-runtime/tests/reasonix-runtime.spec.ts`
- `D:\mycode\deepseek\dsh-agent-modes` 下运行 `npm test`

## Coverage gap

当前适配器还没有实现 Planner/Executor 双会话协作。这需要显式的 DSH 子 Agent 模型路由 seam，留作后续工作。
