# @deepseek-ai/dsh-host-agent-review

[English](README.md) | 中文

用于 **Agent 改动审查** 的 Host Remote：在 `write` / `edit`（及同类文件工具）写盘前做按回合影子快照，工作台可展示数量、差异、接受与撤销，应用重启后仍可恢复。

`AgentReviewGateway` 注册 `agentReview` 服务，并发布生成的 Remote：`get`、`accept`、`acceptAll`、`revert`、`revertAll`、`diff`、`dismissShell`。影子与索引落在 `~/.dsh/agent-review/<sessionId>/`。捕获挂在 `tools/pre-execute`（必须调用 `next()`）；结算挂在 `tools/result`。壳类工具（`bash`、`pwsh` 等）会置 `shellMaybeMutated`，并对字面量 `Remove-Item`/`rm`/`del` 路径在文件存在时启发式捕获为 `kind: delete`。不透明写盘工具（`cursor_agent`、`subagent`、`subagent_fork`、`subagent_acp`，以及 `Config.opaqueMutationTools`）在调用前拍一份 `git status --porcelain`，返回后再导入新增/修改/删除行。点「知道了」会把该标志写回磁盘，重开后不再出现；同一回合再跑壳命令会重新举起。接受 = 保留磁盘并丢掉影子，**不会** `git stage`。超过 2 MiB（可配）的文件标为 `irreversible`。

客户端经 [`api-remotes`](../../api/remotes/README.md) 组装消费。不新增 HTTP 路由。

## 模型体验

无。本 Host 管理器不注册提示词、工具、消息或供应商请求。影子不是 session 事件，也不会进入模型输入。

#### KV 缓存影响

无；本包从不组装模型输入。

## 已知限制与延后工作

- **多数壳命令改盘不可撤销** — 仅有回合级提示标志；例外是字面量 `Remove-Item`/`rm`/`del` 删除，会按 `kind: delete` 进入审查。
- **不透明子进程写盘依赖 git** — `cursor_agent` / `subagent*` 用会话 cwd 的 `git status` 捕获。不是仓库时退回壳警告。被 gitignore 的路径不会出现。
- **二进制 / 超大文件** — 标为不可撤销并跳过。
- **编辑器脏缓冲** — Remote 的 `force` 覆盖磁盘冲突；脏缓冲由工作台客户端在调用 revert 前检查。
