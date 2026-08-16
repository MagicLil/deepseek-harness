# Agent 改动审查（Agent Change Review）

Date: 2026-08-16
Status: approved (2026-08-16; user: 开干; UI pivot 2026-08-16: Cursor composer dock only)
Checklist: `PRODUCT-FEATURE-CHECKLIST.md` §1

## Goal

让用户在每一轮 Agent 写盘之后，能看清改了什么、按文件接受或撤销，并能一键回到本轮开始前；审查状态在应用重启后仍在。

成功标准（对齐清单 §1）：

- 按会话/回合汇总 Agent 修改的文件
- 展示新增、修改、删除文件数量
- 支持逐文件查看差异
- 支持接受或撤销单个文件的改动；支持「全部接受」
- 支持一键恢复到本轮任务开始前
- 撤销前明确提示未保存或人工修改冲突
- 审查状态在应用重启后能够恢复

## Locked decisions

| 项 | 选择 |
| --- | --- |
| 撤销基准 | **回合影子快照**：第一次改某文件前存改前全文（新建则为「不存在」） |
| UI 落点 | **A（Cursor）**：仅对话输入框上方 `conversation.input.dock` 审查条；**无**活动栏「审查」入口 |
| 跟踪范围 | **C+B**：以 `write` / `edit`（及同族）为主；壳命令启发式解析删除路径进审查；解析不到则弱提示 |
| 接受语义 | **A+C**：接受 = 保留磁盘结果、丢影子、移出待审；提供「全部接受」；**不**自动 `git stage` |

## Non-goals (v1)

- 自动 git stage / commit / push（留给清单 §3）
- 可靠撤销壳**写/改**与通配/管道/变量展开（删除字面路径除外，见捕获 §5）
- 壳后全量 git/工作区扫盘（方案 C，后续）
- 二进制文件审查（跳过或标为不可审）
- 改 `agent-loop`、bump `SESSION_FORMAT_VERSION`（影子与审查态不进 session event 词汇）
- Monaco DiffEditor 双栏（复用现有 unified / 工作台 `diff` tab 即可）
- 跨会话合并审查、多用户协作审查

## Architecture (summary)

L2 host `packages/host/agent-review`：回合索引、影子、`tools/pre-execute` / `tools/result` 捕获结算、Remotes。
L2 client：`ReviewDock` 挂 `conversation.input.dock`。

### 捕获

1. `write` / `edit` / `str_replace_editor`：写盘前影子，成功后 `afterHash`。
2. 删除类：`kind=delete`、影子为删前全文。
3. 壳工具（`bash` / `pwsh` / `shell` 等）：
   - 一律置 `shellMaybeMutated=true`。
   - **B（启发式删除）**：从 `command` 解析 `Remove-Item` / `ri` / `del` / `rm` / `Erase` / `unlink` 的字面路径；含 `*`/`?`、变量、管道的片段跳过。
   - 解析出且磁盘存在 → `captureDelete`；`result` 成功且文件已不存在则 `pending`。
   - 解析不到：仅黄条弱提示（可 dismiss）。

### UI

- 有 pending 时显示文件列表 + Keep/Undo。
- 仅有 `shellMaybeMutated`：显示「壳改动提示」+「知道了」。

详见实现计划：`docs/superpowers/plans/2026-08-16-agent-review-shell-delete.md`。
