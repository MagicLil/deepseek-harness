# @deepseek-ai/dsh-lsp-languages

English | [中文](README.zh.md)

First-party TypeScript and Java language-server hosts for X-Mart. One plugin mounts **two** persistent processes per workspace — `typescript-language-server` and Eclipse JDT LS — and shares each between the AMD Monaco editor (diagnostics and completions) and the existing `ctx.lsp` seam.

It does **not** activate VS Code extensions, replace Monaco, or change `ctx.lsp`'s four operations. It does **not** claim `.vue` (owned by [`dsh-lsp-vue`](../lsp-vue/README.md)) or `.xml`.

Default-export plugin (`apply`). It plugins `TsLspGateway` and `JavaLspGateway`, which inject `lsp`, `fs`, and `subprocess`, register the `typescript` and `java` providers, and publish the `tsLsp` / `javaLsp` Remote namespaces (`open` / `change` / `close` / `complete` / `diagnostics` / `definition` / `hover` / `references` / `implementation` / `warmup`). Client packages consume the remotes through the [`api-remotes`](../../api/remotes/README.md) assembly. There are no new HTTP routes or WebSockets.

## What it does

- **TypeScript / JavaScript** — resolves this package's `typescript-language-server` CLI and `typescript/lib` at first use. The child is launched with no shell: the host Node binary (`DSH_NODE_EXEC_PATH` under Electron, otherwise `process.execPath`) plus `--stdio`. `initialize` passes `tsserver.path` so the server loads this package's TypeScript.
- **Java** — resolves Eclipse JDT Language Server 1.57.0 from `DSH_JDTLS_HOME` or `~/.dsh/language-servers/jdtls`. On first warmup or first open, if that tree is missing, the host downloads the pinned milestone tarball (~50MB) and extracts it. The JDT 1.57 process always needs **Java 21+** (Java 17 can boot Equinox but the OSGi bundles will not resolve). The host scans `JAVA_HOME`, sibling folders (`java17` / `java21`), `PATH`, and well-known roots such as `D:\developTool` and `C:\Program Files\Java`, then launches Equinox with the newest 21+ JDK (`DSH_JDTLS_JAVA` wins; a Java 17 `JAVA_HOME` is skipped). Project compile level (8 / 17 / 21) is read from `.java-version` / Maven / Gradle and passed as `java.configuration.runtimes` so a Java 8 module still type-checks against a Java 8 JDK when one is installed. Plus the Equinox launcher jar, platform `config_*`, and a per-workspace `-data` directory under `~/.dsh/jdtls-data/`.
- Keeps editor buffers open (`didOpen` / full-text `didChange` / `didClose`) and versions them. Agent queries reuse an already-open document; otherwise they transient-open like `dsh-lsp-stdio`.
- Captures `textDocument/publishDiagnostics` on the JSON-RPC connection (the generic stdio host ignores server notifications). Diagnostics are **not** session events and never enter a model request.
- Answers `workspace/configuration` from static config, accepts lifecycle bookkeeping, and rejects `workspace/applyEdit`.

## Model Experience

Indirectly, through `dsh-tool-lsp`, which surfaces these providers' normalized results for `.ts` / `.js` / `.java` files; this host contributes no prompt or schema itself. Editor remotes are not model-facing.

#### KV Cache effect

None from the editor path. Agent results follow `dsh-tool-lsp`.

## Known Limitations and Deferred Work

- **Weak TypeScript results without a project `tsconfig`** — that is a language-server limitation, not a host bug.
- **Java diagnostics are noisy without Lombok and a Maven/Gradle import** — v1 does not attach the Lombok agent. Set `DSH_JDTLS_HOME` to a prepared JDT LS tree if you already have one.
- **First Java warmup may download ~50MB** — needs network once; later sessions reuse `~/.dsh/language-servers/jdtls`. A huge Maven / Gradle import can still finish after `initialize`; the first jump in that window may wait.
- **Editor rename is out of scope** — hover, F12, and find-references are on the editor remotes; rename is not.
- **Arbitrary VS Code extensions still do not run.**
