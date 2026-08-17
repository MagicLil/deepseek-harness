# Agent Note: Light Appearance must use a Cursor-like xterm palette

Status: implemented

[English](2026-08-17-light-terminal-theme.md) | 中文

## Problem

工作台终端创建 xterm 时写死了 Dark+ 三色（`#1e1e1e` / `#d4d4d4`），外壳也刷同一颗色。外观切到浅色后，浅色页签底下仍是一块黑底。Cursor 浅色终端是白画布、深色字，外加 VS Code Light+ 那套 16 色 ANSI（绿命令、琥珀警告、蓝路径）。

## Decision

`terminal-theme.ts` 持有两份 `ITheme`。浅色是 `XMART_CANVAS_LIGHT` 上的 VS Code Light+ / Cursor。深色是 `XMART_CANVAS_DARK` 上的 Dark+ ANSI，让缓冲区跟编辑器炭黑对齐。`TerminalTab` 打开时读 `darkTheme()`，并监听 `body[data-ds-dark-theme]`，只改 `term.options.theme`，不重挂 PTY。外壳 CSS 改用 `--dsw-alias-bg-base`，不再写死深色 hex。xterm 本身仍要 hex：它不解析 CSS 变量。

## Alternatives considered

**浅色外观继续用深色终端。** 否决：用户要求对齐 Cursor 浅色终端，而且铬层已经跟随外观。

**只靠 `--dsw-alias-*` token 驱动 xterm。** 否决：xterm.js 的 `ITheme` 是 hex/rgb。token 只负责缓冲区周围的 padding。

**外观切换时重建 Terminal。** 否决：会闪一下并重放回滚。`options.theme` 能更新活实例。

## Consequences

浅色外观不再出现黑底终端。PowerShell / npm / git 的 ANSI 走 Cursor 同一套 Light+ 映射。深色外观停在炭黑，不再用旧的 `#1e1e1e`（VS Code 编辑器默认）。已经画在缓冲区里的旧单元格会保持原色，直到新输出或主题赋值刷新。
