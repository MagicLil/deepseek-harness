# Agent Note: Editor / conversation header hairline

Status: implemented

English | [中文](2026-08-17-editor-conversation-hairline.zh.md)

## Problem

The file-tab strip was a 28px row with its own bottom rule. The editor path / save row painted a second rule immediately under it. The conversation header sits on a 36px title row with one hairline. At the column sash those two left-hand rules sat above and below the dialogue line, so the junction looked like a broken double stroke.

## Decision

The workbench tab strip is a 36px `border-box` row with the single hairline. The editor path / save / LSP row no longer has a bottom border. The conversation header rule is unchanged.

## Alternatives considered

**Keep both rules and only raise the tab strip to 36px.** Rejected: the save row would still draw a second line a few pixels below the now-aligned junction.

**Fold path / save into the tab strip.** Rejected: that row still has to show a long path, LSP notice, and Save; stuffing it into the 36px strip would clip or wrap the tabs.

## Consequences

This is L2 (`ui-xmart-workbench` CSS). Desktop must rebuild that package's `lib/client.js` before the single aligned rule paints.
