/**
 * Plugins / Extensions primary-sidebar body. Search, installed, catalog,
 * install/uninstall. RPC arrives through props; the component never sees ctx.
 */
import { useEffect, useState } from 'react'
import type { DshPluginCard, MarketplaceJobResult, MarketplacePaneProps, VsixCard } from './contract.ts'
import type { MarketplaceKey } from './locales.ts'
import css from './MarketplacePane.module.css'

type Phase = 'loading' | 'ready' | 'error'

function compatKey(value: VsixCard['compatibility']): MarketplaceKey {
  if (value === 'unsupported') return 'unsupported'
  if (value === 'needs-node-host') return 'needsNodeHost'
  return 'pendingHost'
}

/** Marketplace sidebar (see module doc). */
export function MarketplacePane({
  kind, visible, t,
  searchPlugins, listInstalledPlugins, installPlugin, uninstallPlugin,
  searchExtensions, listInstalledExtensions, installExtension, uninstallExtension,
}: MarketplacePaneProps) {
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<Phase>('loading')
  const [catalog, setCatalog] = useState<readonly DshPluginCard[]>([])
  const [installedPlugins, setInstalledPlugins] = useState<readonly DshPluginCard[]>([])
  const [extensions, setExtensions] = useState<readonly VsixCard[]>([])
  const [installedExt, setInstalledExt] = useState<readonly VsixCard[]>([])
  const [confirm, setConfirm] = useState<DshPluginCard | null>(null)
  const [allowBuilds, setAllowBuilds] = useState(false)
  const [job, setJob] = useState<MarketplaceJobResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!visible) return
    let current = true
    setPhase('loading')
    const load = kind === 'plugins'
      ? Promise.all([searchPlugins(query), listInstalledPlugins()])
      : Promise.all([searchExtensions(query), listInstalledExtensions()])
    void load.then(
      ([found, installed]) => {
        if (!current) return
        if (kind === 'plugins') {
          setCatalog(found as readonly DshPluginCard[])
          setInstalledPlugins(installed as readonly DshPluginCard[])
        }
        else {
          setExtensions(found as readonly VsixCard[])
          setInstalledExt(installed as readonly VsixCard[])
        }
        setPhase('ready')
      },
      () => { if (current) setPhase('error') },
    )
    return () => { current = false }
  }, [
    visible, kind, query, tick,
    searchPlugins, listInstalledPlugins, searchExtensions, listInstalledExtensions,
  ])

  const run = (work: () => Promise<MarketplaceJobResult>) => {
    setBusy(true)
    void work().then((result) => {
      setJob(result)
      setBusy(false)
      setConfirm(null)
      setAllowBuilds(false)
      if (result.ok) setTick(n => n + 1)
    }, () => {
      setJob({ ok: false, logs: '', needsRestart: false, error: 'error' })
      setBusy(false)
      setConfirm(null)
    })
  }

  return (
    <div className={css.root} data-testid={`xmart-marketplace-${kind}`}>
      <div className={css.search}>
        <input
          type="search"
          value={query}
          placeholder={t(kind === 'plugins' ? 'searchPlugins' : 'searchExtensions')}
          aria-label={t(kind === 'plugins' ? 'searchPlugins' : 'searchExtensions')}
          onChange={(event) => { setQuery(event.target.value) }}
        />
      </div>
      {confirm !== null && (
        <div className={css.dialog} data-testid="xmart-marketplace-confirm">
          <h3>{t('confirmTitle')}</h3>
          <div className={css.meta}>{t('confirmSpec')}: {confirm.installSpec}</div>
          {!confirm.desktopCompatible && <p className={css.note}>{t('confirmDesktop')}</p>}
          <label className={css.note}>
            <input
              type="checkbox"
              checked={allowBuilds}
              onChange={(event) => { setAllowBuilds(event.target.checked) }}
            />
            {t('confirmBuilds')}
          </label>
          <div className={css.row}>
            <button
              type="button"
              className={css.button}
              disabled={!confirm.desktopCompatible || busy}
              onClick={() => { run(() => installPlugin(confirm.installSpec, allowBuilds)) }}
            >
              {t('confirmOk')}
            </button>
            <button type="button" className={css.button} onClick={() => { setConfirm(null) }}>
              {t('confirmCancel')}
            </button>
          </div>
        </div>
      )}
      {job !== null && (
        <pre className={css.logs} data-testid="xmart-marketplace-logs">
          {job.ok
            ? (job.needsRestart ? t('needsRestart') : t('notActivated'))
            : (job.error ?? t('error'))}
          {job.logs === '' ? '' : `\n${job.logs}`}
        </pre>
      )}
      <div className={css.scroll}>
        {phase === 'loading' && <div className={css.status}>{t('loading')}</div>}
        {phase === 'error' && (
          <div className={css.status}>
            {t('error')}
            <button type="button" className={css.button} onClick={() => { setTick(n => n + 1) }}>
              {t('retry')}
            </button>
          </div>
        )}
        {phase === 'ready' && kind === 'plugins' && (
          <PluginLists
            t={t}
            catalog={catalog}
            installed={installedPlugins}
            busy={busy}
            onInstall={(card) => { setConfirm(card) }}
            onUninstall={(name) => { run(() => uninstallPlugin(name)) }}
          />
        )}
        {phase === 'ready' && kind === 'extensions' && (
          <ExtensionLists
            t={t}
            catalog={extensions}
            installed={installedExt}
            busy={busy}
            onInstall={(id, url) => { run(() => installExtension(id, url)) }}
            onUninstall={(id) => { run(() => uninstallExtension(id)) }}
          />
        )}
      </div>
    </div>
  )
}

