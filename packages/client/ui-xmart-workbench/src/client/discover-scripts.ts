/**
 * Discover runnable check scripts from a root package.json + lockfile hints.
 */

export type CheckKind = 'typecheck' | 'lint' | 'test' | 'build'

/** Package manager used to invoke `run <script>`. */
export type PackageManager = 'pnpm' | 'npm' | 'yarn'

/** One discovered check script. */
export type DiscoveredCheck = {
  /** Stable kind used in the UI and problem `source`. */
  kind: CheckKind
  /** Exact script name from package.json. */
  script: string
}

const CANDIDATES: Record<CheckKind, readonly string[]> = {
  typecheck: ['typecheck', 'tsc', 'check:types'],
  lint: ['lint', 'oxlint', 'eslint'],
  test: ['test', 'test:unit', 'vitest'],
  build: ['build'],
}

const KIND_ORDER: readonly CheckKind[] = ['typecheck', 'lint', 'test', 'build']

/**
 * Pick the first matching script name for each check kind.
 * @param scripts - package.json `scripts` map (may be missing).
 */
export function discoverCheckScripts(
  scripts: Readonly<Record<string, string>> | null | undefined,
): readonly DiscoveredCheck[] {
  if (scripts === undefined || scripts === null) return []
  const out: DiscoveredCheck[] = []
  for (const kind of KIND_ORDER) {
    for (const name of CANDIDATES[kind]) {
      if (Object.prototype.hasOwnProperty.call(scripts, name)) {
        out.push({ kind, script: name })
        break
      }
    }
  }
  return out
}

/**
 * Infer the package manager from lockfile basenames present in the workspace root.
 * @param entries - file basenames in the workspace root (e.g. from listEntries).
 */
export function detectPackageManager(entries: readonly string[]): PackageManager {
  const set = new Set(entries)
  if (set.has('pnpm-lock.yaml')) return 'pnpm'
  if (set.has('yarn.lock')) return 'yarn'
  return 'npm'
}

/**
 * Build argv for `<pm> run <script> [-- extra…]` (no shell).
 * @param pm - package manager.
 * @param script - script name.
 * @param extraArgs - optional args after `--`.
 */
export function buildRunArgv(
  pm: PackageManager,
  script: string,
  extraArgs: readonly string[] = [],
): readonly string[] {
  const bin = pm === 'yarn' ? 'yarn' : pm
  const base = [bin, 'run', script]
  if (extraArgs.length === 0) return base
  return [...base, '--', ...extraArgs]
}
