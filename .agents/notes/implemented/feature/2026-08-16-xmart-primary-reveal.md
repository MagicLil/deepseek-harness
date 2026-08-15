# Agent Note: Reveal Explorer after a 2/3 conversation drag

Status: implemented

English | [中文](2026-08-16-xmart-primary-reveal.zh.md)

## Problem

Dragging the conversation column to two-thirds of the frame makes `computeColumns` concede the primary sidebar to width 0. Activity-bar clicks still called `openWorkbench`, but that action no-op'd when the stored preference was already 260. Explorer / Git / Tasks looked dead.

## Decision

Keep the public `ctx.layout.openWorkbench()` face. AppFrame writes the live frame width into the layout store. `openWorkbench` / the opening side of `toggleWorkbench` now ask `planPrimaryReveal`: if leftover room is generous, open at the 260px default; if a wide chat is blocking, shrink conversation so explorer and editor can split the leftover (prefer 400/400).

## Alternatives considered

**New `revealPrimary` on `ILayout`.** Rejected: every activity-bar / menu caller already uses `openWorkbench`. Changing the existing open path covers Explorer, Git, and Tasks together.

**Always 50/50 even when leftover is huge.** Rejected: that would replace the 260px default on a normal click and fight the workbench persist store.

## Consequences

An explicit Explorer / Git / Tasks click may rewrite the conversation preference. Concession on resize still does not. Desktop must rebuild `ui-layout` (`lib/client.js`) before the click works.
