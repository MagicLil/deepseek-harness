# @deepseek-ai/dsh-host-workspace-checks

English | [中文](README.zh.md)

Host Remote for the workbench Problems / Checks bottom panel. `WorkspaceChecksGateway` registers `workspaceChecks` and publishes `start` / `poll` / `stop` Remotes that run one subprocess at a time through `ctx.subprocess` (collected stdout/stderr, tree-scoped terminate).

The Client discovers which `package.json` scripts to run and builds argv; this package resolves `argv[0]` through `ctx.subprocess.resolveExecutable` and executes in the given workspace root. On Windows, resolved `.cmd`/`.bat` package-manager shims are launched via `cmd.exe /v:off` (same pattern as the Claude Code subagent), because Node cannot spawn those shims without a shell. There are no new HTTP routes.

## Model Experience

None, as this Host manager registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **One live run** — a new `start` stops the previous live process.
- **Log retention** — each stream keeps an in-memory tail (default 1 MiB); older bytes are marked `lossy` on poll.
- **No script discovery here** — package.json convention detection stays on the Client.
