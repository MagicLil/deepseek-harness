# Agent Note: Desktop one-click market restart must not pass -e to Electron

Status: implemented

[English](2026-08-17-desktop-market-restart.md) | 中文

## Problem

设置 → 插件市场（`dshmarket`）更新后点「立即重启」，弹出 Electron 的「Error launching app」。路径是仓库目录加上助手脚本源码（`const { spawn } = require('node:child_process')…`）。社区插件会 `spawn(process.execPath, ['-e', helper])`，想用脱离的 Node 在本进程退出后再拉起 `dsh --profile desktop`。`dsh desktop` 里 `process.execPath` 是 `electron.exe`。Electron 不会把 `-e` 当 eval，而是把整段脚本当成应用路径。

## Decision

`electron-main` 在 profile 启动前补丁 `child_process.spawn`。带 `dsh-market-restart` 的 `-e` 助手改走 `app.relaunch()`（并打上已有的退出标记，避免窗口藏进托盘）。其它 `electron -e` 子进程按 Node 跑：未打包 relaunch 记下的 `DSH_NODE_EXEC_PATH`，否则同一二进制加 `ELECTRON_RUN_AS_NODE=1`。规划函数在 `apps/desktop/src/node-eval-spawn.ts`。

## Alternatives considered

**改用户 profile 里的 dsh-market。** 否决：`~/.dsh/profiles/desktop/node_modules/dshmarket` 下次更新会被覆盖，而且那不是我们的包。

**只把 `-e` 改写到 Node，仍跑他们的助手。** 否决（针对重启按钮）：助手还要 PATH 上的 `dsh`、等 1.5 秒，Windows 上还包一层 PowerShell。`app.relaunch()` 在退出后重放当前 Electron argv，打包也能用。Node 改写留给其它 `execPath -e` 调用方。

**用 `allowRestart: false` 藏掉按钮。** 否决：用户要的是修好重启，不是拿掉它。

## Consequences

市场更新后点「立即重启」会安排一次真正的桌面 relaunch，而不是再开一个 Electron GUI。安装仍走 [本机市场笔记](2026-08-17-desktop-loopback-market.md) 里的 PATH `dsh` shim。没有记下 Node 的打包宿主，非市场 `-e` 子进程仍用 `ELECTRON_RUN_AS_NODE`。
