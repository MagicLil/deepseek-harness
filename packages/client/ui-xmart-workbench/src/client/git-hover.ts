/**
 * Cursor-style SCM hover card: relative time, shortstat, trailers, and a
 * commit URL derived from `origin`.
 */
import type { GitGraphNode, GitGraphRef } from './git-graph.ts'

/** Relative-time bucket for the hover header. */
export type GitHoverUnit = 'now' | 'minutes' | 'hours' | 'days' | 'months' | 'years'

/** Host class for the "open on …" footer link. */
export type GitHoverHost = 'github' | 'gitlab' | 'gitee' | 'remote'

/** Structured shortstat fragments (git English wording). */
export type GitHoverStatParts = {
  files: string
  insertions?: string
  deletions?: string
}

/** Everything the hover card paints for one commit. */
export type GitHoverModel = {
  author: string
  relative: { unit: GitHoverUnit; n: number }
  exact: string
  subject: string
  bodyLines: readonly string[]
  coAuthors: readonly string[]
  stats?: GitHoverStatParts
  refs: readonly GitGraphRef[]
  hash: string
  shortHash: string
  web?: { url: string; host: GitHoverHost }
}

const CO_AUTHOR = /^Co-authored-by:\s*(.+)$/i
const TRAILER = /^(?:Co-authored-by|Signed-off-by|Reviewed-by|Acked-by):/i

/**
 * Build the hover model from a painted graph row.
 * @param row - graph node (newest-first log fields plus decoration).
 * @param nowMs - `Date.now()` so tests can freeze time.
 * @param locale - `Intl` locale for the exact timestamp.
 */
export function gitHoverModel(row: GitGraphNode, nowMs: number, locale?: string): GitHoverModel {
  const body = row.body ?? ''
  const webUrl = row.originUrl === undefined ? undefined : gitCommitWebUrl(row.originUrl, row.hash)
  const host = row.originUrl === undefined ? undefined : gitRemoteHost(row.originUrl)
  return {
    author: row.author,
    relative: gitRelativeTime(row.timestamp, nowMs),
    exact: gitExactTime(row.timestamp, locale),
    subject: row.subject,
    bodyLines: gitBodyLines(body),
    coAuthors: gitCoAuthors(body),
    stats: gitStatParts(row.files, row.insertions, row.deletions),
    refs: row.refs.filter(ref => ref.kind !== 'head'),
    hash: row.hash,
    shortHash: gitShortHash(row.hash),
    ...webUrl !== undefined && host !== undefined ? { web: { url: webUrl, host } } : {},
  }
}

/**
 * First seven hex digits, matching `git rev-parse --short`.
 * @param hash - full or abbreviated hash.
 */
export function gitShortHash(hash: string): string {
  return hash.slice(0, 7)
}

/**
 * Bucket a unix-seconds stamp against `nowMs`.
 * @param timestampSec - author time from `git log %at`.
 * @param nowMs - current time in milliseconds.
 */
export function gitRelativeTime(timestampSec: number, nowMs: number): { unit: GitHoverUnit; n: number } {
  const then = timestampSec * 1000
  const delta = Math.max(0, nowMs - then)
  if (delta < 60_000) return { unit: 'now', n: 0 }
  const minutes = Math.floor(delta / 60_000)
  if (minutes < 60) return { unit: 'minutes', n: minutes }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { unit: 'hours', n: hours }
  const days = Math.floor(hours / 24)
  if (days < 30) return { unit: 'days', n: days }
  const months = Math.floor(days / 30)
  if (months < 12) return { unit: 'months', n: months }
  return { unit: 'years', n: Math.max(1, Math.floor(days / 365)) }
}

/**
 * Exact author time in parentheses, e.g. `2026年8月16日 02:27`.
 * @param timestampSec - author time from `git log %at`.
 * @param locale - `Intl` locale; omit to use the runtime default.
 */
export function gitExactTime(timestampSec: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestampSec * 1000))
}

/**
 * `Co-authored-by` trailer values, in order.
 * @param body - commit body after the subject.
 */
export function gitCoAuthors(body: string): string[] {
  const out: string[] = []
  for (const line of body.split(/\r?\n/)) {
    const match = CO_AUTHOR.exec(line.trim())
    if (match?.[1] !== undefined) out.push(match[1].trim())
  }
  return out
}

/**
 * Non-trailer body lines (blank lines collapsed away).
 * @param body - commit body after the subject.
 */
export function gitBodyLines(body: string): string[] {
  const out: string[] = []
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.length === 0 || TRAILER.test(line)) continue
    out.push(line)
  }
  return out
}

/**
 * English `git log --shortstat` fragments, or undefined when git sent none.
 * @param files - path count.
 * @param insertions - added lines.
 * @param deletions - removed lines.
 */
