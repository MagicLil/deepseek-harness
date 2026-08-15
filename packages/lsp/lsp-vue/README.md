# @deepseek-ai/dsh-lsp-vue

English | [中文](README.zh.md)

First-party Vue language-server host for X-Mart. One plugin instance spawns **one persistent `@vue/language-server` process per workspace** and shares it between the AMD Monaco editor (diagnostics and completions) and the existing `ctx.lsp` seam (hover / definition / references / implementation on `.vue` only).

It does **not** activate VS Code extensions, replace Monaco, or change `ctx.lsp`'s four operations. `.ts` / `.tsx` / `.js` are owned by [`dsh-lsp-languages`](../lsp-languages/README.md).

Default-export plugin (`VueLspGateway`). It injects `lsp`, `fs`, and `subprocess`, registers the `vue` provider, and publishes the `vueLsp` Remote namespace (`open` / `change` / `close` / `complete` / `diagnostics` / `definition` / `hover` / `references` / `implementation` / `warmup`). Client packages consume the remotes through the [`api-remotes`](../../api/remotes/README.md) assembly. There are no new HTTP routes or WebSockets.

## What it does

- Resolves this package's `@vue/language-server` bin and `typescript/lib` at first use. The child is launched with no shell: the host Node binary (`DSH_NODE_EXEC_PATH` under Electron, otherwise `process.execPath`) plus `--stdio` and `--tsdk`.
- Initializes with `typescript.tsdk` so the server can load this package's TypeScript, not whatever happens to sit on `PATH`.
- Keeps editor buffers open (`didOpen` / full-text `didChange` / `didClose`) and versions them. Agent queries reuse an already-open document; otherwise they transient-open like `dsh-lsp-stdio`.
- Captures `textDocument/publishDiagnostics` on the JSON-RPC connection (the generic stdio host ignores server notifications). Diagnostics are **not** session events and never enter a model request.
- Answers `workspace/configuration` from static config, accepts lifecycle bookkeeping, and rejects `workspace/applyEdit`.

## Model Experience

Indirectly, through `dsh-tool-lsp`, which surfaces this provider's normalized results for `.vue` files; this host contributes no prompt or schema itself. Editor remotes are not model-facing.

#### KV Cache effect

None from the editor path. Agent results follow `dsh-tool-lsp`.

## Known Limitations and Deferred Work

- **Weak results without a Vue `tsconfig`** — that is a language-server limitation, not a host bug.
- **Editor rename is out of scope** — hover, F12, and find-references are on the editor remotes; rename is not.
- **No `.ts` / `.tsx` language service here** — those keys belong to [`dsh-lsp-languages`](../lsp-languages/README.md).
- **Arbitrary VS Code extensions still do not run.**
