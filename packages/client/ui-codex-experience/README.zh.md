# @deepseek-ai/dsh-client-ui-codex-experience

[English](README.md) | 中文

注册 `codex` 工具时间线呈现器。它只拥有标准、已记录工具调用树外层的紧凑视觉框架，不改变模型请求、工具、会话事件或默认 DSH 呈现。

任意预设可通过 `experienceProfile: codex` 选择它；未声明 profile 的预设继续使用未改变的工具渲染。其他体验注册各自的 profile id，无须修改本包或 `ui-tool`。
