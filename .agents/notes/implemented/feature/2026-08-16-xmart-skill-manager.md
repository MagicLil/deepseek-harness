# Agent Note: X-Mart skill manager in Settings

Status: implemented

English | [中文](2026-08-16-xmart-skill-manager.zh.md)

## Problem

The harness already discovers and invokes skills, but the desktop product had no place to browse or import them. Users who already keep Claude Code or Cursor skills in `~/.cursor/skills` or `~/.claude/skills` could not see those files inside 万物智汇 without copying them by hand.

## Decision

Add an L2 Host Remote (`@deepseek-ai/dsh-host-skill-manager`) and an L2 Settings page (`@deepseek-ai/dsh-client-ui-xmart-skills`).

Owned creates still go only to `~/.dsh/skills` and `<project>/.dsh/skills`. The Settings page is browse-only (name + description + an on/off switch). Personal listing merges `~/.dsh/skills`, `~/.agents/skills`, `~/.cursor/skills`, and `~/.claude/skills`. The project tab groups each open workspace and deep-walks that tree for every `SKILL.md` (and flat files in `skills/` folders), regardless of which agent created the folder. Names already in personal stay off the project tab unless the project has its own `.dsh` / `.agents` / in-repo copy, which then wins. `setEnabled` writes `disable-model-invocation` in place for `.dsh` and `.agents`; other copies are copied into an owned `.dsh` root first. Import is parked; the page does not copy files on its own. The existing `skill.list` slash-menu RPC is unchanged. The Client calls `ctx.remote.skillManager` through the api-remotes assembly (desktop IPC), with no new HTTP route.

## Alternatives considered

**Extend `skill.list` on api-proxy.** Rejected because that RPC is documented as the domain's only catalog lookup and must stay session-addressed and read-only.

**Scan foreign roots through `skill-filesystem`.** Rejected because that would make Claude/Cursor skills model-visible before the user imports them, and would be an L3 change to an upstream provider.

**Edit `.agents/skills` in place for create/delete.** Still rejected. Toggle is the narrow exception: `skill-filesystem` already honors `disable-model-invocation` there, so the switch patches that flag instead of copying the whole bundle.

## Consequences

Listing a skill is ordinary disk I/O. The filesystem skill provider's watcher refreshes the model/user catalogs on the next discovery. The Settings page does not subscribe to that watcher; switching tabs reloads its own list.
