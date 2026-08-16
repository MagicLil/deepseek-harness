# Agent Note: Primary sidebar past two-thirds

Status: implemented

English | [中文](2026-08-17-primary-past-two-thirds.zh.md)

## Problem

The Git / Explorer column still stopped at `floor(viewport * 2 / 3)`. A live drag that asked for more was clamped, so a wide Git panel (commit graph, gates, file list) could not eat the empty editor. The sash hit strip was 8px centered on the border: half of it sat on the sidebar's Windows scrollbar and row-action cluster, so grabbing the visible divider often did nothing.

## Decision

Drop the shared 2/3 ratio for primary. `workbenchMax` is now `viewport - ACTIVITY_WIDTH - 160`, matching the bottom-panel habit of leaving a 160px editor remainder. Conversation stays at two-thirds. Widen the vertical sash to 16px (4px over the sidebar, 12px over the editor) and mark it `-webkit-app-region: no-drag` so Electron cannot treat the strip as a window move.

## Alternatives considered

**Keep the 2/3 cap and only widen the sash.** Rejected: the screenshot already showed a wide sidebar; the next drag hit the ratio clamp even when the handle was found.

**Let primary grow to the full frame (editor 0).** Rejected: the editor track must stay a real column so empty-state copy and later file tabs do not collapse to a 0-width grid cell.

## Consequences

A wide Git drag can close chat and leave the editor as a 160px sliver. Desktop must rebuild `ui-layout` (`lib/client.js`) before the new ceiling and sash paint.
