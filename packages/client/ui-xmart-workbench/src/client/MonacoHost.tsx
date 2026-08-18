/**
 * Monaco widget seat. The owner keys this component by file path so one
 * editor+model pair lives as long as one opened file.
 */
import { useEffect, useRef, useState } from 'react'
import type { IPosition, IRange, Uri } from 'monaco-editor'
import { loadMonaco, type Monaco } from './monaco-loader.ts'
import { languageFromPath } from './language-from-path.ts'
import { EDITOR_DARK_THEME, EDITOR_LIGHT_THEME, prepareMonacoHighlight } from './monaco-highlight.ts'
import type { EditorHover, EditorLanguageClient, EditorLocation } from './editor-lsp.ts'
import { hoverWhenReady, markLanguageWarmed, shouldSuppressLspStarting } from './editor-lsp.ts'
import { fileUrlToPath, normalizeEditorPath, requestReveal, subscribeReveal, takeReveal } from './editor-nav.ts'
import {
  WORKBENCH_EDITOR_ACTION_EVENT, WORKBENCH_FIND_EVENT, WORKBENCH_REPLACE_EVENT,
} from './app-menu-dispatch.ts'
import { bindEditorLayout } from './editor-layout.ts'
import css from './MonacoHost.module.css'

const LSP_CHANGE_DEBOUNCE_MS = 300
const LSP_DIAGNOSTICS_POLL_MS = 1500

/** Localized copy for the engine boot states. */
export interface MonacoHostLabels {
  loading: string
  error: string
  /** Shown when definition lands on a jar / `jdt://` / `.class` with no disk source. */
  noSource?: string
  /** Shown while the language server is starting or downloading. */
  lspStarting?: string
  /** Shown when the language server fails to start. */
  lspFailed?: string
}

