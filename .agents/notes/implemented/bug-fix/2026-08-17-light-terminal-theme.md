# Agent Note: Light Appearance must use a Cursor-like xterm palette

Status: implemented

English | [中文](2026-08-17-light-terminal-theme.zh.md)

## Problem

The workbench terminal always constructed xterm with a Dark+ trio (`#1e1e1e` / `#d4d4d4`) and painted the host the same hex. Switching Appearance to light left a black slab under a light tab strip. Cursor's light terminal is a white canvas, dark ink, and the VS Code Light+ 16-color ANSI set (green commands, amber warnings, blue paths).

## Decision

`terminal-theme.ts` owns two `ITheme` objects. Light is VS Code Light+ / Cursor on `XMART_CANVAS_LIGHT`. Dark is Dark+ ANSI on `XMART_CANVAS_DARK` so the buffer matches the editor charcoal. `TerminalTab` reads `darkTheme()` at open and watches `body[data-ds-dark-theme]` to assign `term.options.theme` without remounting the PTY. The host CSS uses `--dsw-alias-bg-base` instead of a literal dark hex. xterm still needs hex: it does not resolve CSS variables.

## Alternatives considered

**Keep a dark terminal in light Appearance.** Rejected: the user asked to match Cursor's light terminal, and the chrome already follows Appearance.

**Drive xterm from `--dsw-alias-*` tokens only.** Rejected: xterm.js `ITheme` is hex/rgb. Tokens still paint the padding around the buffer.

**Recreate the Terminal when Appearance flips.** Rejected: that would flash and replay scrollback. `options.theme` updates the live instance.

## Consequences

Light Appearance no longer shows a black terminal. ANSI from PowerShell / npm / git follows the same Light+ map Cursor uses. Dark Appearance stays charcoal, not the old `#1e1e1e` VS Code editor default. Existing PTY scrollback keeps its already-painted cells until new output or a theme assign refresh.
