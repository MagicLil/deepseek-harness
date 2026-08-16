# Agent Note: Cursor-like Git graph layout

Status: implemented

English | [中文](2026-08-16-git-graph-cursor-layout.zh.md)

## Problem

The SCM graph looked like a colored barcode. `host.gitLog` used `git log --all`, so every remote tip opened a rail. Every history row then used the page-max rail width, which pushed the subject far to the right of its own dot. Dots and strokes were also heavier than Cursor's.

## Decision

Walk HEAD only (`git log -n`, no `--all`). Reserve a merge rail only when that parent is within 16 rows and under 8 live lanes; otherwise paint a stub. Each row's SVG is only as wide as that commit's dot (and stub). Stroke 1px, dot r=2.5.

## Alternatives considered

**Keep `--all` and only cap painted lanes.** Rejected: the extra tips are still in the list; the barcode comes from walking every remote, which Cursor's history list does not.

**Align every subject after a shared graph column.** Rejected: that is what left the long empty gap on left-lane commits.

## Consequences

Unmerged remote branches no longer appear as parallel rails; their commits show after checkout. Desktop must rebuild host `apiproxy` and the workbench client, then fully quit the app.
