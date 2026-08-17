/** Pull file-path candidates out of opaque-tool arguments and results. */

import { isAbsolute, resolve as resolvePath } from 'node:path'

/** Cap extracted candidates so a novel-length prompt cannot fan out. */
export const MAX_OPAQUE_HINT_PATHS = 40

const WIN_ABS = /(?<![A-Za-z])([A-Za-z]:[/\\][^\s"'`<>|*?]+)/g
const POSIX_ABS = /(?:^|[\s"'`(])(\/(?:[\w.-]+\/)*[\w.-]+)/g
const QUOTED = /["'`]([^"'`\n]{2,512})["'`]/g
const REL_NESTED = /(?<![A-Za-z]:)(?<![/\\])\b([A-Za-z0-9_-]+(?:[/\\][\w.-]+)+\.[A-Za-z][A-Za-z0-9]{0,8})\b/g
const BARE_FILE = /(?<![:/\\])\b([\w.-]+\.[A-Za-z][A-Za-z0-9]{0,8})\b/g
const BARE_EXT = new RegExp(
  '(?:ts|tsx|js|jsx|mjs|cjs|json|md|txt|py|go|rs|css|html|'
    + 'yml|yaml|toml|xml|sh|ps1|vue|svelte|kt|java|c|cc|cpp|h|hpp|cs|rb|php|sql)$',
  'i',
)

const WRITE_CLAIM = /创建|覆盖|写入|写好|新建|修改|create|overwrite|write|wrote|saved|edit/i

/**
 * Absolute workspace paths mentioned in an opaque tool's args and/or result.
 * Joins a mentioned directory with a mentioned filename (the usual
 * "create foo.txt at D:\\proj" shape).
 *
 * @param args - tool arguments object.
 * @param result - optional settled result (text blocks + value).
 * @param cwd - session cwd for relative names.
 */
export function extractOpaquePaths(
  args: unknown,
  result: { content?: readonly unknown[]; value?: unknown } | undefined,
  cwd: string | undefined,
): string[] {
  const texts = textsFrom(args, result)
  const abs = new Set<string>()
  const rel = new Set<string>()
  for (const text of texts) {
    for (const raw of matchRawPaths(text)) {
      const path = unescapeWin(trimTrail(raw))
      if (!looksLikePath(path)) continue
      if (isAbsolute(path)) abs.add(path)
      else rel.add(path)
    }
  }
  const out: string[] = []
  const seen = new Set<string>()
  const push = (path: string): void => {
    if (seen.has(path) || out.length >= MAX_OPAQUE_HINT_PATHS) return
    seen.add(path)
    out.push(path)
  }
  for (const path of abs) push(resolveHint(path, cwd))
  const dirs = [...abs].filter(path => !hasFileExtension(path))
  for (const dir of dirs) {
    for (const name of rel) {
      if (name.includes('/') || name.includes('\\')) continue
      push(resolvePath(dir, name))
    }
  }
  for (const name of rel) push(resolveHint(name, cwd))
  return out
}

/**
 * True when the prompt claims to create/overwrite this path.
 * Used so a same-content rewrite still enters the review dock.
 *
 * @param args - tool arguments object.
 * @param path - absolute candidate path.
 */
export function pathLooksWritten(args: unknown, path: string): boolean {
  const texts = textsFrom(args, undefined)
  const normalized = path.replaceAll('\\', '/')
  const base = normalized.slice(normalized.lastIndexOf('/') + 1)
  return texts.some((text) => {
    if (!WRITE_CLAIM.test(text)) return false
    return text.includes(path) || (base.length > 0 && text.includes(base))
  })
}

/**
 * True when the settled result names this path or its basename.
 *
 * @param result - settled tool result.
 * @param path - absolute candidate path.
 * @param cwd - session cwd for relative names in the result.
 */
export function resultMentionsPath(
  result: { content?: readonly unknown[]; value?: unknown } | undefined,
  path: string,
  cwd: string | undefined,
): boolean {
  const named = extractOpaquePaths(undefined, result, cwd)
  const norm = path.replaceAll('\\', '/').toLowerCase()
  if (named.some(item => item === path || item.replaceAll('\\', '/').toLowerCase() === norm)) {
    return true
  }
  const base = norm.slice(norm.lastIndexOf('/') + 1)
  if (base.length === 0) return false
  return textsFrom(undefined, result).some(text => text.includes(path) || text.toLowerCase().includes(base))
}

function textsFrom(
  args: unknown,
  result: { content?: readonly unknown[]; value?: unknown } | undefined,
): string[] {
  const texts: string[] = []
  collectStrings(args, texts, 0)
  if (result === undefined) return texts
  if (Array.isArray(result.content)) {
    for (const block of result.content) {
      if (block !== null && typeof block === 'object' && 'text' in block) {
        const text = (block as { text?: unknown }).text
        if (typeof text === 'string') texts.push(text)
      }
    }
  }
  if (typeof result.value === 'string') texts.push(result.value)
  else collectStrings(result.value, texts, 0)
  return texts
}

function collectStrings(value: unknown, out: string[], depth: number): void {
  if (depth > 6) return
  if (typeof value === 'string') {
    if (value.length > 0 && value.length <= 8_000) out.push(value)
    return
  }
  if (value === null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth + 1)
    return
  }
  for (const item of Object.values(value as Record<string, unknown>)) {
    collectStrings(item, out, depth + 1)
  }
}

function matchRawPaths(text: string): string[] {
  const found: string[] = []
  for (const re of [WIN_ABS, POSIX_ABS, QUOTED, REL_NESTED, BARE_FILE]) {
    re.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(text)) !== null) {
      found.push(match[1] as string)
    }
  }
  return found
}

function trimTrail(raw: string): string {
  return raw.replace(/[.,;:)\]}]+$/g, '')
}

function unescapeWin(raw: string): string {
  return /[A-Za-z]:\\\\/.test(raw) ? raw.replaceAll('\\\\', '\\') : raw
}

function looksLikePath(value: string): boolean {
  if (value.length < 2 || value.length > 512) return false
  if (/[*?]/.test(value)) return false
  if (value.startsWith('http://') || value.startsWith('https://')) return false
  if (isAbsolute(value)) return true
  if (value.includes('/') || value.includes('\\')) return true
  const dot = value.lastIndexOf('.')
  if (dot < 0) return false
  return BARE_EXT.test(value.slice(dot + 1))
}

function resolveHint(requested: string, cwd: string | undefined): string {
  if (isAbsolute(requested)) return requested
  return cwd !== undefined && cwd.length > 0 ? resolvePath(cwd, requested) : resolvePath(requested)
}

function hasFileExtension(path: string): boolean {
  const normalized = path.replaceAll('\\', '/')
  return /\.[A-Za-z][A-Za-z0-9]{0,8}$/.test(normalized.slice(normalized.lastIndexOf('/') + 1))
}
