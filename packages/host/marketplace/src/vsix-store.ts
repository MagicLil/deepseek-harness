/**
 * Persist downloaded vsix files under `~/.dsh/extensions`.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { classifyVsix, type VsixManifest } from './vsix-compat.ts'
import type { VsixCard } from './types.ts'

/** On-disk manifest row. */
export interface StoredVsix {
  readonly id: string
  readonly displayName: string
  readonly publisher: string
  readonly description: string
  readonly version: string
  readonly fileName: string
}

/** Filesystem used by the store (injectable for tests). */
export interface VsixFs {
  mkdir: typeof mkdir
  readFile: typeof readFile
  writeFile: typeof writeFile
  rm: typeof rm
}

const realFs: VsixFs = { mkdir, readFile, writeFile, rm }

/**
 * Directory that holds vsix files and `manifest.json`.
 * @param home - harness home (`~/.dsh`), not the OS user home.
 */
export function extensionsDir(home: string): string {
  return join(home, 'extensions')
}

/**
 * Read the stored manifest. Missing file → empty list.
 * @param home - harness home (`~/.dsh`).
 * @param fs - filesystem.
 */
export async function listStored(home: string, fs: VsixFs = realFs): Promise<StoredVsix[]> {
  try {
    const raw = await fs.readFile(join(extensionsDir(home), 'manifest.json'), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return []
    const items = (parsed as { items?: unknown }).items
    if (!Array.isArray(items)) return []
    return items.filter((item): item is StoredVsix => (
      item !== null
      && typeof item === 'object'
      && typeof (item as StoredVsix).id === 'string'
      && typeof (item as StoredVsix).fileName === 'string'
    ))
  }
  catch {
    return []
  }
}

/**
 * Write the manifest atomically enough for this product (single writer).
 * @param home - harness home (`~/.dsh`).
 * @param items - rows.
 * @param fs - filesystem.
 */
export async function writeManifest(home: string, items: readonly StoredVsix[], fs: VsixFs = realFs): Promise<void> {
  const dir = extensionsDir(home)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(join(dir, 'manifest.json'), `${JSON.stringify({ items }, null, 2)}\n`, 'utf8')
}

/**
 * Save a vsix and record it.
 * @param home - harness home (`~/.dsh`).
 * @param card - card being installed.
 * @param bytes - vsix body.
 * @param fs - filesystem.
 */
export async function storeVsix(
  home: string,
  card: Pick<VsixCard, 'id' | 'displayName' | 'publisher' | 'description'> & { readonly version?: string },
  bytes: Uint8Array,
  fs: VsixFs = realFs,
): Promise<StoredVsix> {
  const dir = join(extensionsDir(home), 'files')
  await fs.mkdir(dir, { recursive: true })
  const fileName = `${card.id.replaceAll(/[^a-zA-Z0-9._-]/g, '_')}.vsix`
  await fs.writeFile(join(dir, fileName), bytes)
  const row: StoredVsix = {
    id: card.id,
    displayName: card.displayName,
    publisher: card.publisher,
    description: card.description,
    version: card.version ?? '0.0.0',
    fileName,
  }
  const existing = await listStored(home, fs)
  const next = [...existing.filter(item => item.id !== card.id), row]
  await writeManifest(home, next, fs)
  return row
}

/**
 * Remove a stored vsix.
 * @param home - harness home (`~/.dsh`).
 * @param id - `publisher.name`.
 * @param fs - filesystem.
 */
export async function removeStored(home: string, id: string, fs: VsixFs = realFs): Promise<boolean> {
  const existing = await listStored(home, fs)
  const row = existing.find(item => item.id === id)
  if (row === undefined) return false
  try {
    await fs.rm(join(extensionsDir(home), 'files', row.fileName), { force: true })
  }
  catch {
    // already gone
  }
  await writeManifest(home, existing.filter(item => item.id !== id), fs)
  return true
}

/**
 * Turn stored rows into cards.
 * @param items - stored rows.
 * @param manifests - optional package.json by id.
 */
export function cardsFromStored(
  items: readonly StoredVsix[],
  manifests: ReadonlyMap<string, VsixManifest> = new Map(),
): VsixCard[] {
  return items.map(item => ({
    id: item.id,
    displayName: item.displayName,
    publisher: item.publisher,
    description: item.description,
    verified: false,
    installed: true,
    compatibility: classifyVsix(item.id, manifests.get(item.id)),
    version: item.version,
  }))
}
