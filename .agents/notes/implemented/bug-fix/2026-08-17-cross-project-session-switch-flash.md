# Agent Note: Cross-project conversation switch flash

Status: implemented

English | [中文](2026-08-17-cross-project-session-switch-flash.zh.md)

## Problem

After [same-project chrome stayed mounted](2026-08-17-same-project-session-switch-flash.md), clicking a conversation in another folder still flashed the window. The live sidebar width was replaced with that session's persist (often closed or a different width), and AppFrame eased `grid-template-columns` for 300ms. Explorer keyed each FileTree by folder path, so the new root mounted empty and painted「加载中」.

## Decision

Keep the live sidebar width on any session switch while chrome stays mounted, and write that width into the destination persist. AppFrame sets `data-settling` for two animation frames on session change so the grid does not ease (`transition: none`, same as `data-dragging`). Explorer reuses the FileTree instance across root changes and keeps the last ready listing painted until the new root settles.

## Alternatives considered

**Restore each session's remembered width.** Rejected: that is what animated the whole frame. Width is a live chrome preference, not per-folder content.

**Leave FileTree keyed by folder path.** Rejected: a new instance always starts from an empty map, so stale-paint inside FileTree never runs.

**Disable the grid transition globally.** Rejected: collapse/expand of the conversation and sidebar should still ease. Only session-change settling and pointer drags skip it.

## Consequences

Switching to another project's conversation keeps the explorer rail and the previous tree on screen until the new listing arrives. Chat content still remounts. Desktop must load rebuilt `ui-layout` and `ui-xmart-workbench` `lib/` before the flash is gone.
