# Agent Note: Review dock hangs on the composer card

Status: implemented

English | [中文](2026-08-17-review-dock-hang-on-composer.zh.md)

## Problem

The composer review list sat in `conversation.input.dock` as a free-floating strip. It did not share the input card's width, top radius, or border, so it looked detached from the dialog instead of like Cursor's attached header.

## Decision

L2 `ReviewDock` matches the input card geometry (`--dsh-composer-card-max-width` + side clearance), uses the same stroke token, rounds only the top 22px, and cancels the stack gap with a negative margin. L3 `ConversationRoot.module.css` flattens `[data-composer-card]`'s top radius and top border when `[data-review-dock]` is present. The card chrome lives in upstream `InputBar`; L2 cannot restyle a sibling.

## Alternatives considered

**Overlap the card with a tall negative margin and paint over the top radius.** Rejected: that covers the draft padding and still leaves the 22px corners visible.

**Move the review UI inside the composer card.** Rejected: would take over `conversation.composer.bar` or add a new hole in the InputBar.

## Consequences

Todo/queue docks above the review strip keep the normal 6px stack gap. Only the input card top changes, and only while the review dock is mounted.
