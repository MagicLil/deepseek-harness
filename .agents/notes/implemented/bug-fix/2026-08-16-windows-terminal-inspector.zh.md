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

## 后果

桌面端必须重启 `pnpm dsh desktop`（源码面）或加载重建后的 `@deepseek-ai/dsh-subprocess-local` `lib/`，底栏才能开壳。Windows 仍然没有精确的前台进程组 SIGINT；按行的 `host.terminalSignal` 解析不出进程组。没有注入快照时，后代发现只覆盖 PTY 根进程；拆树仍靠关掉 ConPTY 和 `taskkill /T`。
