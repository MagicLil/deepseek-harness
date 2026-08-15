/**
 * Persist and restore the desktop BrowserWindow bounds under `$DSH_HOME`.
 * Display clamping stays Electron-free so the helpers can be unit-tested.
 * @module @deepseek-ai/dsh-desktop/window-state
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'

/** Default first-launch size. */
export const DEFAULT_WINDOW_WIDTH = 1280
/** Default first-launch height. */
export const DEFAULT_WINDOW_HEIGHT = 840

/** Saved window geometry. */
export interface DesktopWindowState {
  x: number
  y: number
  width: number
  height: number
  isMaximized: boolean
}

/** One display's work area (taskbar excluded), in screen coordinates. */
export interface DisplayWorkArea {
  x: number
  y: number
  width: number
  height: number
}

/** Path of the persisted window-state file. */
export function windowStatePath(): string {
  return dshHomePath('desktop-window.json')
}

/**
 * Parse a JSON value into a window state, or `undefined` when unusable.
 * @param raw - decoded JSON.
 */
export function parseWindowState(raw: unknown): DesktopWindowState | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const record = raw as Record<string, unknown>
  if (
    typeof record.x !== 'number' || typeof record.y !== 'number'
    || typeof record.width !== 'number' || typeof record.height !== 'number'
    || !Number.isFinite(record.x) || !Number.isFinite(record.y)
    || !Number.isFinite(record.width) || !Number.isFinite(record.height)
  ) {
    return undefined
  }
  if (record.width < 400 || record.height < 300) return undefined
  return {
    x: Math.round(record.x),
    y: Math.round(record.y),
    width: Math.round(record.width),
    height: Math.round(record.height),
    isMaximized: record.isMaximized === true,
  }
}

/**
 * Keep the window on a visible work area after a monitor layout change.
 * @param state - candidate bounds.
 * @param workAreas - current displays' work areas.
 */
export function clampWindowState(
  state: DesktopWindowState,
  workAreas: readonly DisplayWorkArea[],
): DesktopWindowState {
  if (workAreas.length === 0) return state
  const overlapping = workAreas.find(area => intersects(state, area))
  if (overlapping !== undefined) {
    return {
      ...state,
      width: Math.min(state.width, overlapping.width),
      height: Math.min(state.height, overlapping.height),
    }
  }
  const primary = workAreas[0]
  if (primary === undefined) return state
  return {
    x: primary.x + Math.max(0, Math.floor((primary.width - state.width) / 2)),
    y: primary.y + Math.max(0, Math.floor((primary.height - state.height) / 2)),
    width: Math.min(state.width, primary.width),
    height: Math.min(state.height, primary.height),
    isMaximized: false,
  }
}

/**
 * Load the last saved window state, if any.
 * @returns parsed state, or `undefined` when missing/corrupt.
 */
export function loadWindowState(): DesktopWindowState | undefined {
  try {
    return parseWindowState(JSON.parse(readFileSync(windowStatePath(), 'utf8')))
  } catch {
    return undefined
  }
}

/**
 * Write window state to `$DSH_HOME/desktop-window.json`.
 * @param state - bounds to persist.
 */
export function saveWindowState(state: DesktopWindowState): void {
  const path = windowStatePath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(state)}\n`, 'utf8')
}

function intersects(state: DesktopWindowState, area: DisplayWorkArea): boolean {
  return state.x < area.x + area.width
    && state.x + state.width > area.x
    && state.y < area.y + area.height
    && state.y + state.height > area.y
}
