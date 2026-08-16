# X-Mart Neutral Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neutralize 万物智汇 canvas chrome so `#5BB73B` is a sparse accent, markdown links use body text, and the Windows caption overlay follows light/dark.

**Architecture:** L2 `theme.overrideTokens` in `ui-xmart-workbench` owns the palette. Markdown anchors leave `--dsw-alias-state-business-primary` so that token can stay green for chrome. Desktop `titleBarOverlay` splits into light/dark pairs; the workbench fiber pushes `active.colorScheme` over the existing preload IPC. Do not edit `design-platform.css` or teach `ThemePresenter` about Electron.

**Tech Stack:** TypeScript (strict ESM), Cordis `ctx.effect` / `theme/change`, Electron `setTitleBarOverlay`, CSS Modules, Vitest.

**Spec:** `.agents/notes/proposed/feature/2026-08-17-xmart-neutral-chrome.md`

## Global Constraints

- Brand green is locked: `#5BB73B` (light ink `#3D8C28`).
- Do not edit `packages/client/ui-theme/src/styles/design-platform.css`.
- Do not remap success / error / warn tokens. Trajectory series that bind `--dsw-static-blue-*` stay blue.
- Do not put Electron IPC inside `ThemePresenter`.
- Registrations stay inside `ctx.effect()` and return a disposer.
- This repo commits only when the user asks. Prepare the commit message; do not run `git commit` unless the user said to commit.
- After code that ships in `lib/`, the agent rebuilds the matching packages. The user only restarts with `pnpm dsh desktop`.

## File map

- Modify: `packages/client/ui-xmart-workbench/src/client/brand-accent.ts` — token map.
- Modify: `packages/client/ui-xmart-workbench/tests/brand-accent.client.spec.ts` — pin the map.
- Create: `packages/client/ui-xmart-workbench/src/client/title-bar-sync.ts` — duck-typed desktop IPC helper.
- Create: `packages/client/ui-xmart-workbench/tests/title-bar-sync.client.spec.ts`
- Modify: `packages/client/ui-xmart-workbench/src/client/index.ts` — subscribe `theme/change` and push scheme.
- Modify: `packages/client/ui-xmart-workbench/tests/apply.client.spec.ts` — `getTheme` mock + overlay call.
- Modify: `packages/client/ui-primitives/src/markdown/MarkdownText.module.css` — link + file-mention color.
- Create: `packages/client/ui-primitives/tests/markdown-link-css.client.spec.ts`
- Modify: `apps/desktop/src/title-bar.ts` — light/dark overlay pairs.
- Modify: `apps/desktop/tests/title-bar.spec.ts`
- Modify: `apps/desktop/src/ipc-protocol.ts` — channel + `setTitleBarOverlay`.
- Modify: `apps/desktop/src/preload.ts` and `apps/desktop/preload.mjs` — both; Electron loads `preload.mjs`.
- Modify: `apps/desktop/src/shell.ts` — initial scheme + IPC listener.
- Modify: `apps/desktop/tests/renderer-boot.spec.ts` — preload still CommonJS and exposes the new method.
- Modify: `FORK-PATCHES.md` — L3 entries 57 and 58.
- Modify: workbench README pair + desktop README pair (IPC list).
- Move/rewrite: Agent Note proposed → implemented when the code ships.

---

### Task 1: Neutral canvas token overlay

**Files:**
- Modify: `packages/client/ui-xmart-workbench/tests/brand-accent.client.spec.ts`
- Modify: `packages/client/ui-xmart-workbench/src/client/brand-accent.ts`

**Interfaces:**
- Consumes: existing `ThemeTokenOverrides` (`{ light: string; dark: string }` per token).
- Produces: `XMART_ACCENT_TOKENS` with the spec tables; new canvas constants below.

- [ ] **Step 1: Write the failing assertions**

