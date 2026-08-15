/**
 * Open VSX search + download helpers. Microsoft Marketplace is never used.
 */
import { classifyVsix, vsixId } from './vsix-compat.ts'
import type { VsixCard } from './types.ts'

const SEARCH = 'https://open-vsx.org/api/-/search'

/** One Open VSX search hit (subset). */
export interface OpenVsxHit {
  readonly namespace: string
  readonly name: string
  readonly displayName?: string
  readonly description?: string
  readonly verified?: boolean
  readonly version?: string
  readonly files?: { readonly download?: string }
}

/**
 * Map an Open VSX hit to a card.
 * @param hit - API row.
 * @param installed - ids already on disk.
 */
export function cardFromOpenVsx(hit: OpenVsxHit, installed: ReadonlySet<string>): VsixCard {
  const id = vsixId(hit.namespace, hit.name)
  return {
    id,
    displayName: hit.displayName ?? hit.name,
    publisher: hit.namespace,
    description: hit.description ?? '',
    verified: hit.verified === true,
    installed: installed.has(id),
    compatibility: classifyVsix(id),
    ...hit.version === undefined ? {} : { version: hit.version },
    ...hit.files?.download === undefined ? {} : { downloadUrl: hit.files.download },
  }
}

/**
 * Parse the Open VSX search JSON.
 * @param raw - parsed body.
 */
export function parseOpenVsxSearch(raw: unknown): OpenVsxHit[] {
  if (raw === null || typeof raw !== 'object') return []
  const extensions = (raw as { extensions?: unknown }).extensions
  if (!Array.isArray(extensions)) return []
  const hits: OpenVsxHit[] = []
  for (const item of extensions) {
    if (item === null || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    if (typeof rec.namespace !== 'string' || typeof rec.name !== 'string') continue
    const files = rec.files
    hits.push({
      namespace: rec.namespace,
      name: rec.name,
      ...typeof rec.displayName === 'string' ? { displayName: rec.displayName } : {},
      ...typeof rec.description === 'string' ? { description: rec.description } : {},
      ...typeof rec.verified === 'boolean' ? { verified: rec.verified } : {},
      ...typeof rec.version === 'string' ? { version: rec.version } : {},
      ...files !== null && typeof files === 'object' && typeof (files as { download?: unknown }).download === 'string'
        ? { files: { download: (files as { download: string }).download } }
        : {},
    })
  }
  return hits
}

/**
 * Search Open VSX. Network errors become an empty list (caller can show a toast).
 * @param query - search string.
 * @param fetchImpl - fetch.
 * @param signal - abort.
 */
export async function searchOpenVsx(
  query: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<OpenVsxHit[]> {
  const url = `${SEARCH}?query=${encodeURIComponent(query)}&size=30`
  try {
    const response = await fetchImpl(url, signal === undefined ? undefined : { signal })
    if (!response.ok) return []
    return parseOpenVsxSearch(await response.json())
  }
  catch {
    return []
  }
}

/**
 * Download a vsix as bytes.
 * @param url - Open VSX download URL.
 * @param fetchImpl - fetch.
 * @param signal - abort.
 */
export async function downloadVsix(
  url: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const response = await fetchImpl(url, signal === undefined ? undefined : { signal })
  if (!response.ok) {
    throw new Error(`open-vsx-download-${String(response.status)}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}
