# Agent Note: Cursor-style primary sash

Status: implemented

English | [中文](2026-08-16-cursor-sash.zh.md)

## Problem

The left sidebar (Explorer / Git / Tasks) looked like it could not be dragged wider. The resize affordance was a 12×32 floating pill in the vertical center of the frame. Hovering the column edge — where Cursor puts the sash — showed no line. The handle also sat at `z-index: 2` under `shell.overlay` (`z-index: 20`). The primary width ceiling was 420px, too tight for the Git graph.

## Decision

Replace the pill with a Cursor/VS Code sash: an 8px hit strip on every resize edge, hover/drag paints a 2px `--dsw-alias-state-business-primary` line the full length. Raise the handle to `z-index: 21` so the overlay cannot steal the pointer. Raise `WORKBENCH_MAX` from 420 to 800. Concession order is unchanged: a primary drag still takes space from the editor first.

## Alternatives considered

**Keep the pill and only raise z-index.** Rejected: the pill sits in the middle of a tall window; users looking at the Git graph edge never find it.

**Let a primary drag steal from conversation when the editor is at 400px.** Rejected for this change: that is not Cursor (each sash only resizes the two adjacent tracks). Shrink the conversation sash separately if the editor is already at the floor.

## Consequences

Desktop must rebuild `ui-layout` (`lib/client.js`) before the new sash paints. Existing sessions that already stored a 260–420 width keep that preference until the user drags again.
