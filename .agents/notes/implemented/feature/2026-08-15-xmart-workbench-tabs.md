# Agent Note: X-Mart workbench tab registry

Status: implemented

English | [中文](2026-08-15-xmart-workbench-tabs.zh.md)

## Problem

The Phase 0 workbench column is empty chrome. Community workbenches expose `registerTab` / `registerFileViewer` so other plugins can add pages, but they also pass `ctx` into React components and persist layout over HTTP. This repo forbids components from seeing `ctx`, and the desktop shell has no webserver. The column still needs a first-party registry, a session-persisted tab strip, and a settings enable switch before explorer/editor/Git/terminal bodies land.

## Decision

**`ctx.xmartWorkbench` is the only registration API.** Built-in types and third-party plugins call the same `registerTab` / `registerFileViewer`; each call returns a disposer. Tab bodies receive `{ tab, visible, sessionId }` — not `ctx`, not the service object. `available` is `(scope, state) => boolean` (no ctx argument); a plugin that needs ctx closes over it in `apply`. `single` is sugar for `dedupeKey: () => id`. `createTab` may refuse with `null`; its `nextSeq` patch applies only when the minted tab is appended. Settings-disabled types are omitted from the `+` menu and `openTab` returns undefined; `available === false` only disables the menu row. An open tab whose type is gone renders a placeholder. Viewer matching is one pass, priority descending, detect before extensions; a catch-all with `detect` never claims without head bytes.

**Layout state is a single panel.** The column persists `{ tabs, activeTabId, nextSeq }` per session (`dsh.xmart.workbench.tabs.<sessionId>`). Enable maps persist at `dsh.xmart.workbench.prefs` (absent key = enabled). Split panes wait. The Settings → Workbench section is a `settings.section` contribution (order 25) with one switch per registered tab and viewer. `openFile` matches a viewer for later phases and opens the hidden `file` stub, deduped by path. A content seed (`path` / `url`) calls `ctx.layout.openWorkbench`; a type-only `+` open does not.

## Alternatives considered

**Keyed `workbench.tab` slots instead of `registerTab.component`.** Rejected for v1 because third parties would have to register twice (metadata + slot). The service is the documented extension point; the column looks up `component` through an inject callback.

**Pass `ctx` into tab bodies (better-sidebar).** Rejected: client components never see ctx. Plugins close over `apply`'s ctx when they need a service.

**Host `settingsScope` for enable maps.** Rejected for v1: the switches are a client viewing preference, same class as the column width persist. Cross-device sync can move to `settingsScope` later without changing the service methods.

**Put tabs in the conversation `conversation.view` ring.** Rejected in the column note; the registry does not reopen that choice.

**Ship split panes in this slice.** Rejected: a single strip is enough to prove register / open / persist / placeholder / disable. Split surgery waits.

## Consequences

Web and desktop both expose `ctx.xmartWorkbench`. A user can open the built-in Demo tab from `+`, close it, switch sessions, and get the same tabs back. Disabling Demo in Settings hides it from `+` and refuses a new open; an already-open Demo tab stays. Unregistered persisted types show a placeholder. Later phases register explorer/editor/Git/terminal through the same API and start rendering matched viewers from `openFile`. `conversation.view` and `agent-loop` stay untouched.
