import type { ManagedSkillSummary } from './contract.ts'

/**
 * Whether a catalog row matches a keyword query.
 * Empty or whitespace-only queries match everything.
 * @param item - listed skill.
 * @param query - raw search box text.
 * @returns true when the row should stay visible.
 */
export function matchesSkillQuery(item: ManagedSkillSummary, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return true
  const hay = [item.name, item.description, item.whenToUse ?? '', item.origin]
    .join('\n')
    .toLowerCase()
  return hay.includes(needle)
}

/**
 * Keep skills whose name, description, routing note, or origin matches.
 * @param items - listed skills.
 * @param query - raw search box text.
 * @returns filtered rows in the original order.
 */
export function filterSkills(
  items: readonly ManagedSkillSummary[],
  query: string,
): ManagedSkillSummary[] {
  return items.filter(item => matchesSkillQuery(item, query))
}

/**
 * Filter each project group. A non-empty query hides groups with no hits.
 * @param groups - workspace groups.
 * @param query - raw search box text.
 * @returns groups that still have visible skills.
 */
export function filterProjectGroups<T extends { readonly items: readonly ManagedSkillSummary[] }>(
  groups: readonly T[],
  query: string,
): T[] {
  const needle = query.trim()
  const next = groups.map(group => ({ ...group, items: filterSkills(group.items, query) }))
  return needle.length === 0 ? next : next.filter(group => group.items.length > 0)
}
