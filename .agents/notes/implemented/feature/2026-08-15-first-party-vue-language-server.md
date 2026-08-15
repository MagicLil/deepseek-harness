# Agent Note: First-party Vue language server

Status: implemented

English | [中文](2026-08-15-first-party-vue-language-server.zh.md)

## Problem

Downloading Vue Official (`Vue.volar`) from Open VSX does nothing: the editor is AMD Monaco, not a VS Code extension host. Users still need diagnostics and completions on `.vue`, and the agent already has an `lsp` tool that should answer hover / definition / references / implementation on those files.

## Decision

Ship a first-party `@vue/language-server` host. One persistent process per workspace, shared by the editor and `ctx.lsp`. Do not activate vsix files. Do not replace Monaco (D4). Do not change the four `ctx.lsp` operations. Do not claim `.ts` / `.tsx`.

## Shape

- L2 package `packages/lsp/lsp-vue` (`@deepseek-ai/dsh-lsp-vue`).
- Lean JSON-RPC connection that reuses `dsh-lsp-stdio` framing and captures `textDocument/publishDiagnostics` (the generic connection ignores notifications).
- `VueLspGateway` registers `.vue` → `vue` on `ctx.lsp` and publishes Remote namespace `vueLsp`: `open` / `change` / `close` / `complete` / `diagnostics`.
- Desktop and web bundles mount `lsp` + `lsp-vue` + `tool-lsp`.
- Workbench `MonacoHost` paints markers and registers completions only for `.vue` when `remote.vueLsp` is present. Components never see `ctx`.
- Diagnostics are not session events and never enter a model request.

## Why not L3 on lsp-stdio

`LspConnection.dispatch` is private and drops server notifications. Subclassing cannot hook diagnostics. A lean connection in the new package avoids patching the generic host.

## Out of scope

Editor hover / F12 / rename. TypeScript language service. Arbitrary VS Code extensions. Diagnostics in the model.

## Verification

- `pnpm exec vitest run packages/lsp/lsp-vue packages/client/ui-xmart-workbench/tests/monaco-host.client.spec.tsx packages/client/ui-xmart-workbench/tests/editor.client.spec.tsx packages/client/ui-xmart-workbench/tests/vue-lsp.client.spec.ts`
- Open a `.vue` file in the desktop workbench after relaunch; squiggles and completions should appear when the project has a Vue `tsconfig`.
