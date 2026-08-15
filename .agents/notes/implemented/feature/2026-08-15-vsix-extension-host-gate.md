# Agent Note: VS Code extension-host gate (Phase D spike)

Status: implemented (decision only — Monaco is not replaced)

English | [中文](2026-08-15-vsix-extension-host-gate.zh.md)

## Problem

Phase C can download Vue Official (`Vue.volar`) from Open VSX. Users will assume that means `.vue` files get Volar diagnostics. The current editor is AMD Monaco loaded from `/monaco/vs` (`monaco-loader.ts` / `MonacoHost`). A `.vsix` on disk does nothing.

The candidate host is [`@codingame/monaco-vscode-api`](https://github.com/codingame/monaco-vscode-api). It is large, conflicts with workbench decision D4 (keep AMD Monaco), and has known Electron pitfalls: the web extension host is a poor fit inside Electron, and Vue Official is a Node extension that wants LocalProcess / a language server.

## Spike answers

**Can we hang a host on the current `MonacoHost` without ripping file / save / diff?** Not in a week without a second editor stack. monaco-vscode-api replaces or re-wraps the Monaco loader. File open, dirty drafts, Ctrl/Cmd+S, and unified diff all sit on the AMD `MonacoHost`. Grafting a VS Code workbench API beside that means two models for the same buffer or a rewrite of those paths.

**Does Vue Official give diagnostics after install (not just color)?** Not on this editor. Color can already fake `.vue` → `html` in the language table. Diagnostics need `@vue/language-server` (or the extension host running `Vue.volar`). Downloading the vsix does not start that server.

**Package size and startup?** monaco-vscode-api plus a web/Node extension host is a multi-megabyte extra surface and a second worker/process on desktop. That is a product decision, not a sidebar feature.

**Failure path (taken):** stay at Phase C. The marketplace can search and store vsix files. Language support, if we need Vue soon, is a first-party language pack (`@vue/language-server` behind the existing LSP seam). Do not pretend arbitrary VS Code extensions run.

## Decision

Do **not** replace AMD Monaco in this program. Revisit only with a dedicated spike that measures Electron LocalProcess, Vue diagnostics on a real `.vue` file, and desktop bundle/startup cost — and then book an L3 patch in `FORK-PATCHES.md`.

## Alternatives considered

**Activate vsix files inside AMD Monaco.** Impossible: no extension host, no `vscode` API.

**Ship monaco-vscode-api now and hide the cost.** Rejected: D4 plus Electron host risk.

**First-party Vue language pack now.** Deferred until a user asks for `.vue` diagnostics; the marketplace already tells the truth.
