/** Injected RPC + copy for the LAN settings page. Components never see ctx. */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { LanKey } from './locales.ts'

/** Settings projection from the Host Remote. */
export interface LanStatus {
  readonly enabled: boolean
  readonly port: number
  readonly loopbackUrl: string
  readonly lanUrl: string | null
  readonly token: string
  readonly bindError: string | null
}

/** Registration-side Remote face used by the section. */
export interface LanSettingsInjected {
  status: () => Promise<LanStatus>
  setEnabled: (enabled: boolean) => Promise<LanStatus>
  setPort: (port: number) => Promise<LanStatus>
  rotateToken: () => Promise<LanStatus>
  copyText: (text: string) => Promise<void>
}

/** Full composed props for the LAN settings section. */
export type LanSettingsProps =
  & PropsRuntime<'settings.section'>
  & PropsLocale<'settings.lan'>
  & InjectFace<LanSettingsInjected>

export type { LanKey }
