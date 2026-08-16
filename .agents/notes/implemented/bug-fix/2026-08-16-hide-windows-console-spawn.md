# Agent Note: Hide Windows console on local subprocess spawn

Status: implemented

English | [中文](2026-08-16-hide-windows-console-spawn.zh.md)

## Problem

The desktop app is a GUI process. When a session runs the Pwsh tool, `dsh-subprocess-local` spawned `pwsh` (a console-subsystem executable) without `windowsHide`. Windows allocated a visible console for that child, so a black window flashed on every command.

## Decision

`spawnSubprocess` and `taskkillProcessTree` always pass `windowsHide: true`. The flag is a local-provider Windows detail, not a `SubprocessSpawnSpec` field: every ordinary tree already collects or pipes stdio, and a GUI parent must not allocate a console. POSIX ignores the option. The contract lives in `windows-hide.spec.ts`, which stays off the win32 bash-exclusion list so Windows actually runs it.

## Alternatives considered

**Set `windowsHide` only in `dsh-pwsh-local`.** Rejected: bash-local (Git Bash), LSP stdio, and `taskkill` are the same class of console-subsystem children and would keep flashing.

**Add `windowsHide` to `SubprocessSpawnSpec`.** Rejected: the subprocess seam applies no defaults and does not carry substrate windowing. Callers have no reason to show a console for a collected or piped tree.

## Consequences

Desktop must load the rebuilt `@deepseek-ai/dsh-subprocess-local` `lib/` (or restart a source-plane `pnpm dsh desktop`) before Pwsh stops flashing. A child that itself allocates a new visible window is outside this hide.
