# @deepseek-ai/dsh-host-skill-manager

English | [中文](README.zh.md)

Host Remote for the X-Mart Skills settings page. `SkillManagerGateway` registers the `skillManager` service and publishes generated direct Remotes: list / get / save / delete owned skills, list a project catalog, plus list / import foreign skills (import is parked; the Settings page does not call it).

Owned writes go only to `~/.dsh/skills` (personal) and `<project>/.dsh/skills` (project). Each save materializes `<name>/SKILL.md`. `listProject` walks the workspace for every `SKILL.md` (and flat files in `skills/` folders), hides names already in personal unless the project has its own `.dsh` / `.agents` / in-repo copy, and `setEnabled` writes `disable-model-invocation`. Listing also accepts mixed-case names other agents already use, such as `loean7-codingJournal`.

The service is Remote-only and declares no same-process Cordis `Context` merge. Client packages consume it through the [`api-remotes`](../../api/remotes/README.md) assembly. There are no new HTTP routes.

## Model Experience

None, as this Host manager registers no prompt, tool, message, or provider request. After a save or import, the existing filesystem skill provider may discover the new file on its next catalog refresh.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **Toggle writes `disable-model-invocation`** — `.dsh/skills` and `.agents/skills` are patched in place. Claude / Cursor / Codex copies are copied into an owned `.dsh` root first.
- **Rename is delete plus create** — `saveOwned` uses the request name as the directory identity.
- **Import is parked** — `importForeign` still exists for later, but Settings only browses. Same-name foreign home scans still collapse when `listForeign` is used.
