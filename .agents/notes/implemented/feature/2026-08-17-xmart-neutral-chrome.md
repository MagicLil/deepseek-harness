# Agent Note: X-Mart neutral chrome

Status: implemented

English | [中文](2026-08-17-xmart-neutral-chrome.zh.md)

## Problem

The 万物智汇 green `#5BB73B` is locked as the brand mark. The L2 overlay from [X-Mart conversation chrome](../../implemented/feature/2026-08-16-xmart-conversation-chrome.md) remapped DeepSeek-blue aliases onto that green, including large washes and markdown links. Upstream canvas tokens stay on the `neutral-bluish` family. Warm green on cool bluish chrome reads as muddy olive in dark mode. In light mode the Windows caption-button overlay was hardcoded to dark `#151517` in `apps/desktop/src/title-bar.ts` and never followed the renderer theme, so the top-right min/max/close island stayed black on a light title track.

## Decision

`#5BB73B` (light ink `#3D8C28`) is a sparse accent. The canvas and selected-row washes are true neutrals. Markdown links use body text. The desktop caption overlay follows the resolved light/dark scheme.

Green stays on the logo, the send button and other filled brand controls, the active-tab underline, badges and status dots, brand focus rings, and the small `Xmarting...` shimmer. Selected session and nav rows, conversation bubbles, and page/sidebar/title fills are neutral. Markdown links use `--dsw-alias-label-primary` with an underline on hover.

The overlay path is still `theme.overrideTokens` in `ui-xmart-workbench`, plus two L3 patches (`MarkdownText.module.css` and desktop `titleBarOverlay` / preload IPC). `packages/client/ui-theme/src/styles/design-platform.css` is not edited. Success / error / warn tokens and trajectory series that bind `--dsw-static-blue-*` stay as they are.

## Palette

Dark: conversation and editor `#181818`; sidebar, title track, and session list `#141414`; raised layers `#1F1F1F` through `#2C2C2C`; selected row `#2A2A2A`; caption overlay background `#141414` and symbols `#C8C8C8`. Monaco keeps One Dark Pro token colors; `charcoalOneDarkPro` retints `editor.background` (and the matching gutter / minimap / peek surfaces) from `#282c34` to `#181818`.

Light: conversation and editor `#FFFFFF`; sidebar, title track, and session list `#F5F5F5`; selected row `#EBEBEB`; caption overlay background `#F5F5F5` and symbols `#333333`.

## Token overlay

`packages/client/ui-xmart-workbench/src/client/brand-accent.ts` is the L2 owner.

Keep green:

| Token | Light | Dark |
|---|---|---|
| `--dsw-alias-state-business-primary` | `#3D8C28` | `#5BB73B` |
| `--dsw-alias-button-info-fill` | `#5BB73B` | `#5BB73B` |
| `--dsw-alias-button-info-hover` | `#4A9C32` | `#6BC84A` |
| `--dsw-alias-brand-primary-new-colorprimary-new-color` | `#3D8C28` | `#5BB73B` |
| `--dsw-static-deepseek-200` | `#CDE9C4` | `#CDE9C4` |
| `--dsw-static-deepseek-450` | `#3D8C28` | `#5BB73B` |
| `--dsw-static-deepseek-500` | `#3D8C28` | `#5BB73B` |

Remap washes and chrome:

| Token | Light | Dark |
|---|---|---|
| `--dsw-alias-bg-base` | `#FFFFFF` | `#181818` |
| `--dsw-alias-bg-layer-1` | `#FFFFFF` | `#1F1F1F` |
| `--dsw-alias-bg-layer-2` | `#FFFFFF` | `#262626` |
| `--dsw-alias-bg-layer-3` | `#FFFFFF` | `#2C2C2C` |
| `--dsw-specific-sidebar-fill` | `#F5F5F5` | `#141414` |
| `--dsw-alias-state-business-tertiary` | `#EBEBEB` | `#2A2A2A` |
| `--dsw-specific-sidebar-nav-item-active-accent` | `#EBEBEB` | `#2A2A2A` |
| `--dsw-specific-bubble` | `#F5F5F5` | `#1F1F1F` |
| `--dsw-specific-bubble-highlight` | `#EBEBEB` | `#2A2A2A` |

## Markdown links

`.markdown a` and `.fileMention` in `packages/client/ui-primitives/src/markdown/MarkdownText.module.css` bind to `--dsw-alias-label-primary`. `state-business-primary` stays the chrome accent. Recorded as FORK-PATCHES entry 58.

## Desktop caption overlay

`apps/desktop/src/title-bar.ts` exposes light and dark overlay pairs. Preload `setTitleBarOverlay` sends `'light' | 'dark'` on `dsh:title-bar-overlay`. `ui-xmart-workbench` pushes `active.colorScheme` on apply and `theme/change` when `window.__DSH_IPC__` is present. `ThemePresenter` does not know about Electron. Window creation picks an initial pair from `nativeTheme.shouldUseDarkColors`; the first renderer snapshot corrects it. Web has no caption overlay. Recorded as FORK-PATCHES entry 59.

## Alternatives considered

**Tint the canvas toward green.** Rejected: the user chose neutralized chrome with green as accent only. A green-gray canvas would house the mark more quietly but reads as tea-green / clinical when overdone.

**Shift the brand green cooler so it sits on bluish neutrals.** Rejected: `#5BB73B` is locked.

**Leave markdown links on `state-business-primary`.** Rejected: that token is the chrome accent. Green body links recast the whole dark conversation as olive. Sharing the token makes the two roles inseparable.

**Edit `design-platform.css` to replace the bluish scale.** Rejected: that is a wide L3 fork of the upstream token sheet and a permanent sync conflict. The documented third-party path is `theme.overrideTokens`.

**Put caption sync inside `ThemePresenter`.** Rejected: the presenter is a pure DOM applier. Desktop IPC belongs at the workbench fiber that already owns the brand overlay, plus the existing desktop preload bridge.

## Consequences

Dark chrome is charcoal; light session list and title track are `#F5F5F5`; selected rows are gray. Light-mode Windows caption buttons sit on `#F5F5F5`. Switching Appearance updates the overlay without a restart. Markdown links are body-colored. Tabs, send, and activity icons stay green. `brand-accent`, title-bar, markdown CSS, title-bar-sync, and apply tests pin the contract.

The caption overlay can flash the wrong pair for one frame at startup if the persisted preference disagrees with `nativeTheme`; the first `theme/change` corrects it. Markdown link L3 will conflict on every upstream edit of `MarkdownText.module.css`. Overriding `bg-base` and `sidebar-fill` also retints settings, marketplace, and any other surface that consumes those aliases — that is intended for a whole-app canvas.