function PluginLists({
  t, catalog, installed, busy, onInstall, onUninstall,
}: {
  t: MarketplacePaneProps['t']
  catalog: readonly DshPluginCard[]
  installed: readonly DshPluginCard[]
  busy: boolean
  onInstall: (card: DshPluginCard) => void
  onUninstall: (name: string) => void
}) {
  return (
    <>
      <div className={css.group}>{t('installed')}</div>
      {installed.length === 0 && <div className={css.status}>{t('empty')}</div>}
      {installed.map(card => (
        <article key={card.id} className={css.card} data-testid={`xmart-plugin-${card.id}`}>
          <div className={css.title}>{card.name}</div>
          <div className={css.desc}>{card.description}</div>
          <div className={css.row}>
            <span className={css.badge}>{t('installedTag')}</span>
            <button type="button" className={css.button} disabled={busy} onClick={() => { onUninstall(card.name) }}>
              {t('uninstall')}
            </button>
          </div>
        </article>
      ))}
      <div className={css.group}>{t('recommended')}</div>
      {catalog.length === 0 && <div className={css.status}>{t('empty')}</div>}
      {catalog.map(card => (
        <article key={`cat-${card.id}`} className={css.card} data-testid={`xmart-plugin-cat-${card.id}`}>
          <div className={css.title}>{card.name}</div>
          <div className={css.meta}>{card.owner} · {card.stars}</div>
          <div className={css.desc}>{card.description}</div>
          <div className={css.row}>
            {!card.desktopCompatible && <span className={css.badge} data-kind="unsupported">{t('unsupported')}</span>}
            {card.installed
              ? <span className={css.badge}>{t('installedTag')}</span>
              : (
                <button type="button" className={css.button} disabled={busy} onClick={() => { onInstall(card) }}>
                  {t('install')}
                </button>
              )}
          </div>
        </article>
      ))}
    </>
  )
}

function ExtensionLists({
  t, catalog, installed, busy, onInstall, onUninstall,
}: {
  t: MarketplacePaneProps['t']
  catalog: readonly VsixCard[]
  installed: readonly VsixCard[]
  busy: boolean
  onInstall: (id: string, url?: string) => void
  onUninstall: (id: string) => void
}) {
  return (
    <>
      <div className={css.group}>{t('installed')}</div>
      {installed.length === 0 && <div className={css.status}>{t('empty')}</div>}
      {installed.map(card => (
        <article key={card.id} className={css.card} data-testid={`xmart-ext-${card.id}`}>
          <div className={css.title}>{card.displayName}</div>
          <div className={css.desc}>{card.description}</div>
          <div className={css.row}>
            <span className={css.badge} data-kind={card.compatibility}>{t(compatKey(card.compatibility))}</span>
            <button type="button" className={css.button} disabled={busy} onClick={() => { onUninstall(card.id) }}>
              {t('uninstall')}
            </button>
          </div>
        </article>
      ))}
      <div className={css.group}>{t('recommended')}</div>
      {catalog.length === 0 && <div className={css.status}>{t('empty')}</div>}
      {catalog.map(card => (
        <article key={`cat-${card.id}`} className={css.card} data-testid={`xmart-ext-cat-${card.id}`}>
          <div className={css.title}>{card.displayName}</div>
          <div className={css.meta}>{card.publisher}</div>
          <div className={css.desc}>{card.description}</div>
          <div className={css.row}>
            {card.verified && <span className={css.badge} data-kind="verified">{t('verified')}</span>}
            <span className={css.badge} data-kind={card.compatibility}>{t(compatKey(card.compatibility))}</span>
            {card.installed
              ? <span className={css.badge}>{t('installedTag')}</span>
              : (
                <button
                  type="button"
                  className={css.button}
                  disabled={busy || card.compatibility === 'unsupported'}
                  onClick={() => { onInstall(card.id, card.downloadUrl) }}
                >
                  {t('install')}
                </button>
              )}
          </div>
        </article>
      ))}
    </>
  )
}
