# Agent Note: Drop the workbench Tasks activity

Status: implemented

English | [中文](2026-08-16-drop-workbench-tasks.zh.md)

## Problem

The activity-bar Tasks icon opened a primary-sidebar panel that almost always said the session had no running work and no subagents. Live turn, jobs, and children already live in the conversation column. The empty panel took a rail slot next to Explorer and Git.

## Decision

Remove the built-in `tasks` activity and its hidden tab. The activity bar and View menu keep Explorer and Git. Desktop drops `activity-tasks` from the native menu and IPC command union. Persisted `activity: "tasks"` sanitizes to Explorer. `tasks` stays in `SHELL_TAB_TYPES` so an old persist tab cannot appear on the editor strip.

## Alternatives considered

**Keep the tab type and only hide the icon.** Rejected: a registered body with no UI entry is dead code, and the apply wiring for jobs/subagents existed only to feed that panel.

**Leave View → Tasks on the desktop menu.** Rejected: a menu row that opens nothing is the same leftover as the icon.

## Consequences

The left rail is Explorer and Git. Plugins can still `registerActivity`. Job kill/output and a later tasks page stay out of scope unless the product asks for them again.
