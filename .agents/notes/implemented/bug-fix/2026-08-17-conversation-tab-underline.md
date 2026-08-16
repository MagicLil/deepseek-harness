# Agent Note: Conversation tab underline alignment

Status: implemented

English | [中文](2026-08-17-conversation-tab-underline.zh.md)

## Problem

The conversation header paints a full-width 1px hairline and a 2px active-tab bar. Both sat at `bottom: 1px` above a transparent header border, and the bar used a 2px pill radius. The green accent then looked like a floating dash on a broken gray rule.

## Decision

The hairline and the active bar share `bottom: 0`. The bar keeps the 2px Figma height, rounds only its top corners, and covers the rule under the selected tab. The transparent `border-bottom` spacer is gone.

## Alternatives considered

**Drop the hairline and keep only the green bar.** Rejected: the header still needs a separator from the transcript; the discomfort was the double/offset stroke, not the existence of a rule.

**Make the active bar 1px so it is only a color change.** Rejected: the header comment and Figma spec keep a 2px active bar.

## Consequences

`ConversationRoot.module.css` is an L3 fork patch. Desktop must rebuild `ui-conversation` (`lib/client.js`) before the aligned bar paints.
