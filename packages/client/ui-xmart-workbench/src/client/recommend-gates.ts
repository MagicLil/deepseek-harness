/**
 * Recommend which discovered check scripts to run for the current dirty set.
 */
import {
  buildRunArgv,
  type CheckKind,
  type DiscoveredCheck,
  type PackageManager,
} from './discover-scripts.ts'
import { relatedExtraArgs, shouldSkipRelated } from './related-args.ts'

/** One recommended or skipped gate row. */
export type GateRecommendation = {
  kind: CheckKind
  script: string
  command: string
  recommended: boolean
}

/**
 * Map discovered scripts to preview commands and a related-mode recommendation.
 * @param discovered - scripts from the root package.json.
 * @param dirtyPaths - staged + unstaged repo-relative paths.
 * @param packageManager - lockfile-inferred runner.
 */
export function recommendGates(
  discovered: readonly DiscoveredCheck[],
  dirtyPaths: readonly string[],
  packageManager: PackageManager,
): readonly GateRecommendation[] {
  return discovered.map((item) => {
    const skip = shouldSkipRelated(item.kind, dirtyPaths)
    const extras = skip ? [] : relatedExtraArgs(item.kind, dirtyPaths)
    return {
      kind: item.kind,
      script: item.script,
      command: buildRunArgv(packageManager, item.script, extras).join(' '),
      recommended: !skip,
    }
  })
}

/**
 * Kinds the pre-commit loop should run (not skipped as unrelated).
 * @param gates - recommendation rows.
 */
export function recommendedKinds(gates: readonly GateRecommendation[]): CheckKind[] {
  return gates.filter(gate => gate.recommended).map(gate => gate.kind)
}
