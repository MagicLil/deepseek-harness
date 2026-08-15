# Agent Note: First-party TypeScript and Java language servers

Status: implemented

English | [中文](2026-08-15-first-party-typescript-java-language-servers.zh.md)

## Problem

The workbench already hosts Vue through a first-party language server. Company and `D:\mycode` MES/QMS stacks are Java 17 + Spring Boot + Vue/TypeScript. Marketplace `.vsix` files still do not run (AMD Monaco, no extension host). Users need diagnostics and completions on `.ts` / `.js` / `.java`, and the agent `lsp` tool should answer those files too.

## Decision

Ship both hosts in one L2 package so the connection/session/pool is not copied twice (jscpd). Do not activate vsix files. Do not replace Monaco (D4). Do not change the four `ctx.lsp` operations. Do not claim `.vue` or `.xml`.

## Shape

- L2 package `packages/lsp/lsp-languages` (`@deepseek-ai/dsh-lsp-languages`).
- Two `TypertRemoteService` classes, one `./remote` contribution, two namespaces: `tsLsp` and `javaLsp`. Each exposes `open` / `change` / `close` / `complete` / `diagnostics`.
- TypeScript: npm `typescript-language-server` + `typescript`, spawned via the same Electron/`DSH_NODE_EXEC_PATH` rules as Vue.
- Java: Eclipse JDT LS 1.57.0 resolved from `DSH_JDTLS_HOME` or `~/.dsh/language-servers/jdtls`; first-use download of the pinned milestone tarball. Not vendored in git.
- Desktop and web bundles mount `lsp-languages` after `lsp-vue`.
- Workbench `EditorTab` binds `.vue` → `vueLsp`, TS/JS → `tsLsp`, `.java` → `javaLsp`. Components never see `ctx`.
- Diagnostics are not session events and never enter a model request.

## Why not two packages

A second copy of the lean JSON-RPC connection would fail jscpd. One package, two gateways.

## Out of scope

Editor hover / F12 / rename. Lombok agent. MyBatis `.xml`. Python. Arbitrary VS Code extensions. Diagnostics in the model.

## Verification

- `pnpm exec vitest run packages/lsp/lsp-languages --coverage.enabled --coverage.include=packages/lsp/lsp-languages/src/**`
- `pnpm exec vitest run packages/client/ui-xmart-workbench/tests/monaco-host.client.spec.tsx packages/client/ui-xmart-workbench/tests/editor.client.spec.tsx packages/client/ui-xmart-workbench/tests/editor-lsp.client.spec.ts packages/client/ui-xmart-workbench/tests/vue-lsp.client.spec.ts`
- Relaunch `pnpm dsh desktop`. Open a `.ts` file (project `tsconfig` helps) and a `.java` file (first open may download ~50MB JDT LS).
