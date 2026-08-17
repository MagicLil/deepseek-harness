# Agent Note: xterm viewport leftover must not stay #000

Status: implemented

[English](2026-08-17-terminal-viewport-black-bar.md) | 中文

## Problem

工作台终端在浅色和深色外观下，缓冲区底部都会露出一条实心黑带。厂商 xterm.css 把 `.xterm-viewport` 写成 `#000`，并四边贴满。FitAddon 只按整行给画布定高，多出来的像素就是视口默认黑，不是主题画布。

## Decision

`TerminalTab.module.css` 把 `.xterm`、`.xterm-viewport`、`.xterm-screen` 的背景改成透明，并关掉横向溢出。外壳已经刷了 `--dsw-alias-bg-base`，剩余条带跟缓冲区同色。厂商 xterm.css 原文不动。

## Alternatives considered

**在 `ensure-xterm-css.ts` 里改掉 `#000`。** 否决：那是逐字厂商副本，下次升 xterm 黑带会回来。

**反复重建 Terminal，直到 FitAddon 正好铺满。** 否决：行高除不尽每一种底栏高度，一格剩余永远在。

## Consequences

浅色和深色终端都不再出现黑色底边。IME 组合仍用 xterm 自己的 `#000` composition view。主题赋值仍画单元格；只有没画到的剩余跟着外壳 token。
