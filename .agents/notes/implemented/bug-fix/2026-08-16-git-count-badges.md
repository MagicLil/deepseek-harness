# Agent Note: Green Git count bubbles

Status: implemented

English | [中文](2026-08-16-git-count-badges.zh.md)

## Problem

SCM section counts used `--dsw-alias-brand-primary` (not remapped to 万物智汇 green), so the pills read as faint white bubbles. The activity-bar Git icon had no summary at all.

## Decision

Count staged vs unstaged the same way Cursor does (a path in both areas counts twice). Put a green pill (`--dsw-alias-button-info-fill` / `#5BB73B`) on the right of each section header, and the same green bubble on the Git icon with staged + unstaged (cap `99+`). The activity bar loads status on its own so the icon stays current when Explorer is showing.

## Alternatives considered

**Only restyle the existing section pills.** Rejected: the user asked for the icon summary as well.

**Badge only after the Git tab mounts.** Rejected: the icon is visible on every activity.

## Consequences

Opening a workspace starts one extra `gitStatus` from the activity bar. Multi-project folders probe the first child repo until the Git tab publishes a selected root.