Replace `brand-accent.client.spec.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import {
  XMART_ACCENT_TOKENS, XMART_CANVAS_DARK, XMART_CANVAS_LIGHT, XMART_CHROME_DARK,
  XMART_CHROME_LIGHT, XMART_GREEN, XMART_GREEN_INK, XMART_GREEN_SHIMMER,
  XMART_LAYER_1_DARK, XMART_LAYER_2_DARK, XMART_LAYER_3_DARK, XMART_SELECTED_DARK,
  XMART_SELECTED_LIGHT,
} from '../src/client/brand-accent.ts'

describe('xmart brand accent tokens', () => {
  it('keeps 万物智汇 green on chrome accents', () => {
    expect(XMART_GREEN).toBe('#5BB73B')
    expect(XMART_GREEN_INK).toBe('#3D8C28')
    expect(XMART_ACCENT_TOKENS['--dsw-alias-state-business-primary']).toEqual({
      light: XMART_GREEN_INK, dark: XMART_GREEN,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-alias-button-info-fill']).toEqual({
      light: XMART_GREEN, dark: XMART_GREEN,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-alias-button-info-hover']).toEqual({
      light: '#4A9C32', dark: '#6BC84A',
    })
    expect(XMART_ACCENT_TOKENS['--dsw-alias-brand-primary-new-colorprimary-new-color']).toEqual({
      light: XMART_GREEN_INK, dark: XMART_GREEN,
    })
  })

  it('remaps the static DeepSeek steps the conversation shimmer still binds', () => {
    expect(XMART_ACCENT_TOKENS['--dsw-static-deepseek-500']).toEqual({
      light: XMART_GREEN_INK, dark: XMART_GREEN,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-static-deepseek-200']).toEqual({
      light: XMART_GREEN_SHIMMER, dark: XMART_GREEN_SHIMMER,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-static-deepseek-450']).toEqual({
      light: XMART_GREEN_INK, dark: XMART_GREEN,
    })
    expect(XMART_GREEN_SHIMMER).toBe('#CDE9C4')
  })

  it('neutralizes canvas, chrome, washes, and bubbles', () => {
    expect(XMART_ACCENT_TOKENS['--dsw-alias-bg-base']).toEqual({
      light: XMART_CANVAS_LIGHT, dark: XMART_CANVAS_DARK,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-alias-bg-layer-1']).toEqual({
      light: XMART_CANVAS_LIGHT, dark: XMART_LAYER_1_DARK,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-alias-bg-layer-2']).toEqual({
      light: XMART_CANVAS_LIGHT, dark: XMART_LAYER_2_DARK,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-alias-bg-layer-3']).toEqual({
      light: XMART_CANVAS_LIGHT, dark: XMART_LAYER_3_DARK,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-specific-sidebar-fill']).toEqual({
      light: XMART_CHROME_LIGHT, dark: XMART_CHROME_DARK,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-alias-state-business-tertiary']).toEqual({
      light: XMART_SELECTED_LIGHT, dark: XMART_SELECTED_DARK,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-specific-sidebar-nav-item-active-accent']).toEqual({
      light: XMART_SELECTED_LIGHT, dark: XMART_SELECTED_DARK,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-specific-bubble']).toEqual({
      light: XMART_CHROME_LIGHT, dark: XMART_LAYER_1_DARK,
    })
    expect(XMART_ACCENT_TOKENS['--dsw-specific-bubble-highlight']).toEqual({
      light: XMART_SELECTED_LIGHT, dark: XMART_SELECTED_DARK,
    })
    expect(XMART_CANVAS_DARK).toBe('#181818')
    expect(XMART_CHROME_DARK).toBe('#141414')
    expect(XMART_LAYER_1_DARK).toBe('#1F1F1F')
    expect(XMART_LAYER_2_DARK).toBe('#262626')
    expect(XMART_LAYER_3_DARK).toBe('#2C2C2C')
    expect(XMART_SELECTED_DARK).toBe('#2A2A2A')
    expect(XMART_CANVAS_LIGHT).toBe('#FFFFFF')
    expect(XMART_CHROME_LIGHT).toBe('#F5F5F5')
    expect(XMART_SELECTED_LIGHT).toBe('#EBEBEB')
  })

  it('does not override success, error, or warn state tokens', () => {
    const names = Object.keys(XMART_ACCENT_TOKENS)
    expect(names.some(name => name.includes('success'))).toBe(false)
    expect(names.some(name => name.includes('error'))).toBe(false)
    expect(names.some(name => name.includes('warn'))).toBe(false)
  })

  it('exports only hex pairs', () => {
    for (const pair of Object.values(XMART_ACCENT_TOKENS)) {
      expect(pair.light).toMatch(/^#[0-9A-F]{6}$/i)
      expect(pair.dark).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run (from `deepseek-harness/`):

```powershell
pnpm exec vitest run packages/client/ui-xmart-workbench/tests/brand-accent.client.spec.ts
```

Expected: FAIL — missing exports (`XMART_CANVAS_DARK`, canvas tokens).

- [ ] **Step 3: Implement the token map**

Replace `brand-accent.ts` with:

```ts
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'

