# Agent Note: 不透明子代理写盘进入审查条

Status: implemented

[English](2026-08-17-agent-review-opaque-subagent.md) | 中文

## 问题

输入框上方的审查条只捕获父会话的 `write` / `edit` / `str_replace_editor`（外加启发式壳删除）。`cursor_agent` 在 Cursor ACP 子进程里写盘，不会触发父级 `write`/`edit`，所以子代理写完文件后审查条是空的：没有审查、保留、撤销。

## 决策

`packages/host/agent-review` 把 `cursor_agent`、`subagent`、`subagent_fork`、`subagent_acp`（以及 `Config.opaqueMutationTools`）当成不透明写盘工具。`tools/pre-execute` 时拍一份 `git status --porcelain` 和可读的脏/未跟踪正文，并 stat 参数里提到的路径；`tools/result` 时对比新的 porcelain，把新增/修改/删除导入现有影子引擎，原本干净的文件用 `git show HEAD:<path>` 补改前正文，参数或结果里写出的路径也会导入（没有 git、被 gitignore、或写到会话仓库外面时，新建文件仍能进审查条）。结果里点名、或提示词声称要创建/覆盖的文件，即使正文没变（再次覆盖同一内容）也进审查条——黄条只是找不到文件时的退路，不是「再写一遍这个文件」的结果。两种办法都找不到文件时才举壳警告。已经被 `write`/`edit` 跟踪的路径以它们为准。审查入口只有工作台审查条：它本来就会渲染 Host 标成 pending 的行。

## 考虑过的其他做法

**在 `dsh-subagent-acp` 里解析 ACP `tool_call` 路径。** 这轮否决：那是改上游包的 L3，而且官方客户端目前丢掉 tool-call 更新。git 快照留在 L2 的 `agent-review`。

**子进程运行期间用 `fs.watch` 盯工作区。** 否决：改前正文在 Windows 上会抢跑，经常拍到改后内容。

**`cursor_agent` 只出壳警告。** 否决：用户要的是审查 / 保留 / 撤销，不是黄条。

**在工具卡片上放一颗审查药丸。** 否决：那不是输入框上方的文件列表。见 [工具卡片审查入口](../../rejected/bug-fix/2026-08-17-tool-card-review-action.md)。

## 后果

子代理写盘既不在 `git status` 里、提示词/结果也没写出路径时，仍会退回壳警告。`tools/result` 仍然是火忘，审查条可能在子代理返回后再隔一次轮询（2.5 秒）才出现。每个不透明工具前后各多跑一次 `git status`。
