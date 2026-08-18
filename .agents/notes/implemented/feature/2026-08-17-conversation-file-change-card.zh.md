# Agent Note: 对话里的文件改动卡

Status: implemented

[English](2026-08-17-conversation-file-change-card.md) | 中文

## Problem

`edit` / `write` 已经在对话流里，但只是一行 `Edit · 路径`，diff 默认收起，`+N -M` 在展开后的脚注。这不是用户对着 Cursor 要的那种文件卡：图标、路径、加减数、一小段 snippet 直接铺在流里。Keep / Undo 已经在输入框上方的审查条，这里缺的是展示，不是审查。

## Decision

工作台用 priority `-1` L2 接管 `tool.call.toolview` 的 `edit` / `write`（最低的活条目渲染），画出 `FileChangeCard`。数据仍是调用/结果上现成的 `card:'diff'` hunk。头上是文件图标、相对工作区的路径、`+N -M`、复制，以及可选的「完整差异」。snippet 是 LCS 对齐的 unified hunk（上下文 / 删 / 增），替换行有词级高亮，绿/红行底，能推断起始行时带新文件行号（创建从 1 起；编辑经 `workspaces.readFile` 定位唯一行）。默认展开，最多 8 行。点路径或行号走 `layout.openWorkbench` + `requestReveal` + `xmartWorkbench.openFile`。复制写出 git 风格 unified 补丁。完整差异打开该路径所属回合的 `agent-review-diff` 页。失败或没有可用 diff 时退回一行摘要。卡片上不画 Keep / Undo。

## Alternatives considered

**改上游 `FileMutationRow` / `DiffBlock`（L3）。** 所有 profile 和细节面板都会变，以后每次同步上游都要解这两处。要 Cursor 铬的是工作台。

**再开一个 `ui-xmart-file-cards` 包。** 同一套槽位接管，多一套 README / 覆盖率 / bundle，点开文件还是得找工作台。

**另做一种「改了哪些文件」的对话节点。** 和工具调用流重复，还容易碰到 session 格式或 loop。按工具名画卡片的座位已经在 `tool.call.toolview`。

**把 Keep / Undo 画在卡片上。** 已否决：审查仍在 `conversation.input.dock`。

## Consequences

桌面和 web-app 都挂工作台，两边都会看到这张卡。没挂工作台的 profile 仍是自带的 `FileMutationRow`。审查仍在 `conversation.input.dock`。壳命令和不透明子代理的文件不画成这种卡。其它对话路径芯片仍走系统打开。过大的 hunk（`n*m > 40000`）跳过 LCS，退回先删后增。

## Testing

`file-change-diff.client.spec.ts` 覆盖 LCS 对齐、词级标记、行定位/编号和补丁格式。`file-change-model.client.spec.ts` 覆盖推导和路径解析。`file-change-card.client.spec.tsx` 覆盖可见卡片、折叠、封顶、回退、复制、跳转和审查。`file-change-actions.client.spec.ts` 与 `review-counts.client.spec.ts` 覆盖回合查找。`apply.client.spec.ts` 声明 `tool.call.toolview`，核对 `-1` 接管、`openInWorkbench` 定位、`readFile` 和完整差异。
