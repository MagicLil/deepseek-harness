/**
 * Build extra argv for “related to dirty files” check runs.
 */
import type { CheckKind } from './discover-scripts.ts'

/**
 * Extra args after `--` for a related-mode run. Empty means run the script as-is.
 * @param kind - check kind.
 * @param relatedPaths - repo-relative dirty paths (posix separators preferred).
 */
export function relatedExtraArgs(kind: CheckKind, relatedPaths: readonly string[]): readonly string[] {
  if (relatedPaths.length === 0) return []
  const posix = relatedPaths.map(p => p.replace(/\\/g, '/'))
  if (kind === 'lint') {
    return posix.filter(p => /\.(?:[cm]?[jt]sx?|vue)$/i.test(p))
  }
  if (kind === 'test') {
    const tests = posix.filter(p => /\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(p))
    if (tests.length > 0) return tests
    const sources = posix.filter(p => /\.[cm]?[jt]sx?$/i.test(p) && !p.includes('node_modules'))
    if (sources.length === 0) return []
    return ['related', ...sources]
  }
  return []
}

/**
 * Whether a related-mode run should skip this kind entirely (nothing relevant).
 * @param kind - check kind.
 * @param relatedPaths - dirty paths.
 */
export function shouldSkipRelated(kind: CheckKind, relatedPaths: readonly string[]): boolean {
  if (relatedPaths.length === 0) return false
  if (kind === 'typecheck' || kind === 'build') {
    return !relatedPaths.some(p => /\.[cm]?[jt]sx?$/i.test(p) || p.endsWith('.vue'))
  }
  if (kind === 'lint') return relatedExtraArgs('lint', relatedPaths).length === 0
  if (kind === 'test') {
    return !relatedPaths.some(p => /\.[cm]?[jt]sx?$/i.test(p))
  }
  return false
}
