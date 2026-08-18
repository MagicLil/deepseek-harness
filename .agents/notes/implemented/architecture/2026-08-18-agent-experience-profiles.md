# Agent Note: Agent experience profiles select independent UI and behavior packages

Status: implemented

English | [中文](2026-08-18-agent-experience-profiles.zh.md)

## Problem

Agent presets already choose a per-session composition, but all presets shared one desktop Tool timeline. A Codex-oriented preset therefore could adjust its prompt and tools without selecting the compact execution presentation that makes the mode recognizably distinct. Adding per-mode conditions to the generic renderer would make every later profile edit modify DSH's default path.

## Decision

`preset.yml` accepts optional `experienceProfile` metadata. Discovery carries that identifier through `agentPreset.list`, and the client resolves it from the session's durable `agentPreset` selection. An absent identifier deliberately resolves to no profile and retains the native DSH Tool tree.

`dsh-client-ui-tool` owns a registry keyed by that identifier. It wraps the standard logged Tool tree only when an independently loaded presentation registers the selected key. `dsh-client-ui-codex-experience` registers `codex` and owns its compact frame; it does not change the generic Tool call renderer, model request, tool execution, or session log.

The desktop and Web bundles load the Codex presentation plugin. It remains inert for every session whose preset does not declare `codex`. A future Claude or OpenCode package adds a new registry entry and preset metadata without editing the generic Tool tree or the Codex package.

## Verification

Focused metadata, RPC-schema, profile-resolution, and timeline-registry tests cover metadata round-tripping, wire transport, native fallback, independent registration, disposal, and duplicate-owner refusal. The targeted client and host TypeScript projects build together.

## Alternatives considered

- **Codex branches in `ui-tool`** — this would make a profile-specific visual rule part of the default renderer and require changes there for every new mode.
- **A second Agent loop per mode** — preset composition already persists the selected preset per session, so duplicating the loop would increase behavioral coupling without improving profile selection.
- **One global UI setting** — a global setting cannot reconstruct which profile produced a historical session and would let one session's choice alter another session's presentation.

## Consequences

The profile identifier is display/runtime metadata, not a model-visible input or a new session event. Presets remain independently distributable: a missing presentation registry entry falls back to the native Tool tree instead of failing a session. A profile package can only alter its wrapper; atomic Tool views, call pairing, and session topology remain owned by their existing packages.
