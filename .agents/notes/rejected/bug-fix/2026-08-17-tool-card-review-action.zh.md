# Agent Note: 不透明子代理工具卡片上的审查药丸

Status: rejected — the card pill is not Review; users need the composer dock file list (Keep / Undo / Review), and a lone button next to Inspect is the wrong affordance

[English](2026-08-17-tool-card-review-action.md) | 中文

## 问题

调用 `cursor_agent` 时，工具卡片上只有 Inspect。审查只挂在 `conversation.input.dock`（输入框上方），要等 Host 导入文件后才会出现。子代理还在跑时，用户盯着卡片，看不到 Review。

## 提案

在 `ui-tool` 每张原子卡片下加列表槽 `tool.call.actions`。工作台给 `cursor_agent` / `subagent*` 注册一颗始终可见的审查药丸。点下去打开第一份待审 diff；子代理还没写出文件时只打开工作台。

这套已经落地，又在一次真实的 `cursor_agent` 新建文件后被否决：药丸孤零零待在卡片下面，输入框上方的审查条是空的（或只剩壳警告），用户把它和正常 Agent 改文件的审查条（N 个文件、全部撤销 / 全部保留 / 审查）对比。

## 考虑过的其他做法

**只在子代理运行时把审查条显示出来。** 这才是对的产品。审查条是空的，是因为 git 看不见新文件时不透明捕获退回了 `markShell`；该修的是 [不透明子代理审查](../../implemented/bug-fix/2026-08-17-agent-review-opaque-subagent.md) 里的路径提示，不是再加一颗按钮。

**工作台接管 `cursor_agent` 的 toolview。** 否决：跨包禁止引用 GenericToolCard；重画整张卡比加一个小槽更糟——而且槽位仍然是错的界面。

**做成和 Inspect 一样的悬停药丸。** 当初的提案否决过：Inspect 本身就要悬停才出现。后来的否决更彻底：卡片上不要药丸。
