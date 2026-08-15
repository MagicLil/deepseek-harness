/**
 * MonacoHost: the VSCode editor core (Monaco) widget seat. The owner keys
 * this component by file path, so one editor+model pair lives exactly as long
 * as one opened file; props are captured at mount (a keyed remount is the
 * file-switch path). The model URI carries the real file path, so Monaco's
 * own language registry picks the grammar and language services (TS/JS/CSS/
 * HTML/JSON come with the bundle). Themes follow the app appearance through
 * Monaco's built-in `vs`/`vs-dark` pair keyed off `data-ds-dark-theme`.
 */
import { useEffect, useRef, useState } from 'react'
import { loadMonaco } from './monaco-loader.ts'
import { EDITOR_DARK_THEME, EDITOR_LIGHT_THEME, prepareMonacoHighlight } from './monaco-highlight.ts'
import css from './MonacoHost.module.css'

/** Localized copy for the engine boot states (threaded from the owner's locale seat). */
export interface MonacoHostLabels {
  loading: string
  error: string
}

export function MonacoHost({ initialValue, filePath, labels, onChange, onSave }: {
  /** Document content at mount (the owner remounts by key on file switch). */
  initialValue: string
  /** Absolute host file path: model identity and grammar selection. */
  filePath: string
  labels: MonacoHostLabels
  /** Fires with the whole document after every edit. */
  onChange: (content: string) => void
  /** Fires on Ctrl/Cmd-S inside the editor. */
  onSave: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  // Mount captures (keyed remount semantics); callbacks stay current via refs.
  const initialRef = useRef({ value: initialValue, path: filePath })
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  useEffect(() => {
    let disposed = false
    // Reverse-run teardown ledger: entries push in creation order.
    const cleanups: Array<() => void> = []
    loadMonaco().then(
      async (monaco) => {
        const host = hostRef.current
        /* v8 ignore next -- the ref is bound before the async boot settles. */
        if (disposed || host === null) return
        const language = await prepareMonacoHighlight(monaco, initialRef.current.path)
        if (disposed || hostRef.current === null) return
        const uri = monaco.Uri.file(initialRef.current.path.replaceAll('\\', '/'))
        // A leftover model for this path (aborted teardown) is reset instead
        // of recreated: two models on one URI throw.
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
          automaticLayout: true,
          fontSize: 13,
          fontFamily: 'Cascadia Code, JetBrains Mono, Consolas, monospace',
          fontLigatures: true,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          padding: { bottom: 16 },
          bracketPairColorization: { enabled: true },
          renderLineHighlight: 'all',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
        })
        cleanups.push(() => { editor.dispose() })
        const contentSub = model.onDidChangeContent(() => { onChangeRef.current(model.getValue()) })
        cleanups.push(() => { contentSub.dispose() })
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { onSaveRef.current() })
        // Theme flips arrive as a body attribute toggle (ui-theme's presenter).
        const observer = new MutationObserver(() => {
          monaco.editor.setTheme(darkTheme() ? EDITOR_DARK_THEME : EDITOR_LIGHT_THEME)
        })
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
        cleanups.push(() => { observer.disconnect() })
        editor.focus()
        setPhase('ready')
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
    <div className={css.wrap}>
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
function darkTheme(): boolean {
  return document.body.hasAttribute('data-ds-dark-theme')
}
