# Agent Note: Desktop P0 journey completeness

Status: implemented

English | [中文](2026-08-17-desktop-p0-journeys.zh.md)

## Problem

The workbench shell (explorer, search, Git, editor, terminal, review) was already in place, but the first-run and file-open journeys still looked unfinished. The editor `+` menu offered a demo tab. The blocking welcome still said DeepSeek Harness. Image tabs were a path plus “open in the system app” because `host.readFile` refuses NUL bytes. Explorer rename/delete and conversation path chips already had host verbs and a `chatFileOpen` seam; they were not the missing work.

## Decision

Hide the demo tab type (`hidden: true`). The `+` button disappears when the menu is empty. A persisted demo tab still renders.

Bump `WELCOME_NOTICE_VERSION` to `2026-08-17.1` and replace the notice copy with the 万物智汇 / Xmart product welcome in `ui-settings-models` `onboarding-copy.ts`. The Web e2e scaffold keeps a duplicated constant (it cannot import the client package) and the welcome snapshot follows the Chinese dialog.

Add UI-only `host.readFileBytes` on the existing ApiProxy `POST /api/host.*` seam: base64 plus a MIME guess, 8 MiB cap, NUL allowed. `IWorkspaces.readFileBytes` decodes in the browser with `atob`. The image tab builds a blob URL, keeps the system-open button, and reloads on the files-store token. Not an inspect-catalog or agent tool.

Explorer rename/delete stay as already shipped ([explorer rename and delete](2026-08-17-explorer-rename-delete.md)). Conversation chips stay on `chatFileOpen` (FORK-PATCHES entry 65).

## Alternatives considered

**Reuse `host.readFile` and strip the NUL refusal for images.** Rejected: the editor contract is UTF-8 text. Mixing binary into that method would make every caller handle `file-binary` vs real text.

**Open a dedicated HTTP/WebSocket for bytes.** Rejected: desktop client↔host features stay on first-party RPC. A private route would work only on Web.

**Leave the welcome as an L2 overlay.** Rejected: the modal copy and ack version live in upstream `onboarding-copy.ts`. A second dialog would stack or fight the existing onboarding coordinator.

**Delete the demo tab registration.** Rejected: old persisted tabs would become unknown-type placeholders. Hiding it keeps those tabs renderable.

## Consequences

Existing users see the welcome again because the ack version changed. Images larger than 8 MiB stay on the system-open fallback. `host.readFileBytes` is another L3 wire method and will conflict on upstream apiproxy / `IWorkspaces` syncs. Demo remains in the type registry for old localStorage rows.

## Testing

`image-mime.spec.ts` and `api-proxy-read-file-bytes.spec.ts` pin MIME guesses, NUL, the size cap, abort, and directory refusal. `fetch-carrier.spec.ts` round-trips the new method. `workspaces-service.client.spec.ts` decodes `aGk=` and wraps `file-too-large`. `media-tabs.client.spec.tsx` pins preview, error, idle, abort, and reload. `tab-bar.client.spec.tsx` hides `+` when the menu is empty. `welcome-notice.client.spec.tsx` plus the Web welcome snapshot pin the new copy.
