# Agent Note: Agent experience profiles select independent UI and behavior packages

Status: implemented

[English](2026-08-18-agent-experience-profiles.md) | 中文

## Problem

Agent preset 已能选择按会话组装的能力，但所有 preset 共用同一条桌面工具时间线。因此，面向 Codex 的 preset 虽可调整提示词和工具，却不能选择让该模式具备辨识度的紧凑执行呈现。在通用渲染器里为每个模式加条件，会让后续 profile 的改动影响 DSH 默认路径。

## Decision

`preset.yml` 支持可选的 `experienceProfile` 元数据。发现流程把该标识经由 `agentPreset.list` 传到客户端，客户端再依据会话持久化的 `agentPreset` 选择解析它。没有标识时刻意解析为无 profile，并保留原生 DSH 工具树。

`dsh-client-ui-tool` 拥有以该标识为键的注册表。只有独立加载的呈现器注册了所选键时，它才包装标准、已记录的工具树。`dsh-client-ui-codex-experience` 注册 `codex` 并拥有其紧凑外框；它不改变通用工具调用渲染器、模型请求、工具执行或会话日志。

桌面与 Web bundle 会加载 Codex 呈现插件。对未声明 `codex` 的任何 preset 会话，它保持惰性。未来的 Claude 或 OpenCode 包只需新增注册项与 preset 元数据，无须修改通用工具树或 Codex 包。

## Verification

定向的元数据、RPC schema、profile 解析与时间线注册表测试覆盖元数据往返、wire 传输、原生回退、独立注册、释放和重复所有者拒绝。定向客户端与宿主 TypeScript 项目一起构建。

## Alternatives considered

- **在 `ui-tool` 中加入 Codex 分支** —— 这会使 profile 专属视觉规则进入默认渲染器，并要求每个新模式都改动该处。
- **每种模式各有一条 Agent loop** —— preset 组装已按会话持久化所选 preset，复制 loop 只会增加行为耦合，无法改善 profile 选择。
- **一个全局 UI 设置** —— 全局设置不能重建产生历史会话的 profile，也会让一场会话的选择改变另一场会话的呈现。

## Consequences

profile 标识是展示/运行时元数据，不是模型可见输入，也不是新的会话事件。preset 仍可独立分发：缺少呈现器注册项时回退到原生工具树，而非让会话失败。profile 包只能改变自己的外框；原子工具视图、调用配对和会话拓扑仍由既有包拥有。
