# Agent 改动审查（影子快照）

Date: 2026-08-16
Status: implemented（Host + Cursor 式输入框上方审查条）

[English](2026-08-16-agent-change-review.md) | 中文

## 决策

按回合把 Agent 的文件改动（`write`/`edit`）做成 Host 侧影子，落在 `~/.dsh/agent-review/`。接受/撤销不碰 git stage。UI 是挂在 `conversation.input.dock`（输入框上方）的 Cursor 式审查条；没有活动栏「审查」入口。

**壳命令 B（2026-08-16）：** `pwsh`/`bash`/… 一律置 `shellMaybeMutated`；字面量 `Remove-Item`/`rm`/`del` 路径按 `kind: delete` 进审查，可 Keep/Undo。解析不到的壳命令仍只显示可关掉的警告。

## 为什么是 L2

新建 Host 包 + 工作台审查条；经 api-remotes 挂 Typert Remote。不改 agent-loop，也不 bump session 格式。顺带修了 `workspace-checks` 的 exactOptionalPropertyTypes，否则 typert 生成过不了。

## 文件

- `packages/host/agent-review/**`（含 `shell-delete-paths.ts`）
- `packages/api/remotes` 挂载 + bundle patch
- `packages/client/ui-xmart-workbench` 的 `ReviewDock`（`conversation.input.dock`）
- 规格/计划在 `docs/superpowers/`
