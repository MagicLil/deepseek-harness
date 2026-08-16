/**
 * Split desktop proxy: foreign LLM hosts through the local Clash port,
 * everything else (DeepSeek, Moonshot, loopback) DIRECT. Electron's Node
 * does not honour `NODE_USE_ENV_PROXY`; Chromium PAC + `net.fetch` does.
 * @module @deepseek-ai/dsh-desktop/proxy-env
 */

/** Clash / WinHTTP default on this machine when the user does not export a proxy. */
export const DEFAULT_DESKTOP_PROXY_SERVER = '127.0.0.1:7890'

/**
 * Hosts that must go through the proxy (ChatGPT OAuth + Codex + common
 * overseas providers). Suffix match: `api.openai.com` matches `openai.com`.
 */
export const PROXIED_LLM_HOST_SUFFIXES = [
  'openai.com',
  'chatgpt.com',
  'oaistatic.com',
  'anthropic.com',
  'openrouter.ai',
  'x.ai',
  'googleapis.com',
] as const

/**
 * First non-empty proxy URL from the usual env names.
 * @param env - process env (tests pass a stub).
 */
export function desktopProxyUrl(env: NodeJS.ProcessEnv): string | undefined {
  const raw = env.HTTPS_PROXY ?? env.https_proxy ?? env.HTTP_PROXY ?? env.http_proxy
  if (raw === undefined) return undefined
  const trimmed = raw.trim()
  return trimmed === '' ? undefined : trimmed
}

/**
 * `host:port` from env, or the local Clash default so a normal `dsh desktop`
 * launch still reaches Codex without exporting variables.
 * @param env - process env.
 */
export function resolveDesktopProxyServer(env: NodeJS.ProcessEnv): string {
  return desktopProxyServer(env) ?? DEFAULT_DESKTOP_PROXY_SERVER
}

/**
 * `host:port` for a PAC `PROXY` line, or `undefined` when env is empty/invalid.
 * @param env - process env.
 */
export function desktopProxyServer(env: NodeJS.ProcessEnv): string | undefined {
  const raw = desktopProxyUrl(env)
  if (raw === undefined) return undefined
  try {
    const url = new URL(raw.includes('://') ? raw : `http://${raw}`)
    if (url.hostname === '') return undefined
    const port = url.port !== '' ? url.port : url.protocol === 'https:' ? '443' : '80'
    const server = `${url.hostname}:${port}`
    return /^[A-Za-z0-9.-]+:\d{1,5}$/.test(server) ? server : undefined
  } catch {
    return undefined
  }
}

/**
 * PAC that proxies only {@link PROXIED_LLM_HOST_SUFFIXES}.
 * @param proxyServer - `host:port`.
 */
export function desktopSplitProxyPac(proxyServer: string): string {
  const suffixes = PROXIED_LLM_HOST_SUFFIXES.map(suffix => JSON.stringify(suffix)).join(',')
  return [
    'function FindProxyForURL(url, host) {',
    '  var h = host.toLowerCase();',
    `  var suffixes = [${suffixes}];`,
    '  for (var i = 0; i < suffixes.length; i++) {',
    '    var s = suffixes[i];',
    '    if (h === s || h.slice(-(s.length + 1)) === "." + s) {',
    `      return "PROXY ${proxyServer}";`,
    '    }',
    '  }',
    '  return "DIRECT";',
    '}',
    '',
  ].join('\n')
}

/**
 * `data:` PAC URL for `session.setProxy({ pacScript })`.
 * @param proxyServer - `host:port`.
 */
export function desktopSplitProxyPacScript(proxyServer: string): string {
  return `data:text/plain,${encodeURIComponent(desktopSplitProxyPac(proxyServer))}`
}
