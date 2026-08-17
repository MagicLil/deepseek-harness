# @deepseek-ai/dsh-host-agent-review

English | [中文](README.zh.md)

Host Remote for **Agent change review**: per-turn shadow snapshots of files mutated by `write` / `edit` (and related file tools), so the workbench can show counts, diffs, accept, and revert after a turn — including after an app restart.

`AgentReviewGateway` registers the `agentReview` service and publishes generated Remotes: `get`, `accept`, `acceptAll`, `revert`, `revertAll`, `diff`, `dismissShell`. Shadows and the index live under `~/.dsh/agent-review/<sessionId>/`. Capture runs on `tools/pre-execute` (must call `next()`); settle runs on `tools/result`. Shell-like tools (`bash`, `pwsh`, …) set `shellMaybeMutated` and heuristically capture literal `Remove-Item`/`rm`/`del` paths as `kind: delete` rows when the file exists. Opaque mutators (`cursor_agent`, `subagent`, `subagent_fork`, `subagent_acp`, plus `Config.opaqueMutationTools`) snapshot `git status --porcelain` before the call and import create/update/delete rows after it returns. Paths named in the tool arguments or result are imported even when git is missing or the file is gitignored, including a same-content overwrite of a named write target. Dismissing the shell-only warning clears that flag on disk so it stays gone after reload; a later shell tool in the same turn raises it again. Accept keeps disk and drops the shadow; it does **not** `git stage`. Files larger than 2 MiB (configurable) are marked `irreversible`.

The service is consumed through the [`api-remotes`](../../api/remotes/README.md) assembly. There are no new HTTP routes.

## Model Experience

None. This Host manager registers no prompt, tool, message, or provider request. Shadows are not session events and never enter model input.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **Most shell mutations are not reverted** — only a turn-level warning flag, except literal `Remove-Item`/`rm`/`del` deletes captured as `kind: delete`.
- **Opaque child writes prefer git, then named paths** — `cursor_agent` / `subagent*` capture uses `git status` in the session cwd, then paths mentioned in the prompt/result. The shell warning is only raised when neither detector finds a file.
- **Binary / oversize files** — skipped as irreversible.
- **Editor dirty check** — the Remote `force` flag covers disk conflicts; dirty-buffer checks are enforced by the workbench client before calling revert.
