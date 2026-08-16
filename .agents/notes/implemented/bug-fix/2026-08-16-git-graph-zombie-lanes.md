# Agent Note: Git graph zombie lanes

Status: implemented

English | [中文](2026-08-16-git-graph-zombie-lanes.zh.md)

## Problem

The SCM history graph painted a dense multicolored grid, unlike Cursor's sparse rails. `layoutGitGraph` opened a new lane for every merge second parent. Parents that were not in the current `git log` page never resolved, so `slots` and `railCount` only grew.

## Decision

Parents still upcoming in this page keep a real rail. Parents outside the page get a short stub and no slot. A first parent that is also off-page clears the lane instead of leaving a ghost hash. Each row's SVG uses the page-max rail width so commit subjects stay aligned.

## Alternatives considered

**Cap painted lanes at 6 and hide the rest.** Rejected: that would clip real local branches. The density was leftover merge parents, not too many live tips.

**Style-only: thinner strokes and tighter pitch.** Rejected: twenty zombie rails still look like a grid at any stroke width.

## Consequences

A merge whose other parent is on a later page shows a hook, not a continuing colored column. Rebuild `ui-xmart-workbench` client before desktop shows the sparse graph.
