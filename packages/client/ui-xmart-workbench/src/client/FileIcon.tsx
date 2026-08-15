/**
 * Colored Material Icon Theme glyph for a file or folder name.
 */
import { iconDataUri, iconSvg, resolveIconId, type FileIconKind } from './file-icon.ts'
import css from './FileIcon.module.css'

/** Decorative file/folder glyph. */
export type FileIconProps = {
  path: string
  kind: FileIconKind
  expanded?: boolean
  size?: number
}

/** 16px file/folder icon (see module doc). */
export function FileIcon({ path, kind, expanded = false, size = 16 }: FileIconProps) {
  const id = resolveIconId(path, kind, expanded)
  const svg = iconSvg(id)
  return (
    <span
      className={css.icon}
      style={{ width: size, height: size }}
      data-file-icon={id}
      aria-hidden
    >
      <img className={css.img} alt="" draggable={false} src={iconDataUri(svg)} />
    </span>
  )
}
