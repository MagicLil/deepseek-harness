# Agent Note：Cursor 式工作台终端

Status: implemented

[English](2026-08-15-xmart-workbench-terminal.md) | 中文

## 问题

底栏只是预留位，活动栏上有个 `#`。没有真 PTY，也不像 Cursor 的终端菜单。

## 决策

**和 File 同一行，不在下面再加一条。** 桌面把「终端」加进 Electron 应用菜单（File / Edit / View / 终端 / Window / Help）。点击走 `dsh:app-menu` → preload `onAppMenu`。`dsh:` 下 AppFrame 藏掉 HTML `menuBar`。Web 仍用框内菜单。活动栏上的 `#` 去掉。

**真 PTY 走现有 IPC 缝。** 六个 `host.terminal*` RPC，外加转发的 `terminals/output` 事件。不开 HTTP-only 路由，也不开页面 WebSocket。Owner 是会话 Agent。每个会话最多 3 个。收起底栏不会杀掉主机 PTY。

**按行发送。** 回车通过 `startSend` 写一行并等到空闲。Ctrl+C 是 SIGINT。验收标准是 Python REPL。第一版 UI 是等宽日志加输入框，不是 xterm。

**PTY 在 agent 平面。** `@deepseek-ai/dsh-terminal` 和 `@deepseek-ai/dsh-terminal-bash` 挂在每个桌面 preset 的 `persistent-shell` isolate（`terminals: true`）里。不能进 host base bundle——一行只能属于一个 plane。Windows 用 `powershell.exe -NoLogo -NoProfile`。会话 agent 没有 `ctx.terminals` 时显示不可用说明。

## 考虑过的替代

**假的 文件/编辑/查看 菜单。** 否决：只有终端是真的。

**共用 agent PTY / 分屏 / 配置档。** 否决：v1 是每个 tab 一个交互座。

**HTTP 或 WebSocket。** 否决：桌面端没有 webserver，也没有页面 WebSocket 升级。

## 后果

重新打包桌面 lib 并重启 `pnpm dsh desktop` 之后，可以从和 File 同一行的「终端」菜单开一个真壳。全屏 TUI 不在范围内。PTY id 只活在当前进程，刷新页面就丢。