/** 万物智汇 mark green, sampled from default-logo.png (same as ui-primitives x-mark). */
export const XMART_GREEN = '#5BB73B'

/** Darker ink for light-mode text, tabs, and links (contrast on white). */
export const XMART_GREEN_INK = '#3D8C28'

/** Hover on a filled brand control in light mode. */
export const XMART_GREEN_HOVER_LIGHT = '#4A9C32'

/** Hover on a filled brand control in dark mode. */
export const XMART_GREEN_HOVER_DARK = '#6BC84A'

/** Pale mint sweep on the running-status shimmer (same role as deepseek-200). */
export const XMART_GREEN_SHIMMER = '#CDE9C4'

export const XMART_CANVAS_LIGHT = '#FFFFFF'
export const XMART_CANVAS_DARK = '#181818'
export const XMART_CHROME_LIGHT = '#F5F5F5'
export const XMART_CHROME_DARK = '#141414'
export const XMART_LAYER_1_DARK = '#1F1F1F'
export const XMART_LAYER_2_DARK = '#262626'
export const XMART_LAYER_3_DARK = '#2C2C2C'
export const XMART_SELECTED_LIGHT = '#EBEBEB'
export const XMART_SELECTED_DARK = '#2A2A2A'

/**
 * Brand overlay: green stays on chrome accents; canvas / washes / bubbles
 * are true neutrals. Success / error / warn stay untouched. Chart series
 * that bind `--dsw-static-blue-*` stay blue.
 */
export const XMART_ACCENT_TOKENS: ThemeTokenOverrides = {
  '--dsw-alias-state-business-primary': { light: XMART_GREEN_INK, dark: XMART_GREEN },
  '--dsw-alias-button-info-fill': { light: XMART_GREEN, dark: XMART_GREEN },
  '--dsw-alias-button-info-hover': { light: XMART_GREEN_HOVER_LIGHT, dark: XMART_GREEN_HOVER_DARK },
  '--dsw-alias-brand-primary-new-colorprimary-new-color': { light: XMART_GREEN_INK, dark: XMART_GREEN },
  '--dsw-static-deepseek-200': { light: XMART_GREEN_SHIMMER, dark: XMART_GREEN_SHIMMER },
  '--dsw-static-deepseek-450': { light: XMART_GREEN_INK, dark: XMART_GREEN },
  '--dsw-static-deepseek-500': { light: XMART_GREEN_INK, dark: XMART_GREEN },
  '--dsw-alias-bg-base': { light: XMART_CANVAS_LIGHT, dark: XMART_CANVAS_DARK },
  '--dsw-alias-bg-layer-1': { light: XMART_CANVAS_LIGHT, dark: XMART_LAYER_1_DARK },
  '--dsw-alias-bg-layer-2': { light: XMART_CANVAS_LIGHT, dark: XMART_LAYER_2_DARK },
  '--dsw-alias-bg-layer-3': { light: XMART_CANVAS_LIGHT, dark: XMART_LAYER_3_DARK },
  '--dsw-specific-sidebar-fill': { light: XMART_CHROME_LIGHT, dark: XMART_CHROME_DARK },
  '--dsw-alias-state-business-tertiary': { light: XMART_SELECTED_LIGHT, dark: XMART_SELECTED_DARK },
  '--dsw-specific-sidebar-nav-item-active-accent': { light: XMART_SELECTED_LIGHT, dark: XMART_SELECTED_DARK },
  '--dsw-specific-bubble': { light: XMART_CHROME_LIGHT, dark: XMART_LAYER_1_DARK },
  '--dsw-specific-bubble-highlight': { light: XMART_SELECTED_LIGHT, dark: XMART_SELECTED_DARK },
}
```

- [ ] **Step 4: Re-run the test**

```powershell
pnpm exec vitest run packages/client/ui-xmart-workbench/tests/brand-accent.client.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit only if the user asked**

```
feat: 中性画布 token，绿只留在控件上
```

---

### Task 2: Markdown links use body text

**Files:**
- Create: `packages/client/ui-primitives/tests/markdown-link-css.client.spec.ts`
- Modify: `packages/client/ui-primitives/src/markdown/MarkdownText.module.css` (`.markdown a`, hover/focus, focus-visible, `.fileMention`)
- Modify: `FORK-PATCHES.md` (new uncommitted row 57)

