/** Host marketplace: DSH plugin install + Open VSX vsix download. */

import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type {} from 'zod'
import { cardFromRow, filterCards, loadCatalog } from './catalog.ts'
import { desktopCompatibility } from './desktop-compat.ts'
import { cardFromOpenVsx, downloadVsix, searchOpenVsx } from './openvsx.ts'
import {
  addPlugin, installedPackageNames, readProfilePackage, removePlugin,
} from './profile-install.ts'
import { createRuntime, runtimeProfileDir, type MarketplaceRuntime } from './runtime.ts'
import type {
  DshPluginCard,
  DshPluginSearchResult,
  MarketplaceJobResult,
  PluginInstallRequest,
  PluginListRequest,
  PluginQueryRequest,
  PluginUninstallRequest,
  VsixInstallRequest,
  VsixQueryRequest,
  VsixSearchResult,
  VsixUninstallRequest,
} from './types.ts'
import { classifyVsix, installDisabled, vsixId } from './vsix-compat.ts'
import { VSIX_RECOMMENDED } from './vsix-recommended.ts'
import { cardsFromStored, listStored, removeStored, storeVsix } from './vsix-store.ts'

export type * from './types.ts'
export type { MarketplaceRuntime } from './runtime.ts'

function localeOf(value: string | undefined): 'zh' | 'en' {
  return value === 'en' ? 'en' : 'zh'
}

function fail(error: string, logs = ''): MarketplaceJobResult {
  return { ok: false, logs, needsRestart: false, error }
}

function ok(logs: string, needsRestart: boolean): MarketplaceJobResult {
  return { ok: true, logs, needsRestart }
}

/** Remote-only marketplace service (no same-process Context merge). */
export class MarketplaceGateway extends TypertRemoteService {
  /** Replaceable I/O for tests. */
  runtime: MarketplaceRuntime

  constructor(ctx: Context) {
    super(ctx, 'marketplace')
    this.runtime = createRuntime()
  }

  /**
   * Search the awesome-dsh-plugin catalog (live fetch, snapshot fallback).
   * @param request - query and locale.
   * @param signal - abort.
   * @returns matching cards with install + desktop-compat flags.
   */
  @Remote('searchPlugins')
  async searchPlugins(request: PluginQueryRequest, signal?: AbortSignal): Promise<DshPluginSearchResult> {
    const locale = localeOf(request.locale)
    const rows = await loadCatalog(this.runtime.fetch, signal)
    const installed = installedPackageNames(
      await readProfilePackage(runtimeProfileDir(this.runtime), this.runtime.readFile),
    )
    const items = filterCards(rows.map(row => cardFromRow(row, locale, installed)), request.query)
    return { query: request.query, items }
  }

  /**
   * List packages already in the running profile, matched against the catalog.
   * @param request - locale.
   * @param signal - abort.
   * @returns installed cards.
   */
  @Remote('listInstalledPlugins')
  async listInstalledPlugins(request: PluginListRequest, signal?: AbortSignal): Promise<DshPluginSearchResult> {
    const locale = localeOf(request.locale)
    const rows = await loadCatalog(this.runtime.fetch, signal)
    const installed = installedPackageNames(
      await readProfilePackage(runtimeProfileDir(this.runtime), this.runtime.readFile),
    )
    const items: DshPluginCard[] = []
    for (const row of rows) {
      const card = cardFromRow(row, locale, installed)
      if (card.installed) items.push(card)
    }
    for (const name of installed) {
      if (items.some(item => item.name === name || item.installSpec === name)) continue
      items.push({
        id: name,
        name,
        owner: '',
        description: '',
        category: 'installed',
        installSpec: name,
        stars: 0,
        installed: true,
        desktopCompatible: true,
      })
    }
    return { query: '', items }
  }

  /**
   * Install a DSH plugin into the running profile. HTTP/WebSocket plugins are
   * refused. Lifecycle scripts stay off unless `allowBuilds` is true. Success
   * always asks the desktop to relaunch — we do not hot-load untrusted host code.
   * @param request - spec and build flag.
   * @param signal - abort (reserved; pnpm is not cancelled mid-flight).
   * @returns job logs and restart flag.
   */
  @Remote('installPlugin')
  async installPlugin(request: PluginInstallRequest, signal?: AbortSignal): Promise<MarketplaceJobResult> {
    void signal
    const rows = await loadCatalog(this.runtime.fetch)
    const row = rows.find(item => (
      item.name === request.spec
      || `${item.owner}/${item.name}` === request.spec
      || item.install.includes(request.spec)
    ))
    if (row !== undefined) {
      const compat = desktopCompatibility(row)
      if (!compat.ok) return fail(compat.reason)
    }
    const spec = request.spec.trim()
    if (spec.length === 0) return fail('empty-spec')
    const result = await addPlugin(
      runtimeProfileDir(this.runtime),
      spec,
      request.allowBuilds === true,
      this.runtime.spawn,
      this.runtime.readFile,
      this.runtime.writeFile,
    )
    if (result.code !== 0) return fail('pnpm-add-failed', result.logs)
    return ok(result.logs, true)
  }

