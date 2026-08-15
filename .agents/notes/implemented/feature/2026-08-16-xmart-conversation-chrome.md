# Agent Note: X-Mart conversation chrome

Status: implemented

English | [中文](2026-08-16-xmart-conversation-chrome.zh.md)

## Problem

The conversation column still used DeepSeek blue accents and 16px body type. The running-turn label was the hardcoded English `Deep diving...`. None of that matched the 万物智汇 brand or a Cursor-like density.

## Decision

**Accent color is an L2 token overlay.** `ui-xmart-workbench` calls `ctx.theme.overrideTokens` with the 万物智汇 green (`#5BB73B` dark / `#3D8C28` light ink). The remapped aliases are `state-business-primary`, `state-business-tertiary`, `button-info-fill/hover`, `brand-primary-new-colorprimary-new-color`, and `sidebar-nav-item-active-accent`. Success / error / warn stay on their own tokens. Trajectory series that bind `--dsw-static-blue-*` stay blue.

**Type size and running copy are L3.** Assistant body, user bubble, and composer card go from 16px to 13px. The running status string becomes `Xmarting...`. Those values are hardcoded in `ui-conversation` with no slot or locale key.

## Alternatives considered

**Replace `conversation.session` with a fork-owned chat shell.** Rejected: same work as a second conversation plugin, and every upstream chat feature would have to be re-homed.

**Remap only conversation CSS (option A).** Rejected: the user chose whole-app accent (option B). The token overlay is the documented third-party theme path.

## Consequences

Selected tabs, the send button, focus rings, and markdown links turn green wherever they consume the remapped aliases. Chat text is denser. Fiber dispose removes the overlay. Sync cost is the four `ui-conversation` files plus snapshots.
