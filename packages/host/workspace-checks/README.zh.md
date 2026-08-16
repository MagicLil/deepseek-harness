# @deepseek-ai/dsh-host-workspace-checks

[English](README.md) | 中文

工作台「问题 / 检查」底栏所用的 Host Remote。`WorkspaceChecksGateway` 注册 `workspaceChecks`，通过 `ctx.subprocess` 发布 `start` / `poll` / `stop`（收集 stdout/stderr、树级终止），同一时刻只跑一个子进程。

Client 负责从 `package.json` 约定探测脚本并拼 argv；本包经 `ctx.subprocess.resolveExecutable` 解析 `argv[0]` 后在给定工作区根目录执行。Windows 上解析到的 `.cmd`/`.bat` 包管理器 shim 会经 `cmd.exe /v:off` 启动（与 Claude Code subagent 同一模式），因为 Node 无法直接 spawn 这类脚本。不新增 HTTP 路由。

## Model Experience

无。本 Host 管理器不注册 prompt、工具、消息或 provider 请求。

#### KV Cache effect

无；本包不组装模型输入。

## Known Limitations and Deferred Work

- **同时只跑一个** — 新的 `start` 会停掉上一个仍在跑的进程。
- **日志保留** — 每个流默认只保留内存尾部（1 MiB）；更早字节在 poll 时标 `lossy`。
- **不做脚本发现** — `package.json` 约定探测留在 Client。
