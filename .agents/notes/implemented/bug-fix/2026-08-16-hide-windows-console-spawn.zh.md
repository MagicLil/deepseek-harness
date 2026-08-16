# Agent Note: Hide Windows console on local subprocess spawn

Status: implemented

[English](2026-08-16-hide-windows-console-spawn.md) | 中文

## 问题

桌面端是 GUI 进程。会话跑 Pwsh 工具时，`dsh-subprocess-local` 拉起 `pwsh`（控制台子系统可执行文件）却没带 `windowsHide`。Windows 会给这个子进程分配可见控制台，于是每条命令都闪一下黑框。

## 决策

`spawnSubprocess` 和 `taskkillProcessTree` 一律传 `windowsHide: true`。这是本地 provider 的 Windows 细节，不是 `SubprocessSpawnSpec` 字段：普通进程树本来就在收集或管道化 stdio，GUI 父进程不该再开控制台。POSIX 忽略该选项。合同在 `windows-hide.spec.ts`，且不进 win32 的 bash 排除名单，这样 Windows 上真会跑到。

## 考虑过的替代

**只在 `dsh-pwsh-local` 里设 `windowsHide`。** 否决：bash-local（Git Bash）、LSP stdio 和 `taskkill` 同属控制台子系统子进程，照样会闪。

**把 `windowsHide` 加进 `SubprocessSpawnSpec`。** 否决：subprocess seam 不给默认值，也不承载宿主窗口行为。对收集/管道化的进程树，调用方没有理由弹出控制台。

## 后果

桌面端要加载重建后的 `@deepseek-ai/dsh-subprocess-local` `lib/`（或重启源码面的 `pnpm dsh desktop`），Pwsh 才不再闪框。子进程自己再开可见窗口，不在这次隐藏范围内。
