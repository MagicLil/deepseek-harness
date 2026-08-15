# Git activity paints an empty primary sidebar

English | [中文](2026-08-15-git-sidebar-blank.zh.md)

## Why

Clicking the activity-bar Git icon selected the view, but the left primary column stayed a blank black strip. Two things stacked:

1. The `primarySidebar` slot wrapper is `display: contents`. If the sidebar root only used `flex: 1` without a definite `height: 100%`, the Git/Explorer pane (`flex: 1; min-height: 0`) could compute to height 0 and clip every status line.
2. A missing or throwing Git body used to render nothing. The frame slot error boundary then painted an empty `<div data-slot-error>`, which looks like “Git is not implemented.”
3. `registerActivity` used to run *after* `registerTab` and only when `getTab('git')` was already live. If those effects had not flushed, Git never entered the activity registry; a later duplicate `registerActivity` could also abort `apply` before the sidebar slot was installed.

## What changed

`PrimarySidebar` always shows an activity title, fills the column (`height: 100%`), and keeps a fallback when the body is unregistered or throws (`ActivityPaneBoundary`). `GitTab` treats a synchronous `gitLog`/`gitStatus` throw as the error phase and does not assume `changes` / `log` are arrays. Explorer / Git / Tasks now register the tab and the activity in the same `ctx.effect`. `AppFrame` `primaryCol` is a positioned flex column so the contents-wrapped occupant can fill the track.

See workspace `FORK-PATCHES.md` entry 7.