export function gitStatParts(
  files: number | undefined,
  insertions: number | undefined,
  deletions: number | undefined,
): GitHoverStatParts | undefined {
  if (files === undefined) return undefined
  const ins = insertions ?? 0
  const del = deletions ?? 0
  return {
    files: files === 1 ? '1 file changed' : `${files} files changed`,
    ...ins > 0 ? { insertions: `${ins} insertion${ins === 1 ? '' : 's'}(+)` } : {},
    ...del > 0 ? { deletions: `${del} deletion${del === 1 ? '' : 's'}(-)` } : {},
  }
}

/**
 * Classify an `origin` URL for the footer label.
 * @param originUrl - raw `git remote get-url origin`.
 */
export function gitRemoteHost(originUrl: string): GitHoverHost {
  const host = gitRemoteHttpBase(originUrl)?.host ?? ''
  if (host === 'github.com' || host.endsWith('.github.com')) return 'github'
  if (host === 'gitlab.com' || host.includes('gitlab')) return 'gitlab'
  if (host === 'gitee.com' || host.endsWith('.gitee.com')) return 'gitee'
  return 'remote'
}

/**
 * Browser URL for one commit, or undefined when `origin` is not http(s)/ssh git.
 * @param originUrl - raw `git remote get-url origin`.
 * @param hash - full or abbreviated commit id.
 */
export function gitCommitWebUrl(originUrl: string, hash: string): string | undefined {
  const parsed = gitRemoteHttpBase(originUrl)
  if (parsed === undefined) return undefined
  const path = parsed.path.replace(/\.git$/i, '').replace(/\/+$/, '')
  if (path.length === 0) return undefined
  const sep = parsed.host.includes('gitlab') ? '/-/commit/' : '/commit/'
  return `${parsed.origin}${path}${sep}${hash}`
}

/**
 * Localize a relative-time bucket.
 * @param stamp - `gitRelativeTime` result.
 * @param t - workbench dictionary (`{n}` is replaced).
 */
export function gitRelativeLabel(
  stamp: { unit: GitHoverUnit; n: number },
  t: (key: GitHoverTimeKey) => string,
): string {
  if (stamp.unit === 'now') return t('git.hoverNow')
  const key = stamp.unit === 'minutes'
    ? 'git.hoverMinutes'
    : stamp.unit === 'hours'
      ? 'git.hoverHours'
      : stamp.unit === 'days'
        ? 'git.hoverDays'
        : stamp.unit === 'months'
          ? 'git.hoverMonths'
          : 'git.hoverYears'
  return t(key).replace('{n}', String(stamp.n))
}

/** Dictionary keys `gitRelativeLabel` / `gitWebLabel` read. */
export type GitHoverTimeKey =
  | 'git.hoverNow' | 'git.hoverMinutes' | 'git.hoverHours'
  | 'git.hoverDays' | 'git.hoverMonths' | 'git.hoverYears'

/** Dictionary keys for the remote footer. */
export type GitHoverWebKey =
  | 'git.openOnGitHub' | 'git.openOnGitLab' | 'git.openOnGitee' | 'git.openOnRemote'

/**
 * Footer label for the commit web link.
 * @param host - classified remote host.
 * @param t - workbench dictionary.
 */
export function gitWebLabel(host: GitHoverHost, t: (key: GitHoverWebKey) => string): string {
  if (host === 'github') return t('git.openOnGitHub')
  if (host === 'gitlab') return t('git.openOnGitLab')
  if (host === 'gitee') return t('git.openOnGitee')
  return t('git.openOnRemote')
}

/**
 * Flip the card so it stays inside the viewport.
 * @param anchor - hovered row rect.
 * @param card - measured card size.
 * @param viewport - window inner size.
 */
export function gitHoverPosition(
  anchor: { left: number; right: number; top: number; bottom: number },
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): { x: number; y: number } {
  const gap = 8
  const margin = 12
  let x = anchor.right + gap
  if (x + card.width > viewport.width - margin) x = anchor.left - card.width - gap
  if (x < margin) x = margin
  let y = anchor.top
  if (y + card.height > viewport.height - margin) y = viewport.height - margin - card.height
  if (y < margin) y = margin
  return { x, y }
}

function gitRemoteHttpBase(originUrl: string): { origin: string; host: string; path: string } | undefined {
  const raw = originUrl.trim()
  if (raw.length === 0) return undefined
  const ssh = /^git@([^:]+):(.+)$/.exec(raw)
  if (ssh?.[1] !== undefined && ssh[2] !== undefined) {
    return { origin: `https://${ssh[1]}`, host: ssh[1], path: `/${ssh[2]}` }
  }
  const scp = /^ssh:\/\/(?:git@)?([^/]+)(\/.+)$/.exec(raw)
  if (scp?.[1] !== undefined && scp[2] !== undefined) {
    return { origin: `https://${scp[1]}`, host: scp[1], path: scp[2] }
  }
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return { origin: url.origin, host: url.hostname, path: url.pathname }
  }
  catch {
    return undefined
  }
}
