# Agent Note: Windows terminal process inspector

Status: implemented

[English](2026-08-16-windows-terminal-inspector.md) | 中文

## 问题

Windows 上打开工作台终端会在分配 ConPTY 之前失败。`spawnTerminal` 会构造 `createProcessInspector()`，该工厂抛出 `subprocess-local: terminal inspection is unsupported on platform win32`。界面打出不可用说明并附上这句原文。这台机器也没有 `wmic`（Windows 11 已移除）。

## 决策

`createProcessInspector('win32')` 返回 Windows 检查器。它没有 POSIX 进程组：`foregroundPgid` 为 undefined，`isStdinWaiting` 为 false，`processSession` 为空。测试可注入 `windows-process-table` 快照来提供有根进程树；生产环境的 DEFAULT exec 找不到这个名字，因此进程树回退为对 PTY 根进程做 `kill(pid, 0)`，SIGKILL 走就地吸收的 `taskkill /T /F`。`LocalTerminalHandle.stopShell` 也会向这个已捕获的根进程发信号：Windows 上 `node-pty.kill` 杀不掉 PowerShell，温和拆卸必须走检查器。`inspectForeground` 返回 undefined；xterm 的 Ctrl+C 仍作为 `\x03` 经 `host.terminalWrite` 进入 ConPTY。

## 考虑过的替代

**每次扫描都拉起 PowerShell `Get-CimInstance Win32_Process`。** 否决：整表 CIM 约 250ms，外加数秒的 `powershell.exe` 启动。就绪轮询会拖死 PTY。

**像 macOS 调 `ps` 那样调 `wmic`。** 否决：这台 Windows 11 主机没有 `wmic`，别处也只是可选功能。

**用 koffi 调 Toolhelp32。** 这次修复否决：本 fork 里 koffi 已有 Electron ABI 前科，而检查器此刻只需要能构造，好让 ConPTY 启动。

## 后续：卡在「正在启动终端...」

检查器让 ConPTY 能分配之后，界面仍在等 bash MOTD。`host.terminalOpen` 会等到 `session.initialize()`：先找 OSC 提示符 `dsh> `，再等 3 秒静默，再 30 秒超时。PowerShell 从不发这个标记，Windows 上 `inspectForeground` 也是 undefined，所以 PTY 已经起来了，标签还停在「正在启动终端...」。xterm 的实时输出要等 spawn 返回才挂上。

UI spawn 现在传 `waitReady: false`，后端在 PTY 一存在就返回。Agent 工具那条路径仍等就绪；提供方报不出前台进程组时，有输出再加短暂静默就结算 `inferred_idle`，不再卡在 3 秒 / 30 秒上限。本机 Node 侧 ConPTY 冒烟（`windows-pty-output.spec.ts`）能在 2 秒内打出 `PS `，所以执行基底不是哑巴。第一行提示符仍会和客户端抢跑：`waitReady: false` 现在最多等 2.5 秒等**净化后的可见字**。对上活桌面后发现黑屏的主因不是这一帧：`workspace-write` 会把开台 `confine()` 成 `electron.exe …/runner.js -- powershell.exe`。Electron 当 Node 跑沙箱包装器，ConPTY 接不上，提示符漏到 `pnpm dsh desktop` 那个控制台。交互标签不再走 confine。沙箱 runner 前缀改用 `DSH_NODE_EXEC_PATH`（与目录选择同一条记录）。

## 后果

重建 `dsh-terminal`、`dsh-terminal-bash`、`dsh-host-apiproxy` 的 Host `lib/` 后，必须完全退出再跑 `pnpm dsh desktop`。请新开一个终端标签；旧等待留下的标签可能还停在「正在启动」。Windows 仍然没有精确的前台进程组 SIGINT；按行的 `host.terminalSignal` 解析不出进程组。没有注入快照时，后代发现只覆盖 PTY 根进程；拆树仍靠关掉 ConPTY 和 `taskkill /T`。