**Interfaces:**
- Consumes: `--dsw-alias-label-primary` (already in the theme sheet).
- Produces: anchors and file mentions no longer consume `state-business-primary`.

`.fileMention` is documented in the same sheet as “the same link language this sheet gives anchors”. Change it in this task so @file chips do not stay green after anchors go neutral.

- [ ] **Step 1: Write the failing CSS contract**

```ts
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/markdown/MarkdownText.module.css'),
  'utf8',
)

describe('markdown link chrome', () => {
  it('binds anchors and file mentions to body text, not business-primary', () => {
    expect(css).toMatch(/\.markdown a \{[\s\S]*color:\s*var\(--dsw-alias-label-primary\)/)
    expect(css).toMatch(
      /\.markdown a:hover,[\s\S]*text-decoration:\s*underline var\(--dsw-alias-label-primary\)/,
    )
    expect(css).toMatch(/\.fileMention \{[\s\S]*color:\s*var\(--dsw-alias-label-primary\)/)
    expect(css).not.toMatch(/\.markdown a \{[\s\S]*--dsw-alias-state-business-primary/)
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```powershell
pnpm exec vitest run packages/client/ui-primitives/tests/markdown-link-css.client.spec.ts
```

Expected: FAIL — CSS still binds `state-business-primary`.

- [ ] **Step 3: Change the four color bindings**

In `MarkdownText.module.css`:

- `.markdown a` `color` → `var(--dsw-alias-label-primary)`
- `.markdown a:hover, .markdown a:focus` underline → `var(--dsw-alias-label-primary)`
- `.markdown a:focus-visible` box-shadow → `var(--dsw-alias-label-primary)`
- `.fileMention` `color` and its hover underline → `var(--dsw-alias-label-primary)`

Leave the comment above `.markdown a` updated to say links use label-primary so brand-primary / business-primary can stay the chrome accent.

- [ ] **Step 4: Re-run the test**

```powershell
pnpm exec vitest run packages/client/ui-primitives/tests/markdown-link-css.client.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Register L3 in `FORK-PATCHES.md`**

Add under 未提交:

| 57 | markdown 链接改绑正文色 | 链接和发送/页签抢 `state-business-primary`。绿只当点缀必须拆开，L2 换不了这颗 CSS | `packages/client/ui-primitives/src/markdown/MarkdownText.module.css` + CSS 合同测试 | |

- [ ] **Step 6: Commit only if the user asked**

```
fix: markdown 链接改绑正文色，绿留给控件
```

---

### Task 3: Desktop overlay color pairs

**Files:**
- Modify: `apps/desktop/tests/title-bar.spec.ts`
- Modify: `apps/desktop/src/title-bar.ts`
- Modify: `apps/desktop/src/shell.ts` (constructor overlay only; IPC is Task 4)

**Interfaces:**
- Produces:
  - `export type TitleBarColorScheme = 'light' | 'dark'`
  - `export function desktopTitleBarOverlay(scheme: TitleBarColorScheme): { color: string; symbolColor: string; height: number }`
  - `export function resolveInitialTitleBarScheme(shouldUseDarkColors: boolean): TitleBarColorScheme`
  - `export function desktopTitleBarChrome(scheme: TitleBarColorScheme): { titleBarStyle: 'hidden'; titleBarOverlay: ReturnType<typeof desktopTitleBarOverlay> }`
- Delete the single `DESKTOP_TITLE_BAR_OVERLAY` constant (or stop exporting it). Every caller must pass a scheme.

- [ ] **Step 1: Write the failing title-bar tests**

