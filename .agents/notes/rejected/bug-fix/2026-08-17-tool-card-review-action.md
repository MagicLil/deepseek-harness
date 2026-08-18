# Agent Note: Review pill on opaque child tool cards

Status: rejected — the card pill is not Review; users need the composer dock file list (Keep / Undo / Review), and a lone button next to Inspect is the wrong affordance

English | [中文](2026-08-17-tool-card-review-action.zh.md)

## Problem

Calling `cursor_agent` only showed Inspect on the tool card. Review lived solely on `conversation.input.dock` (composer), and that dock stays hidden until the host imports files. While the child runs, the user stares at the card and sees no Review.

## Proposal

Add a list slot `tool.call.actions` under every atomic card in `ui-tool`. The workbench registers an always-visible Review pill for `cursor_agent` / `subagent*`. Click opens the first pending review diff, or the workbench if the child has not written yet.

This was built, then rejected after a real `cursor_agent` create: the pill sat alone under the card, the composer dock stayed empty (or showed only the shell warning), and the user compared it to the normal Agent file-review strip (N files, Undo All / Keep All / Review).

## Alternatives considered

**Only show the composer dock during the run.** That is the correct product. The dock was empty because opaque capture fell back to `markShell` when git could not see the new file; the fix is path hints in [opaque subagent review](../../implemented/bug-fix/2026-08-17-agent-review-opaque-subagent.md), not a second button.

**Replace the `cursor_agent` toolview in the workbench.** Rejected: cross-package import of GenericToolCard is forbidden; reimplementing the card is worse than a small slot — and a slot is still the wrong UI.

**Hover-only pill next to Inspect.** Rejected with the original proposal: Inspect is already easy to miss. The later rejection is stronger: no card pill at all.
