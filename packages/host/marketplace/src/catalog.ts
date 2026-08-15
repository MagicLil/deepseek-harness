/**
 * Parse and search the awesome-dsh-plugin catalog.
 */
import { CATALOG_SNAPSHOT, type CatalogPluginRow } from './catalog-snapshot.ts'
import { desktopCompatibility } from './desktop-compat.ts'
import type { DshPluginCard } from './types.ts'

const LIVE_CATALOG = 'https://awesome-dsh-plugin.com/plugins.json'

/** Extract the pnpm spec from a documented `dsh plugin ... add <spec>` line. */
export function installSpecOf(install: string): string {
  const match = /add\s+(\S+)/.exec(install)
  return match?.[1] ?? install
}

/**
 * Map one catalog row to a card.
 * @param row - catalog row.
 * @param locale - `zh` or `en`.
 * @param installed - package names present in the profile.
 */
export function cardFromRow(
  row: CatalogPluginRow,
  locale: 'zh' | 'en',
  installed: ReadonlySet<string>,
): DshPluginCard {
  const spec = installSpecOf(row.install)
  const compat = desktopCompatibility(row)
  return {
    id: `${row.owner}/${row.name}`,
    name: row.name,
    owner: row.owner,
    description: locale === 'zh' ? row.description.zh : row.description.en,
    category: row.category,
    installSpec: spec,
    stars: row.stars,
    installed: installed.has(row.name) || installed.has(spec),
    desktopCompatible: compat.ok,
    ...compat.ok ? {} : { incompatibilityReason: compat.reason },
  }
}

/**
 * Filter cards by a case-insensitive query (name, owner, description).
 * @param items - cards.
 * @param query - raw search string.
 */
export function filterCards(items: readonly DshPluginCard[], query: string): DshPluginCard[] {
  const needle = query.trim().toLocaleLowerCase()
  if (needle.length === 0) return [...items]
  return items.filter(item => (
    item.name.toLocaleLowerCase().includes(needle)
    || item.owner.toLocaleLowerCase().includes(needle)
    || item.description.toLocaleLowerCase().includes(needle)
    || item.category.toLocaleLowerCase().includes(needle)
  ))
}

/**
 * Read a catalog JSON value. Unknown shapes fall back to the snapshot.
 * @param raw - parsed JSON.
 */
export function parseCatalog(raw: unknown): readonly CatalogPluginRow[] {
  if (raw === null || typeof raw !== 'object') return CATALOG_SNAPSHOT.plugins
  const plugins = (raw as { plugins?: unknown }).plugins
  if (!Array.isArray(plugins)) return CATALOG_SNAPSHOT.plugins
  const rows: CatalogPluginRow[] = []
  for (const item of plugins) {
    if (item === null || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const description = rec.description
    if (typeof rec.name !== 'string' || typeof rec.owner !== 'string') continue
    if (typeof rec.install !== 'string' || typeof rec.category !== 'string') continue
    if (description === null || typeof description !== 'object') continue
    const desc = description as Record<string, unknown>
    if (typeof desc.en !== 'string' || typeof desc.zh !== 'string') continue
    rows.push({
      name: rec.name,
      owner: rec.owner,
      url: typeof rec.url === 'string' ? rec.url : '',
      category: rec.category,
      description: { en: desc.en, zh: desc.zh },
      install: rec.install,
      stars: typeof rec.stars === 'number' ? rec.stars : 0,
    })
  }
  return rows.length > 0 ? rows : CATALOG_SNAPSHOT.plugins
}

/**
 * Fetch the live catalog, falling back to the snapshot.
 * @param fetchImpl - fetch function.
 * @param signal - abort.
 */
export async function loadCatalog(
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<readonly CatalogPluginRow[]> {
  try {
    const response = await fetchImpl(LIVE_CATALOG, signal === undefined ? undefined : { signal })
    if (!response.ok) return CATALOG_SNAPSHOT.plugins
    return parseCatalog(await response.json())
  }
  catch {
    return CATALOG_SNAPSHOT.plugins
  }
}
