/**
 * Apply one D7 file-tool touch to the files store. Seq-gated so replay
 * that walks backward does not refresh again.
 * @param files - shared explorer/editor store.
 * @param lastSeq - last applied event seq.
 * @param seq - incoming event seq.
 * @param refresh - paths that should reload the tree.
 * @param reload - mutated paths that should banner open editors.
 * @returns the next lastSeq.
 */
export function noteFsTouch(
  files: { bumpRefresh: () => void; markReload: (paths: readonly string[]) => void },
  lastSeq: number,
  seq: number,
  refresh: readonly string[],
  reload: readonly string[],
): number {
  if (seq <= lastSeq) return lastSeq
  if (refresh.length > 0) files.bumpRefresh()
  if (reload.length > 0) files.markReload(reload)
  return seq
}
