# Agent Note: Serialize editor saves and confirm Git discard

Status: implemented

English | [中文](2026-08-17-workbench-save-and-discard.zh.md)

## Problem

Two workbench actions could lose disk data without crashing. `EditorTab.handleSave` started a new `writeFile` on every click. Save A still in flight, the user edited and saved B, and whichever promise settled last wrote the file. The later-finishing older write could restore stale bytes while the status said Saved. Git Restore / Discard All / the context-menu discard verb called `gitDiscard` on the first click (`git restore` / `clean -f`). A misclick was irreversible.

## Decision

`EditorTab` keeps one in-flight write per tab. Extra Save clicks while that write is open set a coalesce flag. When the current write succeeds, the tab writes `contentRef` once more if the flag is set, so the last buffer wins and an older completion cannot overwrite it. A failed write drops the queue and shows the existing save-error status. If the buffer changed during the write and the user did not save again, the tab stays dirty.

Git discard (row, Discard All, context menu) goes through `confirmGitDiscard` and `window.confirm`, the same pattern as review force-revert. Cancel is a no-op. Copy lives in `git.discardConfirm` / `git.discardAllConfirm`.

## Alternatives considered

**Abort the in-flight write and start the new one.** Rejected: `workspaces.writeFile` has no abort, and a late completion of the aborted call would still race.

**Disable Save while status is Saving.** Rejected: a click during the first write would drop the later buffer. Coalesce keeps the last intent.

**Custom in-panel confirm instead of `window.confirm`.** Rejected: review already uses the native dialog for an irreversible overwrite, and a second modal stack is more UI than this fix needs.

## Consequences

This is L2 (`ui-xmart-workbench`). Rapid Save writes the latest buffer in order. Restore asks first. Desktop must rebuild that package's `lib/client.js` before the queue and the confirm copy appear.
