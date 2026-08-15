# Agent Note: X-Mart workbench file icons

Status: implemented

English | [中文](2026-08-16-xmart-workbench-file-icons.zh.md)

## Problem

The explorer tree and the center editor tab strip rendered file names only. A folder of `.java` files looked like a plain list, so the workbench felt emptier than Cursor even after the tree and tabs themselves worked.

## Decision

**Bake the full Material Icon Theme into `ui-xmart-workbench`.** `scripts/generate-icon-theme.mjs` calls `generateManifest()` from `material-icon-theme` (devDependency, MIT) and writes `src/client/icon-theme-data.ts`: file-name / compound-extension / folder-name tables plus every referenced SVG. The plugin server only serves `client.js`, so sibling SVG files cannot be fetched at runtime; inlining is the L2 path that stays off `modules` and `apps/web`.

**Resolve like VS Code.** `resolveIconId` lowercases the basename, then exact `fileNames`, then longest `fileExtensions` (`foo.d.ts` before `ts`), then the default file glyph. Directories use `folderNames` / `folderNamesExpanded`. `FileIcon` renders a decorative `<img>` data URI. The explorer puts the glyph after the chevron (files get a chevron-width spacer). The editor `TabBar` uses the same component from `tab.path` or `tab.title`.

## Alternatives considered

**A hand-drawn set of ~20 language marks.** Rejected: the user asked for the full theme, including special folders and exact names such as `package.json`.

**Serve SVGs next to `client.js` or from `/monaco`-style static dist.** Rejected: `/plugins/<id>/` only answers `client.js`, and copying into `apps/web/dist` is an L3 patch on upstream static serving.

**Call `generateManifest` in the browser.** Rejected: the generator is a Node build tool. The JSON is produced at generate time and imported by the client bundle.

## Consequences

Explorer rows and editor tabs show the same colorful glyphs Cursor users expect (Java cup, TypeScript mark, `src` folder, and so on). Regenerating the theme is `pnpm --filter @deepseek-ai/dsh-client-ui-xmart-workbench generate:icons`. The client bundle grows by about 1.2 MB uncompressed because the plugin has no other asset channel. Git / Tasks lists are unchanged. `conversation.view` and `agent-loop` stay untouched.
