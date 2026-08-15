# Agent Note: Editor go-to-definition, hover, references, and in-file find

Status: implemented

English | [中文](2026-08-16-editor-navigation.zh.md)

## Problem

The workbench Monaco editor already had completions and diagnostics on `.java` / `.ts` / `.js` / `.vue`, but Ctrl+click / F12 did nothing. Hover and find-references were also cut from the first language-server slice. Ctrl+F was Monaco-native only when the editor had focus; desktop Chromium find-in-page could steal it.

## Decision

Extend the existing `vueLsp` / `tsLsp` / `javaLsp` remotes with `definition` / `hover` / `references`. Query the already-open editor buffer (`session.navigate`), not `ctx.lsp.query` (that path re-reads disk). Monaco registers Definition / Hover / Reference providers plus an editor opener. `file:` targets call `openFile` and an ephemeral reveal; jar / `jdt://` / `.class` stay put and show “没有源码”.

Find / replace are application-menu commands (`file-find` / `file-replace`) on both the web MenuBar and the Electron Edit menu so Ctrl+F / Ctrl+H reach the mounted Monaco host even when chat has focus.

## Out of scope

Rename, refactor, go-to-implementation, workspace search. `Ctrl+B` remains the primary sidebar.

## Verification

- `pnpm exec vitest run packages/lsp/lsp-languages packages/lsp/lsp-vue --coverage.enabled --coverage.include=packages/lsp/lsp-languages/src/** --coverage.include=packages/lsp/lsp-vue/src/**`
- `pnpm exec vitest run packages/client/ui-xmart-workbench/tests/monaco-host.client.spec.tsx packages/client/ui-xmart-workbench/tests/editor-lsp.client.spec.ts packages/client/ui-xmart-workbench/tests/editor-nav.client.spec.ts packages/client/ui-xmart-workbench/tests/app-menu-dispatch.client.spec.ts packages/client/ui-xmart-workbench/tests/menu-bar.client.spec.tsx`
- `pnpm exec vitest run apps/desktop/tests/app-menu.spec.ts`
- Relaunch `pnpm dsh desktop`. Open a `.java` file, Ctrl+click a type, hover, Shift+F12, Ctrl+F.
