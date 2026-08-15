/**
 * Optional runtime override for electron-updater's feed.
 * When unset, the packaged `app-update.yml` from electron-builder is used.
 * @module @deepseek-ai/dsh-desktop/update-feed
 */

/** Generic HTTP feed (directory that serves `latest.yml` + installers). */
export interface GenericUpdateFeed {
  provider: 'generic'
  url: string
}

/** GitHub Releases feed. */
export interface GithubUpdateFeed {
  provider: 'github'
  owner: string
  repo: string
}

/** Feed electron-updater should use, or `undefined` to keep the packaged default. */
export type UpdateFeed = GenericUpdateFeed | GithubUpdateFeed

/**
 * Resolve an update feed from the process environment.
 *
 * - `DSH_UPDATE_FEED_URL` — generic provider (wins when both are set)
 * - `DSH_UPDATE_GITHUB` — `owner/repo`
 * @param env - environment map (usually `process.env`).
 * @returns a feed, or `undefined` when the packaged `app-update.yml` should stand.
 */
export function resolveUpdateFeed(env: Record<string, string | undefined>): UpdateFeed | undefined {
  const generic = env.DSH_UPDATE_FEED_URL?.trim() ?? ''
  if (generic !== '') return { provider: 'generic', url: generic }
  const github = env.DSH_UPDATE_GITHUB?.trim() ?? ''
  const slash = github.indexOf('/')
  if (slash <= 0 || slash !== github.lastIndexOf('/') || slash === github.length - 1) return undefined
  const owner = github.slice(0, slash)
  const repo = github.slice(slash + 1)
  if (owner === '' || repo === '') return undefined
  return { provider: 'github', owner, repo }
}
