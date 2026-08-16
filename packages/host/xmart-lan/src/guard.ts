/** Pure LAN guard verdict. */

import { isLoopbackHost, readHostName } from './loopback.ts'
import { tokenFromRequest, tokensEqual } from './token.ts'

/** Inputs the HTTP guard needs. */
export interface GuardInput {
  readonly enabled: boolean
  readonly token: string | undefined
  readonly hostHeader: string | undefined
  readonly cookie?: string
  readonly xToken?: string
}

/**
 * Loopback always allows. A closed switch denies non-loopback. An open
 * switch requires the presented token to match.
 */
export function guardVerdict(input: GuardInput): 'allow' | 'deny' {
  const host = readHostName(input.hostHeader)
  if (isLoopbackHost(host)) return 'allow'
  if (!input.enabled) return 'deny'
  if (input.token === undefined || input.token.length === 0) return 'deny'
  const presented = tokenFromRequest(input.cookie, input.xToken)
  if (presented === undefined || !tokensEqual(presented, input.token)) return 'deny'
  return 'allow'
}