  /**
   * Remove a DSH plugin from the running profile. Success requires a relaunch.
   * @param request - package name.
   * @param signal - abort (reserved).
   * @returns job logs and restart flag.
   */
  @Remote('uninstallPlugin')
  async uninstallPlugin(request: PluginUninstallRequest, signal?: AbortSignal): Promise<MarketplaceJobResult> {
    void signal
    const name = request.name.trim()
    if (name.length === 0) return fail('empty-name')
    const result = await removePlugin(
      runtimeProfileDir(this.runtime),
      name,
      this.runtime.spawn,
      this.runtime.readFile,
      this.runtime.writeFile,
    )
    if (result.code !== 0) return fail('pnpm-remove-failed', result.logs)
    return ok(result.logs, true)
  }

  /**
   * Search Open VSX. An empty query returns the curated recommended set.
   * @param request - query.
   * @param signal - abort.
   * @returns cards with compatibility labels (no activation).
   */
  @Remote('searchExtensions')
  async searchExtensions(request: VsixQueryRequest, signal?: AbortSignal): Promise<VsixSearchResult> {
    const stored = await listStored(this.runtime.home, this.runtime.vsixFs)
    const installed = new Set(stored.map(item => item.id))
    const query = request.query.trim()
    const hits = query.length === 0
      ? [...VSIX_RECOMMENDED]
      : await searchOpenVsx(query, this.runtime.fetch, signal)
    const items = hits.map(hit => cardFromOpenVsx(hit, installed))
    return { query: request.query, items }
  }

  /**
   * List vsix files already stored under `~/.dsh/extensions`.
   * @returns installed cards (still not activated).
   */
  @Remote('listInstalledExtensions')
  async listInstalledExtensions(): Promise<VsixSearchResult> {
    const stored = await listStored(this.runtime.home, this.runtime.vsixFs)
    return { query: '', items: cardsFromStored(stored) }
  }

  /**
   * Download a vsix from Open VSX into `~/.dsh/extensions`. Unsupported ids
   * (Remote SSH, language packs, Cursor-only) are refused. Downloaded
   * extensions are not activated — the editor is still AMD Monaco.
   * @param request - id and optional download URL.
   * @param signal - abort.
   * @returns job result (no restart; files are inert until a host exists).
   */
  @Remote('installExtension')
  async installExtension(request: VsixInstallRequest, signal?: AbortSignal): Promise<MarketplaceJobResult> {
    const id = request.id.trim()
    if (id.length === 0) return fail('empty-id')
    if (installDisabled(classifyVsix(id))) return fail('unsupported')
    let url = request.downloadUrl
    if (url === undefined || url.length === 0) {
      const dot = id.indexOf('.')
      const name = dot === -1 ? '' : id.slice(dot + 1)
      const hits = await searchOpenVsx(name.length > 0 ? name : id, this.runtime.fetch, signal)
      const hit = hits.find(item => vsixId(item.namespace, item.name) === id) ?? hits[0]
      url = hit?.files?.download
    }
    if (url === undefined || url.length === 0) return fail('no-download-url')
    try {
      const bytes = await downloadVsix(url, this.runtime.fetch, signal)
      const [publisher = id] = id.split('.')
      await storeVsix(this.runtime.home, {
        id,
        displayName: id,
        publisher,
        description: '',
      }, bytes, this.runtime.vsixFs)
      return ok(`stored ${id}`, false)
    }
    catch (error) {
      return fail(error instanceof Error ? error.message : 'download-failed')
    }
  }

  /**
   * Delete a stored vsix. Does not touch a running editor.
   * @param request - id.
   * @returns job result.
   */
  @Remote('uninstallExtension')
  async uninstallExtension(request: VsixUninstallRequest): Promise<MarketplaceJobResult> {
    const id = request.id.trim()
    if (id.length === 0) return fail('empty-id')
    const removed = await removeStored(this.runtime.home, id, this.runtime.vsixFs)
    return removed ? ok(`removed ${id}`, false) : fail('not-installed')
  }
}

export default MarketplaceGateway