Replace `title-bar.spec.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import {
  applyDesktopTitleBarOverlay, DESKTOP_TITLE_BAR_HEIGHT, desktopSecondInstanceAction,
  desktopTitleBarChrome, desktopTitleBarOverlay, resolveInitialTitleBarScheme,
} from '../src/title-bar.ts'

describe('applyDesktopTitleBarOverlay', () => {
  it('applies hidden title plus caption overlay for the chat toggle', () => {
    expect(applyDesktopTitleBarOverlay()).toBe(true)
  })
})

describe('desktopTitleBarOverlay', () => {
  it('uses the locked light and dark chrome pairs', () => {
    expect(desktopTitleBarOverlay('dark')).toEqual({
      color: '#141414',
      symbolColor: '#C8C8C8',
      height: DESKTOP_TITLE_BAR_HEIGHT,
    })
    expect(desktopTitleBarOverlay('light')).toEqual({
      color: '#F5F5F5',
      symbolColor: '#333333',
      height: DESKTOP_TITLE_BAR_HEIGHT,
    })
  })
})

describe('resolveInitialTitleBarScheme', () => {
  it('maps the OS dark flag to a scheme', () => {
    expect(resolveInitialTitleBarScheme(true)).toBe('dark')
    expect(resolveInitialTitleBarScheme(false)).toBe('light')
  })
})

describe('desktopTitleBarChrome', () => {
  it('hides the title bar and keeps a 32px caption overlay', () => {
    expect(desktopTitleBarChrome('light')).toEqual({
      titleBarStyle: 'hidden',
      titleBarOverlay: desktopTitleBarOverlay('light'),
    })
    expect(DESKTOP_TITLE_BAR_HEIGHT).toBe(32)
  })
})

describe('desktopSecondInstanceAction', () => {
  it('relaunches unpackaged so a rebuilt main is loaded', () => {
    expect(desktopSecondInstanceAction(false)).toBe('relaunch')
    expect(desktopSecondInstanceAction(true)).toBe('focus')
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```powershell
pnpm exec vitest run apps/desktop/tests/title-bar.spec.ts
```

Expected: FAIL — missing `desktopTitleBarOverlay` / old `#151517` constant.

- [ ] **Step 3: Implement the pairs**

`title-bar.ts` becomes:

```ts
/**
 * Desktop window chrome: hidden title bar plus Windows/Linux caption-button
 * overlay so the renderer can sit a chat toggle next to Minimize.
 * @module @deepseek-ai/dsh-desktop/title-bar
 */

export const DESKTOP_TITLE_BAR_HEIGHT = 32

export type TitleBarColorScheme = 'light' | 'dark'

export function desktopTitleBarOverlay(scheme: TitleBarColorScheme): {
  color: string
  symbolColor: string
  height: number
} {
  return scheme === 'light'
    ? { color: '#F5F5F5', symbolColor: '#333333', height: DESKTOP_TITLE_BAR_HEIGHT }
    : { color: '#141414', symbolColor: '#C8C8C8', height: DESKTOP_TITLE_BAR_HEIGHT }
}

export function resolveInitialTitleBarScheme(shouldUseDarkColors: boolean): TitleBarColorScheme {
  return shouldUseDarkColors ? 'dark' : 'light'
}

export function applyDesktopTitleBarOverlay(): boolean {
  return true
}

export function desktopSecondInstanceAction(packaged: boolean): 'relaunch' | 'focus' {
  return packaged ? 'focus' : 'relaunch'
}

export function desktopTitleBarChrome(scheme: TitleBarColorScheme): {
  titleBarStyle: 'hidden'
  titleBarOverlay: ReturnType<typeof desktopTitleBarOverlay>
} {
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: desktopTitleBarOverlay(scheme),
  }
}
```

In `shell.ts`:

- Import `nativeTheme` from `electron` (add to the existing electron import).
- Import `desktopTitleBarOverlay`, `resolveInitialTitleBarScheme` instead of `DESKTOP_TITLE_BAR_OVERLAY`.
- Before `windowOptions`:

```ts
const titleBarScheme = resolveInitialTitleBarScheme(nativeTheme.shouldUseDarkColors)
```

- `desktopTitleBarChrome()` → `desktopTitleBarChrome(titleBarScheme)`
- `win.setTitleBarOverlay(DESKTOP_TITLE_BAR_OVERLAY)` → `win.setTitleBarOverlay(desktopTitleBarOverlay(titleBarScheme))`

- [ ] **Step 4: Re-run the test**

