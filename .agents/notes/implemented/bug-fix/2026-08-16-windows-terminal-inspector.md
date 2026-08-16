# Agent Note: Windows terminal process inspector

Status: implemented

English | [中文](2026-08-16-windows-terminal-inspector.zh.md)

## Problem

Opening a workbench terminal on Windows failed before ConPTY allocated. `spawnTerminal` constructs `createProcessInspector()`, and that factory threw `subprocess-local: terminal inspection is unsupported on platform win32`. The UI showed the unavailable note with that message. This machine also has no `wmic` (Windows 11 removed it).

## Decision

`createProcessInspector('win32')` returns a Windows inspector. It has no POSIX process groups: `foregroundPgid` is undefined, `isStdinWaiting` is false, and `processSession` is empty. An injected `windows-process-table` snapshot can supply a rooted tree for tests; production DEFAULT exec misses that name, so trees fall back to `kill(pid, 0)` on the PTY root and SIGKILL uses contained `taskkill /T /F`. `LocalTerminalHandle.stopShell` also signals that captured root: Windows `node-pty.kill` does not terminate PowerShell, so graceful teardown has to go through the inspector. `inspectForeground` returns undefined; xterm Ctrl+C still travels as `\x03` through `host.terminalWrite` into ConPTY.

## Alternatives considered

**Spawn PowerShell `Get-CimInstance Win32_Process` on every scan.** Rejected: a full CIM table is ~250ms plus a multi-second `powershell.exe` startup. Readiness polling would stall the PTY.

**Call `wmic` like macOS calls `ps`.** Rejected: `wmic` is absent on this Windows 11 host and is an optional feature elsewhere.

**Toolhelp32 via koffi.** Rejected for this fix: koffi already has an Electron ABI history in this fork, and the inspector only needs to construct so ConPTY can start.

## Follow-up: stuck on "Starting terminal..."

After the inspector unblocked ConPTY, the UI still waited on bash MOTD. `host.terminalOpen` awaited `session.initialize()`, which looks for the OSC prompt `dsh> `, then 3s silence, then a 30s timeout. PowerShell never emits that marker, and `inspectForeground` is undefined on Windows, so the tab stayed on "Starting terminal..." even though the PTY was already up. Live xterm watch only attaches after spawn returns.

UI spawn now passes `waitReady: false` so the backend returns as soon as the PTY exists. Agent-tool spawn still waits for readiness; when the provider cannot report a foreground group, observed output plus a short idle settles `inferred_idle` instead of sitting on the 3s/30s bounds. A Node-side ConPTY smoke (`windows-pty-output.spec.ts`) emits `PS ` within 2s, so the substrate is not silent. The first prompt still races the client: `waitReady: false` now waits up to 2.5s for the first **sanitized printable** text. Against the live desktop the black xterm was not that race: `workspace-write` `confine()` spawned `electron.exe …/runner.js -- powershell.exe` because `process.execPath` is Electron. That second Electron does not keep the ConPTY, so the prompt leaked into the `pnpm dsh desktop` console. Interactive tabs no longer confine. The windows-acl runner prefix uses `DSH_NODE_EXEC_PATH` (same record as the folder-picker worker).

## Consequences

Desktop must fully quit and rerun `pnpm dsh desktop` after rebuilding host `lib/` for `dsh-terminal`, `dsh-terminal-bash`, and `dsh-host-apiproxy`. Open a new terminal tab; leftover tabs from the old wait can stay on "starting". Windows still has no exact foreground-group SIGINT; line-oriented `host.terminalSignal` cannot resolve a process group. Descendant discovery without an injected snapshot is the PTY root only; ConPTY close and `taskkill /T` remain the tree teardown.
