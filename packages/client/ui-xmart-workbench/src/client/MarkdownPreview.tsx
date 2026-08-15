/**
 * Live Markdown preview using the conversation renderer.
 */
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './MarkdownPreview.module.css'

/** Markdown preview pane. */
export function MarkdownPreview({ text }: { text: string }) {
  return (
    <div className={css.pane} data-testid="xmart-workbench-md-preview">
      <div className={css.body}>
        <MarkdownText text={text} />
      </div>
    </div>
  )
}
