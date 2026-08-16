# Agent Note: 会话预设的两套作用域

Status: implemented

[English](2026-08-16-session-preset-scopes.md) | 中文

## Problem

会话标题旁的预设看起来像按钮，点了没反应。设置里改默认值只影响此后新建的会话。用户要的是两套作用域：设置里改，所有项目的会话都跟着变；会话里改，只动当前这一场。

## Decision

`agentPreset.select` 对空白会话和已开聊的会话都可以重组。此后的轮次跑新组装；更早的工具调用仍对照产生它们的那份 preset 的常驻挂载解析。会话标题旁是选择器，只对当前会话调用 `select`。设置里的写入（General 行或「设为默认」）先记下默认值，再对每一个尚未是该 preset 的已列出根会话调用 `select`。子代理行跳过。

## Alternatives considered

**保留空白会话锁，只让还没开聊的标题旁可以点。** 否决：标题旁的 chip 最常出现在已经开聊的会话上，也正是点了没反应的地方。

**给每个会话加「跟随默认」标记，打开时再套用。** 否决：那要新的会话事件或头字段。现有的 `agent-preset/selected` 日志事件已经记录一场会话在跑什么。

**宿主侧批量 RPC，给冷会话只追加日志、不恢复 agent。** 推迟：对已列出会话走现有 `select` 即可。名单很大时，这次写入会把冷会话恢复一段时间。

## Consequences

在设置里改默认值会遍历会话名单，并可能恢复冷会话。标题旁的选择不改默认值。`agent-preset-locked` 仍留在传输层 schema 上，但 `select` 不再产生它。