/** Monaco host props. */
export function MonacoHost({ initialValue, filePath, labels, onChange, onSave, languageClient, onOpenFile }: {
  initialValue: string
  filePath: string
  labels: MonacoHostLabels
  onChange: (content: string) => void
  onSave: () => void
  languageClient?: EditorLanguageClient
  onOpenFile?: (path: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [navNote, setNavNote] = useState<string | null>(null)
  const initialRef = useRef({ value: initialValue, path: filePath })
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  const languageClientRef = useRef(languageClient)
  languageClientRef.current = languageClient
  const onOpenFileRef = useRef(onOpenFile)
  onOpenFileRef.current = onOpenFile
  const noSourceRef = useRef(labels.noSource)
  noSourceRef.current = labels.noSource

  useEffect(() => {
    let disposed = false
    const cleanups: Array<() => void> = []
    loadMonaco().then(
      async (monaco) => {
        try {
          const host = hostRef.current
          /* v8 ignore next -- the ref is bound before the async boot settles. */
          if (disposed || host === null) return
          const language = await prepareMonacoHighlight(monaco, initialRef.current.path)
          /* v8 ignore start -- unmount can win the highlight boot. */
          if (disposed || hostRef.current === null) return
          /* v8 ignore stop */
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
            theme: darkTheme() ? EDITOR_DARK_THEME : EDITOR_LIGHT_THEME,
            automaticLayout: false,
            fixedOverflowWidgets: true,
            fontSize: 13,
            fontFamily: 'Cascadia Code, JetBrains Mono, Consolas, monospace',
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            padding: { bottom: 16 },
            links: false,
            hover: { delay: 400, sticky: true },
          })
          cleanups.push(() => { editor.dispose() })
          cleanups.push(bindEditorLayout(editor, host))
          const contentSub = model.onDidChangeContent(() => { onChangeRef.current(model.getValue()) })
          cleanups.push(() => { contentSub.dispose() })
          if (languageClientRef.current !== undefined) {
            cleanups.push(...bindLanguageClient(
              monaco,
              model,
              initialRef.current.path,
              languageClientRef,
              onOpenFileRef,
              () => { setNavNote(noSourceRef.current ?? '') },
              setNavNote,
              labels.lspStarting,
              labels.lspFailed,
            ))
          }
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { onSaveRef.current() })
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.F12, () => {
            void editor.getAction('editor.action.goToImplementation')?.run()
          })
          const mouse = editor.onMouseDown((event) => {
            if (!event.event.leftButton) return
            if (!(event.event.ctrlKey || event.event.metaKey)) return
            void editor.getAction('editor.action.revealDefinition')?.run()
          })
          cleanups.push(() => { mouse.dispose() })
          const applyReveal = (): void => {
            const reveal = takeReveal(initialRef.current.path)
            if (reveal === undefined) return
            const lineNumber = reveal.line + 1
            const startColumn = reveal.character + 1
            const endColumn = (reveal.end ?? reveal.character) + 1
            const range = {
              startLineNumber: lineNumber,
              startColumn,
              endLineNumber: lineNumber,
              endColumn: Math.max(endColumn, startColumn),
            }
            editor.setSelection(range)
            editor.revealRangeInCenter(range)
          }
          applyReveal()
          cleanups.push(subscribeReveal(applyReveal))
          const runAction = (id: string): void => {
            const action = editor.getAction(id)
            void action?.run()
          }
          const onFind = (): void => { runAction('actions.find') }
          const onReplace = (): void => { runAction('editor.action.startFindReplaceAction') }
          const onEditorAction = (event: Event): void => {
            const id = 'detail' in event ? Reflect.get(event, 'detail') : undefined
            if (typeof id === 'string' && id !== '') runAction(id)
          }
          window.addEventListener(WORKBENCH_FIND_EVENT, onFind)
          window.addEventListener(WORKBENCH_REPLACE_EVENT, onReplace)
          window.addEventListener(WORKBENCH_EDITOR_ACTION_EVENT, onEditorAction)
          cleanups.push(() => {
            window.removeEventListener(WORKBENCH_FIND_EVENT, onFind)
            window.removeEventListener(WORKBENCH_REPLACE_EVENT, onReplace)
            window.removeEventListener(WORKBENCH_EDITOR_ACTION_EVENT, onEditorAction)
          })
          const observer = new MutationObserver(() => {
            monaco.editor.setTheme(darkTheme() ? EDITOR_DARK_THEME : EDITOR_LIGHT_THEME)
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
      {navNote !== null && navNote !== '' && (
        <div className={css.navNote} data-testid="xmart-workbench-nav-note">{navNote}</div>
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
  onOpenFileRef: { current: ((path: string) => void) | undefined },
  onNoSource: () => void,
  onNote: (note: string | null) => void,
  lspStarting: string | undefined,
  lspFailed: string | undefined,
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

  if (!shouldSuppressLspStarting(filePath) && lspStarting !== undefined && lspStarting !== '') onNote(lspStarting)
  void client.open(filePath, model.getValue()).then(
    () => {
      markLanguageWarmed(filePath)
      onNote(null)
      paint()
    },
    (error: unknown) => { onNote(lspFailNote(lspFailed, error)) },
  )
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

  const language = languageFromPath(filePath)
  const completion = monaco.languages.registerCompletionItemProvider(language, {
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

  const definition = monaco.languages.registerDefinitionProvider(language, {
    provideDefinition: (_current, position) => {
      const live = languageClientRef.current
      /* v8 ignore next -- the provider can fire after unmount. */
      if (live === undefined) return []
      return live.definition(filePath, position.lineNumber - 1, position.column - 1).then((items) => {
        const mapped = mapFileLocations(monaco, items)
        if (items.length > 0 && mapped.length === 0) onNoSource()
        return mapped
      }, () => [])
    },
  })
  cleanups.push(() => { definition.dispose() })

  const hover = monaco.languages.registerHoverProvider(language, {
    provideHover: (_current, position) => {
      const live = languageClientRef.current
      /* v8 ignore next -- the provider can fire after unmount. */
      if (live === undefined) return null
      return hoverWhenReady(live, filePath, position.lineNumber - 1, position.column - 1).then((card) => {
        if (card === undefined) return null
        return { contents: [{ value: card.contents }], ...hoverRange(card) }
      }, () => null)
    },
  })
  cleanups.push(() => { hover.dispose() })

  const references = monaco.languages.registerReferenceProvider(language, {
    provideReferences: (_current, position) => {
      const live = languageClientRef.current
      /* v8 ignore next -- the provider can fire after unmount. */
      if (live === undefined) return []
      return live.references(filePath, position.lineNumber - 1, position.column - 1).then(
        items => mapFileLocations(monaco, items),
        () => [],
      )
    },
  })
  cleanups.push(() => { references.dispose() })

  const implementation = monaco.languages.registerImplementationProvider(language, {
    provideImplementation: (_current, position) => {
      const live = languageClientRef.current
      /* v8 ignore next -- the provider can fire after unmount. */
      if (live === undefined) return []
      return live.implementation(filePath, position.lineNumber - 1, position.column - 1).then(
        items => mapFileLocations(monaco, items),
        () => [],
      )
    },
  })
  cleanups.push(() => { implementation.dispose() })

  const opener = monaco.editor.registerEditorOpener({
    openCodeEditor: (_source, resource, selectionOrPosition) => {
      const uri = hrefOf(resource)
      const path = fileUrlToPath(uri) ?? monacoResourcePath(resource.path)
      if (path === undefined) {
        onNoSource()
        return true
      }
      if (normalizeEditorPath(path) === normalizeEditorPath(filePath)) return false
      requestReveal(path, revealFromSelection(selectionOrPosition))
      onOpenFileRef.current?.(path)
      return true
    },
  })
  cleanups.push(() => { opener.dispose() })
  return cleanups
}

/** `toString` is missing on some test doubles and virtual resources. */
function hrefOf(resource: Uri): string {
  const toString = Reflect.get(resource, 'toString')
  if (typeof toString !== 'function') return ''
  const href: unknown = toString.call(resource)
  return typeof href === 'string' ? href : ''
}

/** Keep `file:` locations; drop jars and language-server virtual URIs. */
function mapFileLocations(monaco: Monaco, items: readonly EditorLocation[]): Array<{
  uri: Uri
  range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }
}> {
  const mapped: Array<{
    uri: Uri
    range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }
  }> = []
  for (const item of items) {
    const path = fileUrlToPath(item.uri)
    if (path === undefined) continue
    mapped.push({
      uri: monaco.Uri.file(path.replaceAll('\\', '/')),
      range: {
        startLineNumber: item.startLine + 1,
        startColumn: item.startCharacter + 1,
        endLineNumber: item.endLine + 1,
        endColumn: item.endCharacter + 1,
      },
    })
  }
  return mapped
}

/** Zero-based reveal from a Monaco range or caret. */
function revealFromSelection(selectionOrPosition: IRange | IPosition | undefined): {
  line: number
  character: number
} {
  if (selectionOrPosition === undefined) return { line: 0, character: 0 }
  if ('startLineNumber' in selectionOrPosition) {
    return {
      line: selectionOrPosition.startLineNumber - 1,
      character: selectionOrPosition.startColumn - 1,
    }
  }
  return {
    line: selectionOrPosition.lineNumber - 1,
    character: selectionOrPosition.column - 1,
  }
}

/** Show the host error under the generic banner so Java-8 vs missing JDT is visible. */
export function lspFailNote(fallback: string | undefined, error: unknown): string | null {
  if (fallback === undefined || fallback === '') return null
  const detail = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return detail === '' ? fallback : `${fallback}（${detail}）`
}

/** Best-effort path from a Monaco resource when `toString()` is not a `file:` URI. */
function monacoResourcePath(path: string | undefined): string | undefined {
  if (path === undefined || path === '') return undefined
  if (/^\/[A-Za-z]:/.test(path)) return path.slice(1).replaceAll('/', '\\')
  return path
}

/** Monaco hover range when the language server sent one. */
function hoverRange(card: EditorHover): { range?: {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
} } {
  if (card.startLine === undefined || card.startCharacter === undefined
    || card.endLine === undefined || card.endCharacter === undefined) {
    return {}
  }
  return {
    range: {
      startLineNumber: card.startLine + 1,
      startColumn: card.startCharacter + 1,
      endLineNumber: card.endLine + 1,
      endColumn: card.endCharacter + 1,
    },
  }
}
