/**
 * Material Icon Theme associations: exact file name, then longest extension,
 * then the default file/folder glyph.
 */
import { basename } from './route-file.ts'
import { ICON_THEME } from './icon-theme-data.ts'

/** File-tree / tab-strip row kind. */
export type FileIconKind = 'file' | 'directory'

/** Generated association tables plus inline SVG markup. */
export type IconThemeData = {
  file: string
  folder: string
  folderExpanded: string
  fileNames: Readonly<Record<string, string>>
  fileExtensions: Readonly<Record<string, string>>
  folderNames: Readonly<Record<string, string>>
  folderNamesExpanded: Readonly<Record<string, string>>
  svgs: Readonly<Record<string, string>>
}

const uriCache = new Map<string, string>()

/**
 * Icon id for a path or basename.
 * @param pathOrName - host path or a single segment.
 * @param kind - file vs directory.
 * @param expanded - open-folder glyph when `kind` is directory.
 * @param theme - association tables (defaults to the generated theme).
 */
export function resolveIconId(
  pathOrName: string,
  kind: FileIconKind,
  expanded = false,
  theme: IconThemeData = ICON_THEME,
): string {
  const name = basename(pathOrName).toLowerCase()
  if (kind === 'directory') {
    const folders = expanded ? theme.folderNamesExpanded : theme.folderNames
    return folders[name] ?? (expanded ? theme.folderExpanded : theme.folder)
  }
  const byName = theme.fileNames[name]
  if (byName !== undefined) return byName
  const parts = name.split('.')
  for (let i = 1; i < parts.length; i++) {
    const ext = parts.slice(i).join('.')
    const byExt = theme.fileExtensions[ext]
    if (byExt !== undefined) return byExt
  }
  return theme.file
}

/**
 * SVG markup for an icon id, falling back to the default file glyph.
 * @param id - theme icon id.
 * @param theme - association tables (defaults to the generated theme).
 */
export function iconSvg(id: string, theme: IconThemeData = ICON_THEME): string {
  return theme.svgs[id] ?? theme.svgs[theme.file] ?? ''
}

/**
 * Data-URI for an SVG string (cached).
 * @param svg - raw SVG markup.
 */
export function iconDataUri(svg: string): string {
  const hit = uriCache.get(svg)
  if (hit !== undefined) return hit
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  uriCache.set(svg, uri)
  return uri
}
