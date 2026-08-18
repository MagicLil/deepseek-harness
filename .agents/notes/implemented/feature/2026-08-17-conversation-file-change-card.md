# Agent Note: Conversation file-change card

Status: implemented

English | [中文](2026-08-17-conversation-file-change-card.zh.md)

## Problem

`edit` / `write` already arrive in the chat stream as a one-line `Edit · path` row. The applied diff is collapsed behind that row, and `+N -M` sits in a footer after expand. That is not the Cursor-style file card users scan while the agent works: icon, path, counts, and a short snippet in the flow. Keep/Undo already live on the composer Review dock; this gap is display, not review.

## Decision

The workbench L2-shadows `tool.call.toolview` for `edit` and `write` at priority `-1` (lowest live entry renders) and draws `FileChangeCard`. The card reads the existing `card:'diff'` hunks on the call/result view. Header shows the file icon, a workspace-relative path, `+N -M`, copy, and optional Full diff. The snippet is an LCS-aligned unified hunk (context / delete / add) with word-level marks on replacements, green/red line backgrounds, and new-file line numbers when the start line can be inferred (creates start at 1; edits locate a unique line via `workspaces.readFile`). The snippet starts expanded and caps at 8 lines. Clicking the path or a numbered line calls `layout.openWorkbench` + `requestReveal` + `xmartWorkbench.openFile`. Copy writes a git-style unified patch. Full diff opens the existing `agent-review-diff` tab for the turn that owns that path. Failures and calls with no usable diff stay a one-line fallback. No Keep/Undo pills on the card.

## Alternatives considered

**Restyle upstream `FileMutationRow` / `DiffBlock` (L3).** Every profile and the details panel would change, and each upstream sync would re-conflict on those files. The workbench is the product surface that wants the Cursor chrome.

**A new `ui-xmart-file-cards` package.** Same slot takeover, extra README/coverage/bundle tax, and the click-to-open path still belongs to the workbench.

**Invent a parallel chat node for "files changed".** Duplicates the tool-call stream and would tempt session-format or loop changes. The keyed toolview seat already owns per-tool chrome.

**Keep/Undo on the card.** Rejected: review stays on `conversation.input.dock`.

## Consequences

Desktop and web-app both load the workbench, so both get the card. Headless and any profile without the workbench keep the shipped `FileMutationRow`. Review stays on `conversation.input.dock`. Shell and opaque-subagent files are not cards. Other conversation path chips still open the OS app. Oversized hunks (`n*m > 40000`) skip LCS and dump delete-then-add.

## Testing

`file-change-diff.client.spec.ts` covers LCS align, word marks, line locate/number, and patch format. `file-change-model.client.spec.ts` covers derivation and path resolve. `file-change-card.client.spec.tsx` covers the visible card, collapse, cap, fallback, copy, jump, and review. `file-change-actions.client.spec.ts` and `review-counts.client.spec.ts` cover turn lookup. `apply.client.spec.ts` declares `tool.call.toolview` and checks the `-1` shadow, `openInWorkbench` reveal, `readFile`, and Full diff.
