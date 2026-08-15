/**
 * Start language servers when a project folder is opened, before any
 * source tab mounts. Failures stay silent — the first file still retries.
 */
import { useEffect } from 'react'
import type { FileListing } from '@deepseek-ai/dsh-client-runtime/client'
import {
  clearLanguageWarmingKey,
  markLanguageWarmedKey,
  markLanguageWarmingKey,
  type EditorLspRemotes,
} from './editor-lsp.ts'
import {
  collectWarmProjects,
  remotesForLanguages,
  rootKey,
  seedLanguageServer,
  uniqueWarmRoots,
} from './editor-lsp-warmup.ts'
import type { ExplorerRoot } from './explorer-roots.ts'

/** Session-level language-server preload (see module doc). */
export function EditorLspWarmup({
  getRemotes, getWorkspaceRoot, getRoots, watchWorkspace, listEntries, readFile,
}: {
  getRemotes?: () => EditorLspRemotes
  getWorkspaceRoot?: (filePath?: string) => string | undefined
  getRoots?: () => readonly ExplorerRoot[]
  watchWorkspace?: (fn: () => void) => () => void
  listEntries?: (path: string, signal?: AbortSignal) => Promise<FileListing>
  readFile?: (path: string, signal?: AbortSignal) => Promise<string>
}): null {
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const started = new Set<string>()

    const starts = (): string[] => {
      let cwd: string | undefined
      let explorer: readonly string[] = []
      try {
        cwd = getWorkspaceRoot?.()
      }
      catch {
        cwd = undefined
      }
      try {
        explorer = getRoots?.().map(root => root.path) ?? []
      }
      catch {
        explorer = []
      }
      return uniqueWarmRoots([cwd, ...explorer])
    }

    const pending = (): boolean => {
      if (getRemotes === undefined) return false
      const remotes = getRemotes()
      return remotes.javaLsp === undefined && remotes.tsLsp === undefined && remotes.vueLsp === undefined
    }

    const stopWarming = (): void => {
      clearLanguageWarmingKey('java')
      clearLanguageWarmingKey('ts')
      clearLanguageWarmingKey('vue')
    }

    const run = (): void => {
      const remotes = getRemotes?.() ?? {}
      if (remotes.javaLsp !== undefined) markLanguageWarmingKey('java')
      if (remotes.tsLsp !== undefined) markLanguageWarmingKey('ts')
      if (remotes.vueLsp !== undefined) markLanguageWarmingKey('vue')
      void collectWarmProjects(starts(), listEntries, readFile, controller.signal).then((projects) => {
        if (cancelled) return
        const needed = new Set<string>()
        for (const project of projects) {
          for (const { language, remote } of remotesForLanguages(project.languages, remotes)) {
            if (typeof remote.warmup !== 'function') continue
            needed.add(language)
            const key = `${rootKey(project.root)}\0${language}`
            if (started.has(key)) continue
            started.add(key)
            markLanguageWarmingKey(language)
            void remote.warmup({ workspaceRoot: project.root }).then(
              async (result) => {
                if (!result.ok) {
                  clearLanguageWarmingKey(language)
                  return
                }
                await seedLanguageServer(
                  project, language, remote, listEntries, readFile, controller.signal,
                )
                if (!cancelled) markLanguageWarmedKey(language)
              },
              () => { clearLanguageWarmingKey(language) },
            )
          }
        }
        for (const language of ['java', 'ts', 'vue'] as const) {
          if (!needed.has(language)) clearLanguageWarmingKey(language)
        }
      })
    }

    run()
    const off = watchWorkspace?.(run)
    if (!pending()) {
      return () => {
        cancelled = true
        controller.abort()
        stopWarming()
        off?.()
      }
    }
    const id = window.setInterval(() => {
      run()
      if (!pending()) window.clearInterval(id)
    }, 400)
    const stop = window.setTimeout(() => { window.clearInterval(id) }, 20_000)
    return () => {
      cancelled = true
      controller.abort()
      stopWarming()
      off?.()
      window.clearInterval(id)
      window.clearTimeout(stop)
    }
  }, [getRemotes, getRoots, getWorkspaceRoot, listEntries, readFile, watchWorkspace])

  return null
}
