# Global Search Source Recovery Implementation Plan

> **For agentic workers:** Restore each layer independently, run its focused red/green test cycle, and preserve unrelated working-tree changes.

**Goal:** Re-establish source/artifact parity for Ctrl+Shift+F global search and make packaged ripgrep resolvable from `dsh-host-apiproxy`.

**Architecture:** `host.search` owns bounded ripgrep execution behind the existing ApiProxy transport. `ctx.workspaces.search` forwards the typed result to the L2 workbench Search activity; Electron and Web menu commands only select and focus that activity.

**Tech Stack:** TypeScript, Cordis ApiProxy, React, Vitest, `@vscode/ripgrep`, Electron.

## Global Constraints

- Do not overwrite unrelated uncommitted changes.
- Do not add HTTP routes, WebSockets, a shell layer, or a system `rg` fallback.
- Keep all registrations inside the existing plugin effects.
- Record the L3 files under the existing global-search entry in `FORK-PATCHES.md`.
- Do not commit or push.

---

### Task 1: Restore and prove the host search operation

**Files:**
- Create: `packages/host/apiproxy/src/search-ops.ts`
- Create: `packages/host/apiproxy/src/ripgrep.d.ts`
- Modify: `packages/host/apiproxy/src/api/{host.ts,host.schema.ts,rpc-map.ts,index.ts}`
- Modify: `packages/host/apiproxy/src/{api-proxy.ts,fetch/client.ts,fetch/handler.ts}`
- Modify: `packages/host/apiproxy/package.json`
- Test: `packages/host/apiproxy/tests/{search-ops.spec.ts,api-proxy-file-search.spec.ts}`

- [ ] Restore the focused tests first and run them to observe missing-module or missing-method failures.
- [ ] Restore the bounded `rg --json` implementation and typed RPC wiring.
- [ ] Add the direct `@vscode/ripgrep` dependency and refresh the lockfile.
- [ ] Re-run both host tests until green.

### Task 2: Restore typed client forwarding

**Files:**
- Modify: `packages/client/connection/src/client/{api.ts,index.ts,fixture.ts}`
- Modify: `packages/api/remotes/src/client/index.ts`
- Modify: `packages/client/runtime/src/client/{contract/workspaces.ts,workspaces/service.ts,index.ts}`
- Modify: `packages/test-support/client-runtime/src/workspaces.ts`
- Test: the corresponding connection/runtime/test-support workspace specs.

- [ ] Restore forwarding tests and observe the absent `search` contract failure.
- [ ] Restore `FileSearch*`, `FileSearchOptions`, `SearchAccessError`, and every fake implementation.
- [ ] Re-run focused forwarding tests until green.

### Task 3: Restore the Search activity

**Files:**
- Create: `packages/client/ui-xmart-workbench/src/client/{search-store.ts,SearchTab.tsx}`
- Preserve: `packages/client/ui-xmart-workbench/src/client/SearchTab.module.css`
- Modify: `packages/client/ui-xmart-workbench/src/client/{index.ts,contract.ts,app-menu-dispatch.ts,MenuBar.tsx,locales.ts}`
- Test: `packages/client/ui-xmart-workbench/tests/{search-store.client.spec.ts,search-tab.client.spec.tsx,app-menu-dispatch.spec.ts,menu-bar.client.spec.tsx,apply.client.spec.ts}`

- [ ] Restore pure store/component/menu tests and observe missing-source failures.
- [ ] Restore Search activity state, rendering, file reveal, menu dispatch, and bilingual copy while preserving current pre-commit/check-panel edits.
- [ ] Re-run all focused workbench tests until green.

### Task 4: Restore desktop commands and durable rationale

**Files:**
- Modify: `apps/desktop/src/{app-menu.ts,ipc-protocol.ts}`
- Test: `apps/desktop/tests/app-menu.spec.ts`
- Create: `.agents/notes/implemented/feature/2026-08-16-workbench-global-search.{md,zh.md}`
- Create: `.agents/notes/implemented/feature/2026-08-16-workbench-global-search.i18n.yaml`
- Modify: `packages/client/ui-xmart-workbench/README.{md,zh.md}`
- Modify: `packages/client/ui-xmart-workbench/README.i18n.yaml`

- [ ] Restore desktop menu assertions before commands and observe their failure.
- [ ] Restore `file-search` and `activity-search` command wiring.
- [ ] Restore the Agent Note and current-state package documentation.
- [ ] Run focused desktop tests and documentation pairing checks.

### Task 5: Build and run the original reproduction

- [ ] Run focused typechecking and tests for all touched packages.
- [ ] Build host libraries, client libraries, the workbench bundle, and Web assets from source.
- [ ] Restart the desktop host.
- [ ] POST the deterministic `host.search` reproduction request and require `result.ok: true`.
- [ ] Reproduce Ctrl+Shift+F in the live UI and require visible grouped matches with no “搜索失败。” state.
