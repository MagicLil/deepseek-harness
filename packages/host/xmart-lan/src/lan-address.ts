/** Collect non-internal IPv4 addresses from a snapshot of network interfaces. */

import type { NetworkInterfaceInfo } from 'node:os'

/**
 * List LAN IPv4 addresses. Does not call `os.networkInterfaces()` itself.
 * @param interfaces - snapshot from `os.networkInterfaces()`.
 */
export function listLanIpv4(
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>,
): string[] {
  const out: string[] = []
  for (const list of Object.values(interfaces)) {
    if (list === undefined) continue
    for (const info of list) {
      const v4 = info.family === 'IPv4' || String(info.family) === '4'
      if (v4 && !info.internal) out.push(info.address)
    }
  }
  return out
}