```powershell
pnpm exec vitest run apps/desktop/tests/title-bar.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit only if the user asked**

```
fix: 系统按钮 overlay 拆成浅/深两套
```

---

### Task 4: Preload IPC for overlay updates

**Files:**
- Modify: `apps/desktop/src/ipc-protocol.ts`
- Modify: `apps/desktop/src/preload.ts`
- Modify: `apps/desktop/preload.mjs` (this is what Electron loads)
- Modify: `apps/desktop/src/shell.ts`
- Modify: `apps/desktop/tests/renderer-boot.spec.ts`
- Modify: `FORK-PATCHES.md` (row 58)

**Interfaces:**
- Consumes: `desktopTitleBarOverlay(scheme)` from Task 3.
- Produces:
  - `export const DSH_TITLE_BAR_OVERLAY_CHANNEL = 'dsh:title-bar-overlay'`
  - `DshIpcBridge.setTitleBarOverlay(colorScheme: TitleBarColorScheme): void`
  - Main: `ipcMain.on` → `win.setTitleBarOverlay(desktopTitleBarOverlay(scheme))` after checking `scheme === 'light' || scheme === 'dark'` and `!win.isDestroyed()`.

- [ ] **Step 1: Extend the renderer-boot contract so it fails**

In `renderer-boot.spec.ts`, after the existing CommonJS assertions, add:

```ts
expect(preload).toContain("dsh:title-bar-overlay")
expect(preload).toContain('setTitleBarOverlay')
```

- [ ] **Step 2: Run and confirm fail**

```powershell
pnpm exec vitest run apps/desktop/tests/renderer-boot.spec.ts
```

Expected: FAIL — `preload.mjs` has no overlay channel.

- [ ] **Step 3: Wire protocol, both preloads, and main**

`ipc-protocol.ts` — add next to the other channel constants:

```ts
/** Renderer → main: follow the resolved light/dark caption overlay. */
export const DSH_TITLE_BAR_OVERLAY_CHANNEL = 'dsh:title-bar-overlay' as const
```

Import `TitleBarColorScheme` from `./title-bar.ts` in `ipc-protocol.ts` **or** re-export the union from ipc-protocol as `'light' | 'dark'` to avoid a cycle. Prefer the literal union on the bridge (title-bar already owns the name):

```ts
setTitleBarOverlay(colorScheme: 'light' | 'dark'): void
```

on `DshIpcBridge`.

`preload.ts` — import the channel; add to `bridge`:

```ts
setTitleBarOverlay(colorScheme) {
  ipcRenderer.send(DSH_TITLE_BAR_OVERLAY_CHANNEL, colorScheme)
},
```

`preload.mjs` — add `const DSH_TITLE_BAR_OVERLAY_CHANNEL = 'dsh:title-bar-overlay'` and the same method on the exposed object. Keep CommonJS (`require('electron')`). Do not add `import`.

`shell.ts`:

- Import `DSH_TITLE_BAR_OVERLAY_CHANNEL`.
- After `const win = new BrowserWindow(...)` and the first `setTitleBarOverlay`, register:

```ts
const onTitleBarOverlay = (_event: Electron.IpcMainEvent, scheme: unknown): void => {
  if (scheme !== 'light' && scheme !== 'dark') return
  if (win.isDestroyed()) return
  win.setTitleBarOverlay(desktopTitleBarOverlay(scheme))
}
ipcMain.on(DSH_TITLE_BAR_OVERLAY_CHANNEL, onTitleBarOverlay)
```

- On window close / shell dispose (same place `ipcMain.removeHandler(DSH_FETCH_CHANNEL)` already runs), also `ipcMain.removeListener(DSH_TITLE_BAR_OVERLAY_CHANNEL, onTitleBarOverlay)`.

- [ ] **Step 4: Re-run renderer-boot and title-bar tests**

```powershell
pnpm exec vitest run apps/desktop/tests/renderer-boot.spec.ts apps/desktop/tests/title-bar.spec.ts
```

Expected: PASS.

- [ ] **Step 5: FORK-PATCHES row 58**

| 58 | 系统按钮 overlay 跟随主题 | L2 画不到 Windows caption。必须改 desktop `titleBarOverlay` + preload IPC | `apps/desktop/src/{title-bar,ipc-protocol,preload,shell}.ts`、`preload.mjs`、对应测试 | |

- [ ] **Step 6: Commit only if the user asked**

```
fix: 切浅/深时系统按钮 overlay 跟着变
```

---

### Task 5: Workbench pushes the resolved scheme

**Files:**
- Create: `packages/client/ui-xmart-workbench/src/client/title-bar-sync.ts`
- Create: `packages/client/ui-xmart-workbench/tests/title-bar-sync.client.spec.ts`
- Modify: `packages/client/ui-xmart-workbench/src/client/index.ts`
- Modify: `packages/client/ui-xmart-workbench/tests/apply.client.spec.ts`

**Interfaces:**
- Consumes: `window.__DSH_IPC__.setTitleBarOverlay` from Task 4 (duck-typed; web has no IPC).
- Produces:
  - `export type TitleBarOverlayBridge = { setTitleBarOverlay(colorScheme: 'light' | 'dark'): void }`
  - `export function desktopIpcTitleBar(globalThisLike?: { __DSH_IPC__?: TitleBarOverlayBridge }): TitleBarOverlayBridge | undefined`
  - `export function syncTitleBarOverlay(scheme: 'light' | 'dark', ipc?: TitleBarOverlayBridge): void`

- [ ] **Step 1: Write failing helper tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import { desktopIpcTitleBar, syncTitleBarOverlay } from '../src/client/title-bar-sync.ts'

describe('syncTitleBarOverlay', () => {
  it('no-ops when the desktop bridge is missing', () => {
    expect(() => syncTitleBarOverlay('light', undefined)).not.toThrow()
    expect(desktopIpcTitleBar({})).toBeUndefined()
  })

  it('pushes the resolved scheme when the bridge exists', () => {
    const setTitleBarOverlay = vi.fn()
    syncTitleBarOverlay('dark', { setTitleBarOverlay })
    expect(setTitleBarOverlay).toHaveBeenCalledWith('dark')
  })

  it('ignores a bridge that has no setTitleBarOverlay', () => {
    expect(desktopIpcTitleBar({ __DSH_IPC__: {} as never })).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run and confirm fail**

```powershell
pnpm exec vitest run packages/client/ui-xmart-workbench/tests/title-bar-sync.client.spec.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement the helper**

