# Agent Note: Git picker after adding a Workspace

Status: implemented

English | [中文](2026-08-17-git-workspace-repo-picker.zh.md)

## Problem

The Source Control toolbar showed only the session's original repository. After the user registered another Workspace from the rail, there was no repository dropdown, so they could not switch. The previous probe treated every extra Workspace path as a git root and ignored it when `git status` said it was not one. A parent folder sitting beside an already-open repo (the usual “add the outer project directory” move) therefore never contributed its child work trees. Slash and drive-letter spellings of the same folder were also compared with `!==`.

## Decision

`discoverGitRoots` walks the session cwd plus every registered Workspace path. A seed that is a work tree is kept. A seed that is `git-unavailable` contributes its immediate visible children, the same one-level fallback the empty-cwd path already used. Git-failed seeds are not treated as parents. Roots are keyed with a slash- and case-normalized folder key so `D:\repo` and `D:/repo` collapse. The Git tab uses that list for the toolbar picker whenever more than one root remains.

## Alternatives considered

**Keep probing only exact Workspace paths.** Rejected: adding the parent of `deepseek-harness` is a real registration, and that parent is not a work tree.

**Recursively scan the disk for `.git`.** Rejected: the earlier Git discovery note already ruled that out; the bound stays registered Workspace paths plus one child level.

## Consequences

Opening Git after adding a sibling repo or a multi-project parent shows a repository dropdown. One extra `listEntries` runs for each registered folder that is not itself a work tree.
