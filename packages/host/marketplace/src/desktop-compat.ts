/**
 * Decide whether a DSH plugin can run on the desktop profile (no webserver).
 */
import type { CatalogPluginRow } from './catalog-snapshot.ts'

const NAME_BLOCK = /better-sidebar|dsh-market|webui-market|plugin-market|plugin-hub/i
const PATCH_BLOCK = /webserver|websocket|\/ws\/|ws\/terminal/i

export type DesktopCompat = { readonly ok: true } | { readonly ok: false; readonly reason: string }

/**
 * Classify a catalog row before install. Name/description heuristics first;
 * a fetched patch body can be passed as `patchText`.
 * @param row - catalog row.
 * @param patchText - optional cordis.patch.yml text.
 */
export function desktopCompatibility(row: CatalogPluginRow, patchText?: string): DesktopCompat {
  if (NAME_BLOCK.test(row.name) || NAME_BLOCK.test(row.url)) {
    return { ok: false, reason: 'desktop-http' }
  }
  const blob = `${row.description.en} ${row.description.zh}`
  if (PATCH_BLOCK.test(blob)) {
    return { ok: false, reason: 'desktop-http' }
  }
  if (patchText !== undefined && PATCH_BLOCK.test(patchText)) {
    return { ok: false, reason: 'desktop-http' }
  }
  return { ok: true }
}

/**
 * Scan a patch or README blob for webserver / WebSocket host halves.
 * @param text - file text.
 */
export function patchNeedsWebserver(text: string): boolean {
  return PATCH_BLOCK.test(text)
}