```ts
export type TitleBarOverlayBridge = {
  setTitleBarOverlay(colorScheme: 'light' | 'dark'): void
}

type DesktopIpcGlobal = { __DSH_IPC__?: TitleBarOverlayBridge }

export function desktopIpcTitleBar(
  globalThisLike: DesktopIpcGlobal = globalThis as DesktopIpcGlobal,
): TitleBarOverlayBridge | undefined {
  const ipc = globalThisLike.__DSH_IPC__
  if (ipc === undefined || typeof ipc.setTitleBarOverlay !== 'function') return undefined
  return ipc
}

export function syncTitleBarOverlay(
  scheme: 'light' | 'dark',
  ipc: TitleBarOverlayBridge | undefined = desktopIpcTitleBar(),
): void {
  ipc?.setTitleBarOverlay(scheme)
}
```

- [ ] **Step 4: Helper tests pass**

```powershell
pnpm exec vitest run packages/client/ui-xmart-workbench/tests/title-bar-sync.client.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Update the apply bench, then wire `apply`**

In `apply.client.spec.ts` `bench()`, change the theme provide to:

```ts
const getTheme = vi.fn(() => ({
  preference: 'light' as const,
  active: { id: 'light', colorScheme: 'light' as const, tokens: {} },
  themes: [],
  revision: 1,
}))
ctx.provide('theme', { overrideTokens, getTheme })
```

Return `getTheme` from `bench()`.

Add a test:

```ts
it('pushes the resolved scheme to the desktop caption overlay', async () => {
  const setTitleBarOverlay = vi.fn()
  const g = globalThis as { __DSH_IPC__?: { setTitleBarOverlay: typeof setTitleBarOverlay } }
  const previous = g.__DSH_IPC__
  g.__DSH_IPC__ = { setTitleBarOverlay }
  const b = await bench()
  declare(b.slots)
  await b.ctx.plugin({ inject: [...inject], apply }).await()
  expect(setTitleBarOverlay).toHaveBeenCalledWith('light')
  b.ctx.emit('theme/change', {
    preference: 'dark',
    active: { id: 'dark', colorScheme: 'dark', tokens: {} },
    themes: [],
    revision: 2,
  })
  expect(setTitleBarOverlay).toHaveBeenCalledWith('dark')
  await b.ctx.close()
  if (previous === undefined) delete g.__DSH_IPC__
  else g.__DSH_IPC__ = previous
})
```

In `index.ts`, import `syncTitleBarOverlay` and add this effect next to the existing `overrideTokens` effect:

```ts
ctx.effect(() => {
  const push = (snapshot: { active: { colorScheme: 'light' | 'dark' } }): void => {
    syncTitleBarOverlay(snapshot.active.colorScheme)
  }
  push(ctx.theme.getTheme())
  return ctx.on('theme/change', push)
}, 'ui-xmart-workbench: title-bar overlay')
```

- [ ] **Step 6: Run apply + helper tests**

```powershell
pnpm exec vitest run packages/client/ui-xmart-workbench/tests/title-bar-sync.client.spec.ts packages/client/ui-xmart-workbench/tests/apply.client.spec.ts
```

Expected: PASS. If existing apply tests fail on `getTheme is not a function`, the bench mock from Step 5 is missing.

- [ ] **Step 7: Commit only if the user asked**

```
feat: 工作台把主题方案推给系统按钮 overlay
```

---

### Task 6: Docs, Agent Note lifecycle, rebuild

**Files:**
- Modify: `packages/client/ui-xmart-workbench/README.md` and `README.zh.md` — the `apply` / `overrideTokens` sentence currently says markdown links turn green. Change it to: green on tabs / send / focus / shimmer; canvas and washes neutralized; markdown links stay on body text.
- Modify: `apps/desktop/README.md` and `README.zh.md` — `__DSH_IPC__` list gains `setTitleBarOverlay`.
- Modify: `.agents/notes/implemented/feature/2026-08-16-xmart-conversation-chrome.md` (+ `.zh.md`) — Consequences no longer claim markdown links turn green; point at this note.
- Move `.agents/notes/proposed/feature/2026-08-17-xmart-neutral-chrome.md` (+ zh + i18n) to `implemented/feature/`, rewrite `Status: implemented`, `## Proposal` → `## Decision` (present tense), fold Acceptance/Risks into `## Consequences` / `## Testing`. Re-record the pairing with `pnpm run verify-translation-pairing --write`.
- Re-record every edited README pair the same way.

