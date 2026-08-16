# Agent Note: Drop Git-panel recommended gates

Status: implemented

English | [中文](2026-08-17-drop-git-recommended-gates.zh.md)

## Problem

The Git panel listed typecheck / lint / test / build as recommended gates and blocked Create Commit until those rows passed or were skipped. The inferred commands often failed or were unrelated to the staged set, so the block became a checkbox tax: users had to run a noisy suite or hand the failure to the Agent before a local commit that still does not push.

## Decision

The Git panel no longer shows recommended gates and no longer consults check status. Create Commit needs staged files, a non-empty message, and the existing confirm checkbox. The bottom-panel Checks tab still discovers and runs the same scripts on demand.

## Alternatives considered

**Keep the list but stop blocking commit.** Rejected: a failing four-row table above the message box is the same chicken rib; hiding the run buttons still spends the panel on a preview nobody asked to see.

**Move the run action into Checks only, keep the Git-panel preview.** Rejected: the preview existed to drive the pre-commit block. Without the block it is a second Checks UI.

## Consequences

A local commit from the Git panel is confirm-gated only. Quality gates stay in the Checks tab and in CI. `recommend-gates.ts` is gone; GitTab no longer takes a Checks store or Agent-fix callback.
