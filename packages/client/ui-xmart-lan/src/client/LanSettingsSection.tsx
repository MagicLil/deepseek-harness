/**
 * Settings → LAN: switch, port, URLs, token.
 */
import { useEffect, useState, type ReactNode } from 'react'
import type { LanSettingsProps, LanStatus } from './contract.ts'
import css from './LanSettingsSection.module.css'

const EMPTY: LanStatus = {
  enabled: false,
  port: 3080,
  loopbackUrl: 'http://127.0.0.1:3080/',
  lanUrl: null,
  token: '',
  bindError: null,
}

/** LAN settings page (see module doc). */
export function LanSettingsSection({
  t,
  status,
  setEnabled,
  setPort,
  rotateToken,
  copyText,
}: LanSettingsProps): ReactNode {
  const [view, setView] = useState<LanStatus>(EMPTY)
  const [portText, setPortText] = useState(String(EMPTY.port))

  useEffect(() => {
    let current = true
    void status().then((next) => {
      if (!current) return
      setView(next)
      setPortText(String(next.port))
    })
    return () => { current = false }
  }, [status])

  const apply = (next: LanStatus): void => {
    setView(next)
    setPortText(String(next.port))
  }

  return (
    <section className={css.root} data-testid="xmart-lan-settings">
      <h2>{t('title')}</h2>
      <p className={css.intro}>{t('intro')}</p>
      <label className={css.row}>
        <input
          type="checkbox"
          role="switch"
          aria-label={t('enabled')}
          checked={view.enabled}
          onChange={(event) => { void setEnabled(event.target.checked).then(apply) }}
        />
        {t('enabled')}
      </label>
      <label className={css.row}>
        {t('port')}
        <input
          type="number"
          aria-label={t('port')}
          value={portText}
          onChange={(event) => { setPortText(event.target.value) }}
          onBlur={() => { void setPort(Number(portText)).then(apply) }}
        />
      </label>
      <p className={css.row}>
        <span>{t('loopback')}</span>
        <code>{view.loopbackUrl}</code>
      </p>
      {view.lanUrl !== null && (
        <p className={css.row}>
          <span>{t('lanUrl')}</span>
          <code>{view.lanUrl}</code>
        </p>
      )}
      <p className={css.row}>
        <span>{t('token')}</span>
        <code className={css.token}>{view.token}</code>
        <button type="button" onClick={() => { void copyText(view.token) }}>{t('copy')}</button>
        <button type="button" onClick={() => { void rotateToken().then(apply) }}>{t('rotate')}</button>
      </p>
      {view.bindError !== null && (
        <p className={css.error} role="alert">{t('bindError')}: {view.bindError}</p>
      )}
      <p className={css.note}>{t('firewall')}</p>
      <p className={css.note}>{t('warning')}</p>
    </section>
  )
}
