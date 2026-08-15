/**
 * Small desktop-shell preferences under `$DSH_HOME`.
 * @module @deepseek-ai/dsh-desktop/desktop-prefs
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'

/** Persisted desktop-shell flags. */
export interface DesktopPrefs {
  /** True after the first close-to-tray toast has been shown. */
  closeToTrayHintShown: boolean
}

/** Path of the prefs file. */
export function desktopPrefsPath(): string {
  return dshHomePath('desktop-prefs.json')
}

/**
 * Parse prefs JSON, filling defaults for missing keys.
 * @param raw - decoded JSON.
 */
export function parseDesktopPrefs(raw: unknown): DesktopPrefs {
  if (raw === null || typeof raw !== 'object') return { closeToTrayHintShown: false }
  const record = raw as Record<string, unknown>
  return { closeToTrayHintShown: record.closeToTrayHintShown === true }
}

/** Load prefs, or defaults when the file is missing/corrupt. */
export function loadDesktopPrefs(): DesktopPrefs {
  try {
    return parseDesktopPrefs(JSON.parse(readFileSync(desktopPrefsPath(), 'utf8')))
  } catch {
    return { closeToTrayHintShown: false }
  }
}

/**
 * Write prefs to `$DSH_HOME/desktop-prefs.json`.
 * @param prefs - flags to persist.
 */
export function saveDesktopPrefs(prefs: DesktopPrefs): void {
  const path = desktopPrefsPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(prefs)}\n`, 'utf8')
}

/**
 * Whether this close should show the one-time tray hint.
 * Marks the hint as shown when it returns true.
 */
export function consumeCloseToTrayHint(): boolean {
  const prefs = loadDesktopPrefs()
  if (prefs.closeToTrayHintShown) return false
  saveDesktopPrefs({ ...prefs, closeToTrayHintShown: true })
  return true
}
