# Agent Note: Cursor-style Git SCM chrome

Status: implemented

English | [中文](2026-08-15-git-scm-chrome.zh.md)

## Problem

The Git tab already had Cursor's two change lists and user-clicked sync, but the chrome still read as a form: a `GIT` title, bordered repo/branch selects, a fat create-branch row, a labeled commit button, and a `hash + subject` dump. With a clean work tree the panel looked like a log viewer, not Source Control.

## Decision

**Match Cursor's Source Control chrome in L2.** The activity title is Source Control. The toolbar is a text-like branch picker, an icon sync control with `↑` / `↓`, and an icon refresh. Change rows show a colored file glyph, the filename, a dimmed directory, hover verbs, and `M` / `A` / `D` on the right. History is a `图表` / Graph section: newest-first colored lanes plus the subject.

**`host.gitLog` carries optional `parents` (L3).** `git log` format includes `%P`. The field is omitted when a commit has no parents, so old clients still parse. The lane painter falls back to a single spine when `parents` is missing.

**Still out of scope in this slice:** Agent Review. AI commit messages, ref pills, and checkout-from-graph live in [the AI/graph note](2026-08-15-git-scm-ai-graph.md).

## Alternatives considered

**Ship only CSS on the old form.** Rejected: bordered selects and a hash dump still read as a dashboard, which is the gap the screenshots showed.

**Vendor a Git Graph webview.** Rejected: desktop has no page WebSocket, and a third-party panel would not sit on `host.git*` IPC.

## Consequences

A clean work tree still shows the graph, so the panel does not collapse to empty chrome. Merge commits open a second lane when the host returns `parents`. The create-branch field stays on the panel as a thin row because daily Git still needs it; it is not hidden behind an overflow menu.
