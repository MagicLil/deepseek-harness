# Agent Note: Cursor-style commit graph chrome and click-to-diff

Status: implemented

English | [中文](2026-08-15-git-scm-commit-diff.zh.md)

## Problem

The Git graph still showed a leading short hash, hid the author, and treated a row click as `git switch --detach`. Cursor opens that commit's per-file unified diff in the editor track instead.

## Decision

**Row click opens a hidden `diff` tab.** The seed is `commit:<hash>`. `workspaces.gitCommitDiff` calls existing `host.gitDiff` with optional `commit`. The host runs `git show --format= --first-parent --patch` so root commits work and merge rows show the first-parent patch. `side` stays required for old clients and is ignored when `commit` is set.

**Graph chrome matches Cursor.** Rows drop the leading hash, paint a dimmed author after the subject, use taller rails, and ring the HEAD node. Local branch pills still `git switch`. Remote/tag pills still detach. HEAD pills stay inert.

**Diff tab splits the patch.** Each `diff --git` file becomes a collapsible header (filename, dimmed directory, A/M/D/R) plus numbered add/del lines. Monaco DiffEditor stays deferred.

The new `commit` field and `gitCommitDiff` are not agent tools and are not on the inspect-catalog whitelist.

## Alternatives considered

**Keep detach on the row and add a separate "view" control.** Rejected: that is not the Cursor gesture the panel is copying.

**`hash~1` / `git diff HEAD^`.** Rejected: the root commit has no parent.

**A new `host.gitShow` RPC.** Rejected: optional `commit` on the existing required-on-read `host.gitDiff` is the smaller fork cost.

## Consequences

Clicking history opens a commit diff; checkout remains on ref pills. Octopus layout, syntax-highlighted Monaco diffs, and Agent Review stay out of scope.
