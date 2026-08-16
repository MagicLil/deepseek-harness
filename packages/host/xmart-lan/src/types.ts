/** Shared xmart-lan payloads. JSON-only so they cross the Remote wire. */

/** Settings projection returned by every mutating Remote. */
export interface LanStatus {
  /** Whether non-loopback listeners are intended. */
  readonly enabled: boolean
  /** Listen port. */
  readonly port: number
  /** Always the loopback URL the desktop window uses. */
  readonly loopbackUrl: string
  /** First current LAN IPv4 URL when enabled; otherwise null. */
  readonly lanUrl: string | null
  /** Current token. Shown in Settings; written as the login cookie. */
  readonly token: string
  /** Last bind/rebind failure, if any. */
  readonly bindError: string | null
}

/** Toggle the LAN listener. */
export interface SetEnabledRequest {
  /** True binds `0.0.0.0`; false returns to `127.0.0.1`. */
  readonly enabled: boolean
}

/** Change the listen port. */
export interface SetPortRequest {
  /** Port in 1..65535. */
  readonly port: number
}

/** On-disk persist shape. */
export interface LanPersist {
  enabled: boolean
  port: number
  token: string
}

/** Cordis plugin config. */
export interface Config {
  /** DeepSeek Harness config root. Defaults to `$DSH_HOME` or `~/.dsh`. */
  readonly dshHome?: string
  /** Test hook: snapshot of `os.networkInterfaces()`. */
  readonly interfaces?: () => NodeJS.Dict<import('node:os').NetworkInterfaceInfo[]>
}
