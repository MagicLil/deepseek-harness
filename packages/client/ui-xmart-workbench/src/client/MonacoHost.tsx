/**
 * Monaco widget seat. The owner keys this component by file path so one
 * editor+model pair lives as long as one opened file.
 */
import { useEffect, useRef, useState } from 'react'
import { loadMonaco, type Monaco } from './monaco-loader.ts'
import { languageFromPath } from './language-from-path.ts'
import type { EditorLanguageClient } from './editor-lsp.ts'
import css from './MonacoHost.module.css'

const LSP_CHANGE_DEBOUNCE_MS = 300
const LSP_DIAGNOSTICS_POLL_MS = 1500

/** Localized copy for the engine boot states. */
export interface MonacoHostLabels {
  loading: string
  error: string
}

/** Monaco host props. */
export function MonacoHost({ initialValue, filePath, labels, onChange, onSave, languageClient }: {
  initialValue: string
  filePath: string
  labels: MonacoHostLabels
  onChange: (content: string) => void
  onSave: () => void
  languageClient?: EditorLanguageClient
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const initialRef = useRef({ value: initialValue, path: filePath })
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  const languageClientRef = useRef(languageClient)
  languageClientRef.current = languageClient

  useEffect(() => {
    let disposed = false
    const cleanups: Array<() => void> = []
    loadMonaco().then(
      (monaco) => {
        try {
          const host = hostRef.current
          /* v8 ignore next -- the ref is bound before the async boot settles. */
          if (disposed || host === null) return
          const language = languageFromPath(initialRef.current.path)
          const uri = monaco.Uri.file(initialRef.current.path.replaceAll('\\', '/'))
          const existing = monaco.editor.getModel(uri)
          const model = existing ?? monaco.editor.createModel(initialRef.current.value, language, uri)
          if (existing !== null) {
            monaco.editor.setModelLanguage(existing, language)
            if (existing.getValue() !== initialRef.current.value) existing.setValue(initialRef.current.value)
          }
          cleanups.push(() => { model.dispose() })
          const editor = monaco.editor.create(host, {
            model,
            theme: darkTheme() ? 'vs-dark' : 'vs',
            automaticLayout: true,
            fontSize: 13,
            fontFamily: 'Cascadia Code, JetBrains Mono, Consolas, monospace',
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            padding: { bottom: 16 },
          })
          cleanups.push(() => { editor.dispose() })
          const contentSub = model.onDidChangeContent(() => { onChangeRef.current(model.getValue()) })
          cleanups.push(() => { contentSub.dispose() })
          if (languageClientRef.current !== undefined) {
            cleanups.push(...bindLanguageClient(monaco, model, initialRef.current.path, languageClientRef))
          }
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { onSaveRef.current() })
          const observer = new MutationObserver(() => {
            monaco.editor.setTheme(darkTheme() ? 'vs-dark' : 'vs')
          })
          observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
          cleanups.push(() => { observer.disconnect() })
          editor.focus()
          setPhase('ready')
        }
        catch {
          setPhase('error')
        }
      },
      () => {
        if (!disposed) setPhase('error')
      },
    )
    return () => {
      disposed = true
      for (const cleanup of cleanups.reverse()) cleanup()
    }
  }, [])

  return (
    <div className={css.wrap} data-testid="xmart-workbench-monaco" data-ready={phase === 'ready' || undefined}>
      {phase !== 'ready' && (
        <div className={css.note} data-state={phase}>
          {phase === 'loading' ? labels.loading : labels.error}
        </div>
      )}
      <div ref={hostRef} className={css.host} />
    </div>
  )
}

/** Whether the app currently renders its dark appearance. */
export function darkTheme(): boolean {
  return document.body.hasAttribute('data-ds-dark-theme')
}

function markerSeverity(monaco: Monaco, severity: number): number {
  if (severity === 1) return monaco.MarkerSeverity.Error
  if (severity === 2) return monaco.MarkerSeverity.Warning
  if (severity === 3) return monaco.MarkerSeverity.Info
  return monaco.MarkerSeverity.Hint
}

function bindLanguageClient(
  monaco: Monaco,
  model: ReturnType<Monaco['editor']['createModel']>,
  filePath: string,
  languageClientRef: { current: EditorLanguageClient | undefined },
): Array<() => void> {
  const cleanups: Array<() => void> = []
  const client = languageClientRef.current
  /* v8 ignore next -- the caller already checked the ref. */
  if (client === undefined) return cleanups

  const paint = (): void => {
    const live = languageClientRef.current
    /* v8 ignore next -- unmount clears the ref before a late poll. */
    if (live === undefined) return
    void live.diagnostics(filePath).then((items) => {
      monaco.editor.setModelMarkers(model, 'editor-lsp', items.map(item => ({
        message: item.message,
        severity: markerSeverity(monaco, item.severity),
        startLineNumber: item.startLine + 1,
        startColumn: item.startCharacter + 1,
        endLineNumber: item.endLine + 1,
        endColumn: item.endCharacter + 1,
        ...(item.source === undefined ? {} : { source: item.source }),
      })))
    }, () => {})
  }

  /* v8 ignore start -- a failed open is silent; the user can still type. */
  void client.open(filePath, model.getValue()).then(paint, () => {})
  /* v8 ignore stop */
  /* v8 ignore next -- close is best-effort on unmount. */
  cleanups.push(() => { void languageClientRef.current?.close(filePath).catch(() => {}) })

  let debounce: ReturnType<typeof setTimeout> | null = null
  const changeSub = model.onDidChangeContent(() => {
    if (debounce !== null) clearTimeout(debounce)
    debounce = setTimeout(() => {
      debounce = null
      const live = languageClientRef.current
      /* v8 ignore next -- unmount can win the debounce. */
      if (live === undefined) return
      /* v8 ignore next -- a failed change is silent. */
      void live.change(filePath, model.getValue()).then(paint, () => {})
    }, LSP_CHANGE_DEBOUNCE_MS)
  })
  cleanups.push(() => {
    /* v8 ignore next -- a pending debounce is cleared on unmount. */
    if (debounce !== null) clearTimeout(debounce)
    changeSub.dispose()
  })

  const poll = setInterval(paint, LSP_DIAGNOSTICS_POLL_MS)
  cleanups.push(() => { clearInterval(poll) })

  const completion = monaco.languages.registerCompletionItemProvider(languageFromPath(filePath), {
    triggerCharacters: ['.', '<', '"', "'", '/', '@'],
    provideCompletionItems: (_current, position) => {
      const live = languageClientRef.current
      /* v8 ignore next -- the provider can fire after unmount. */
      if (live === undefined) return { suggestions: [] }
      return live.complete(filePath, position.lineNumber - 1, position.column - 1).then(items => ({
        suggestions: items.map(item => ({
          label: item.label,
          kind: item.kind ?? monaco.languages.CompletionItemKind.Text,
          insertText: item.insertText ?? item.label,
          ...(item.detail === undefined ? {} : { detail: item.detail }),
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
        })),
      }), () => ({ suggestions: [] }))
    },
  })
  cleanups.push(() => { completion.dispose() })
  return cleanups
}