- [ ] **Step 1: Edit the four README sentences and the conversation-chrome Consequences**

Workbench English (the `apply` sentence): drop “markdown links” from the green list; add that `bg-base` / `sidebar-fill` / washes become the locked neutrals and that markdown anchors use `label-primary`.

Desktop English: `fetch + subscribeFetchStream + abortFetch + loadBundle + onAppMenu + setTitleBarOverlay`.

Mirror structure in the Chinese counterparts.

- [ ] **Step 2: Promote the Agent Note**

Required heading swap for `implemented/`:

```
## Problem
## Decision
## Palette
## Token overlay
## Markdown links
## Desktop caption overlay
## Alternatives considered
## Consequences
```

No `## Proposal`, `## Acceptance criteria`, or `## Risks` headings.

- [ ] **Step 3: Re-record pairings**

```powershell
pnpm run verify-translation-pairing --write .agents/notes/implemented/feature/2026-08-17-xmart-neutral-chrome.md
pnpm run verify-translation-pairing --write .agents/notes/implemented/feature/2026-08-16-xmart-conversation-chrome.md
pnpm run verify-translation-pairing --write packages/client/ui-xmart-workbench/README.md
pnpm run verify-translation-pairing --write apps/desktop/README.md
```

- [ ] **Step 4: Rebuild what the desktop loads**

```powershell
pnpm --filter @deepseek-ai/dsh-client-ui-xmart-workbench run build
pnpm --filter @deepseek-ai/dsh-client-ui-primitives run build
pnpm --filter @deepseek-ai/dsh-desktop run bundle
```

Confirm `packages/client/ui-xmart-workbench/lib/client.js` contains `#181818` and `setTitleBarOverlay`. Confirm `apps/desktop/lib/title-bar.js` contains `#F5F5F5`.

- [ ] **Step 5: Tell the user to fully quit and run `pnpm dsh desktop`**

Hand-check: dark canvas is charcoal; light caption buttons are not a black island; switching Appearance updates them; conversation links are body-colored.

- [ ] **Step 6: Commit only if the user asked**

```
docs: 中性铬方案落地并登记 L3
```

---

## Self-review

1. Spec coverage: green roles → Task 1; canvas hex tables → Task 1; markdown body links → Task 2; caption pairs + IPC + workbench push → Tasks 3–5; no `design-platform.css` → Global Constraints; Agent rebuild → Task 6; FORK-PATCHES → Tasks 2 and 4.
2. Placeholders: none.
3. Types: `TitleBarColorScheme` / `'light' | 'dark'` is the same union on title-bar, IPC, and `syncTitleBarOverlay`. Channel name is `dsh:title-bar-overlay` in protocol, both preloads, and shell.
