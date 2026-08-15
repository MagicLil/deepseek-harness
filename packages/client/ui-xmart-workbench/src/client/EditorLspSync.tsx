/**
 * Keep a language-server document open for every supported editor tab,
 * not just the file currently painted by Monaco.
 */
import { useEffect, useRef } from 'react'
import {
  languageClientFor, markLanguageWarmed, missingLanguageRemote,
  type EditorLanguageClient, type EditorLspRemotes,
} from './editor-lsp.ts'
import { editorLspPaths, lspDocsToClose, lspOpenText } from './editor-lsp-sync.ts'
import type { WorkbenchFilesStore } from './files-store.ts'
import type { WorkbenchTab } from './types.ts'

function closeDoc(opened: Map<string, EditorLanguageClient>, path: string): void {
  const client = opened.get(path)
  opened.delete(path)
  /* v8 ignore next -- keys() only yields entries we inserted. */
  if (client === undefined) return
  void client.close(path).catch(() => {})
}

/** Session-level language-document sync (see module doc). */
export function EditorLspSync({
  tabs, getRemotes, getWorkspaceRoot, watchWorkspace, readFile, files,
}: {
  tabs: readonly WorkbenchTab[]
  getRemotes?: () => EditorLspRemotes
  getWorkspaceRoot?: (filePath?: string) => string | undefined
  watchWorkspace?: (fn: () => void) => () => void
  readFile?: (path: string, signal?: AbortSignal) => Promise<string>
  files?: WorkbenchFilesStore
}): null {
  const wanted = editorLspPaths(tabs)
  const wantedKey = wanted.join('\0')
  const opened = useRef(new Map<string, EditorLanguageClient>())

  useEffect(() => () => {
    for (const path of [...opened.current.keys()]) closeDoc(opened.current, path)
  }, [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const sync = (): void => {
      const remotes = getRemotes?.() ?? {}
      for (const path of lspDocsToClose([...opened.current.keys()], wanted)) {
        closeDoc(opened.current, path)
      }
      for (const path of wanted) {
        if (opened.current.has(path)) continue
        let root: string | undefined
        try {
          root = getWorkspaceRoot?.(path)
        }
        catch {
          root = undefined
        }
        const client = languageClientFor(remotes, root, path)
        if (client === undefined) continue
        opened.current.set(path, client)
        const draft = files?.draftOf(path)
        void lspOpenText(path, draft, readFile, controller.signal).then((text) => {
          if (cancelled || !opened.current.has(path)) return
          return client.open(path, text).then(() => { markLanguageWarmed(path) }, () => {})
        })
      }
    }

    sync()
    const off = watchWorkspace?.(sync)
    const pending = (): boolean => {
      const remotesOf = getRemotes
      return remotesOf !== undefined && wanted.some(path => missingLanguageRemote(remotesOf(), path))
    }
    if (getRemotes === undefined || wanted.length === 0 || !pending()) {
      return () => {
        cancelled = true
        controller.abort()
        off?.()
      }
    }
    const id = window.setInterval(() => {
      sync()
      if (!pending()) window.clearInterval(id)
    }, 400)
    const stop = window.setTimeout(() => { window.clearInterval(id) }, 20_000)
    return () => {
      cancelled = true
      controller.abort()
      off?.()
      window.clearInterval(id)
      window.clearTimeout(stop)
    }
  }, [files, getRemotes, getWorkspaceRoot, readFile, wantedKey, watchWorkspace])

  return null
}
