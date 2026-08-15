/**
 * Monaco widget seat. The owner keys this component by file path so one
 * editor+model pair lives as long as one opened file.
 */
import { useEffect, useRef, useState } from 'react'
import { loadMonaco } from './monaco-loader.ts'
import { languageFromPath } from './language-from-path.ts'
import css from './MonacoHost.module.css'

/** Localized copy for the engine boot states. */
export interface MonacoHostLabels {
  loading: string
  error: string
}

/** Monaco host props. */
export function MonacoHost({ initialValue, filePath, labels, onChange, onSave }: {
  initialValue: string
  filePath: string
  labels: MonacoHostLabels
  onChange: (content: string) => void
  onSave: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const initialRef = useRef({ value: initialValue, path: filePath })
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  useEffect(() => {
    let disposed = false
    const cleanups: Array<() => void> = []
    loadMonaco().then(
      (monaco) => {
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
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { onSaveRef.current() })
        const observer = new MutationObserver(() => {
          monaco.editor.setTheme(darkTheme() ? 'vs-dark' : 'vs')
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
    <div className={css.wrap} data-testid="xmart-workbench-monaco">
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
