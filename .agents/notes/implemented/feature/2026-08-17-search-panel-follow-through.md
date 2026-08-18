# Agent Note: Search panel follow-through

Status: implemented

English | [中文](2026-08-17-search-panel-follow-through.zh.md)

## Problem

Workbench global search could find text and open the line, but the rest of the daily path was incomplete: the editor did not select the match, a later keystroke hid the previous hits with no Searching… note, every host failure said the same sentence, results were mouse-only, and D7 file-tool refreshes left the hit list stale.

## Decision

The search pane stays L2 on `host.search`. `revealTarget` now carries the first span's exclusive `end`; `EditorReveal` is optional-end and Monaco `setSelection` + `revealRangeInCenter` paints the run. ArrowUp/Down steps `selectedKey` across visible (non-collapsed) hits; Enter opens that hit, or still flushes a search when nothing is selected. A later search keeps the previous hits and shows Searching… until the new page arrives. `classifySearchFailure` splits `search-unavailable`, glob `search-invalid`, regex `search-invalid`, and other failures into four locale strings. The pane watches `files.refreshNonce` (the same D7 / explorer bump Git already uses) and re-runs the current query.

## Alternatives considered

**Add replace-in-files and streaming results in the same change.** Those need new host.search fields or a streaming RPC. The desktop channel rule still forbids a private WebSocket. This note ships the five follow-through fixes that fit the existing unary contract.

**Persist the query in localStorage.** Explorer expanded dirs already persist; search was deliberately memory-only so a restart does not re-fire ripgrep. Left as-is.

**Focus the result tree on ArrowDown (VS Code).** The input keeps focus so typing continues; `selectedKey` is the only extra state.

## Consequences

Clicking or keyboard-opening a hit selects the match in the editor. Agent writes and the explorer refresh icon refresh search the same way they refresh Git. Replace-in-files, load-more past the 500 cap, comma-separated globs, and a gitignore toggle remain out of this change.

## Testing

`search-store.client.spec.ts` pins reveal `end`, error kinds, and hit-key walking. `search-tab.client.spec.tsx` pins stale Searching…, keyboard open, distinct errors, and a `bumpRefresh` re-search. `monaco-host.client.spec.tsx` pins `setSelection` for a spanned reveal and a caret-only reveal.
