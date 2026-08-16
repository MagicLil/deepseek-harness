# Agent Note: Primary sidebar drag to two-thirds

Status: implemented

English | [中文](2026-08-16-primary-two-thirds.zh.md)

## Problem

Raising `WORKBENCH_MAX` to 800px was not enough. A live primary drag wrote a larger preference, then `computeColumns` preferred chat and shrank the left sidebar back so the editor could stay at 400px. Conversation already reaches two-thirds of the frame; the Git / Explorer column could not.

## Decision

Give primary the same ceiling as conversation: `floor(viewport * 2 / 3)`. A live primary sash drag (`prefer: 'primary'`) shrinks then closes conversation, and may drop the editor below 400px — the mirror of a 2/3 chat drag. Pointer-up writes both column preferences so the next idle paint does not snap the sidebar back.

## Alternatives considered

**Keep the 800px store cap and only raise the sash hit target.** Rejected: the solver still conceded primary to protect chat and the editor floor.

**Collapse the session list automatically so 2/3 always fits with a 400px editor.** Rejected: the session rail is not on this sash; conversation drag already starves the editor instead.

## Consequences

A wide left-sidebar drag may close chat and squeeze the editor, same as a wide chat drag already squeezes Explorer. Desktop must rebuild `ui-layout` (`lib/client.js`) before the new ceiling paints.
