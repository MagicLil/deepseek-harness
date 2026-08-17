# Agent Note: Activity-bar Git badge sums every project repo

Status: implemented

English | [中文](2026-08-17-git-badge-all-repos.zh.md)

## Problem

The activity-bar Git bubble counted one work tree: the last Git-tab selection, else the session cwd, else the first child repo. A multi-repo project folder (VS Code multi-root parent with `sanmu_qd` / `sanmu_hd` / … beside each other) showed only that one repo, so the icon disagreed with the picker.

## Decision

`readGitBadgeSnapshot` uses the same seed set as the Git picker (`gitWorkspaceSeeds` + `discoverGitRoots`) and sums staged + unstaged across every discovered work tree. The snapshot `root` stays the last selected repo when that path is still in the set, otherwise the first discovered root. The visible cap is `1k+` (exact count through 1000). Sibling / parent rail projects stay out, matching the picker.

The Git tab still paints the selected repo immediately, then republishes the sum so a switch or a failed selected root cannot hide the other repos.

## Alternatives considered

**Keep one-repo counts and only raise the `99+` cap.** Rejected: the user asked for a project-wide total. One dirty child of 220 already caps; the missing siblings were the defect.

**Count every registered Workspace, including other rails.** Rejected: the picker already filters to the current project folder. The icon must match that list.

**Have the Git tab own the badge and drop the activity-bar watch.** Rejected: the icon is visible while Explorer or Search is showing, which is why [the count-bubble note](2026-08-16-git-count-badges.md) loads status without mounting SCM.

## Consequences

Opening a multi-repo folder issues one `gitStatus` per discovered root (discover, then recount). A vanished child between those two passes is skipped. The older note's "first child until the Git tab publishes a root" sentence is superseded here.
