# Agent Note: xterm viewport leftover must not stay #000

Status: implemented

English | [中文](2026-08-17-terminal-viewport-black-bar.zh.md)

## Problem

The workbench terminal showed a solid black strip along the bottom of the buffer in both Appearances. Vendored xterm.css sets `.xterm-viewport { background-color: #000 }` and pins that layer to all four edges. FitAddon sizes the canvas to whole rows, so the leftover pixels are the viewport's default black, not the theme canvas.

## Decision

`TerminalTab.module.css` forces `.xterm`, `.xterm-viewport`, and `.xterm-screen` to a transparent background and hides horizontal overflow. The host already paints `--dsw-alias-bg-base`, so the leftover strip matches the buffer. The vendored xterm.css string stays untouched.

## Alternatives considered

**Patch `#000` out of `ensure-xterm-css.ts`.** Rejected: that file is a verbatim vendor dump; the next xterm bump would restore the bar.

**Recreate the Terminal until FitAddon fills the host exactly.** Rejected: row height never divides every panel size; a one-cell remainder always remains.

## Consequences

Light and dark terminals no longer show a black footer. IME composition still uses xterm's own `#000` composition view. A theme assign still paints cells; only the unpainted remainder follows the host token.
