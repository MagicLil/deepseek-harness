# @deepseek-ai/dsh-client-ui-xmart-skills

English | [中文](README.zh.md)

Skills settings page for 万物智汇. The browser plugin registers one localized `settings.section` contribution with id `skills`. It performs no Remote read during plugin activation. The page is browse-only: personal skills merge the user-home skill roots; the project tab groups each open workspace and deep-scans that tree for `SKILL.md`. A search box filters the visible list by name or description. A switch next to each row turns the skill on or off. Names already in personal are omitted from the project tab unless the project has its own copy. There is no create, edit, or import form on this page.

The registration uses `ctx.slots.inject()`, so it follows late section declaration, redeclaration, locale changes, and teardown. Calls go through [`api-remotes`](../../api/remotes/README.md) `remote.skillManager`. There are no new HTTP routes.

## Model Experience

None, as this package only lists on-disk skill files in browser Settings and registers nothing model-facing. After files appear under an owned or agents root, the existing skill catalog may refresh through the filesystem provider.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No in-page create, edit, or import** — change a skill by editing the markdown file in its original directory.
- **One snapshot per tab or retry** — the page does not subscribe to filesystem watchers; switching tabs reloads the list.
