/**
 * Live Markdown preview: the conversation renderer (`MarkdownText`) over the
 * editor buffer so .md files get the same GFM / math / fenced-code treatment
 * the chat already ships.
 */
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './MarkdownPreview.module.css'

export function MarkdownPreview({ text }: { text: string }) {
  return (
    <div className={css.pane}>
      <div className={css.body}>
        <MarkdownText text={text} />
      </div>
    </div>
  )
}
