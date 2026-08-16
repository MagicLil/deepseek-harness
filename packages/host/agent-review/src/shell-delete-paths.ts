/** Heuristic path extraction for shell delete commands (review shadows). */

/**
 * Literal file paths targeted by a delete-like shell command.
 * Skips globs (`*`/`?`), empty tokens, and flag-only fragments.
 * Does not expand variables or pipelines.
 *
 * @param command - raw `command` argument from bash/pwsh/shell tools.
 * @returns path tokens as written in the command (may be relative).
 */
export function parseShellDeletePaths(command: string): string[] {
  const trimmed = command.trim()
  if (trimmed.length === 0) return []

  const out: string[] = []
  const seen = new Set<string>()

  const push = (raw: string): void => {
    const path = stripQuotes(raw.trim())
    if (path.length === 0) return
    if (path.startsWith('-')) return
    if (/[*?]/.test(path)) return
    if (seen.has(path)) return
    seen.add(path)
    out.push(path)
  }

  // PowerShell Remove-Item / aliases (ri, del, erase, rm when used as cmdlet-ish)
  const removeItem = /\b(?:Remove-Item|ri|del|erase)\b/gi
  let match: RegExpExecArray | null
  while ((match = removeItem.exec(trimmed)) !== null) {
    const rest = trimmed.slice(match.index + match[0].length)
    collectRemoveItemArgs(rest, push)
  }

  // Unix rm / unlink (also matches pwsh `rm` when not already consumed as flag soup)
  const unixRm = /(?:^|[;&|\n])\s*(?:sudo\s+)?(?:rm|unlink)\b/gi
  while ((match = unixRm.exec(trimmed)) !== null) {
    const rest = trimmed.slice(match.index + match[0].length)
    collectUnixRmArgs(rest, push)
  }

  return out
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}

/**
 * Collect Remove-Item path arguments until a statement terminator.
 * @param rest - text after the cmdlet name.
 * @param push - path acceptor.
 */
function collectRemoveItemArgs(rest: string, push: (raw: string) => void): void {
  const tokens = tokenize(rest)
  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]
    if (token === undefined) break
    if (token === ';' || token === '|' || token === '&&' || token === '||') break
    if (token.startsWith('-')) {
      // -Path / -LiteralPath take the next token as path
      const name = token.replace(/^-+/, '').toLowerCase()
      if (
        (name === 'path' || name === 'literalpath' || name === 'lp')
        && i + 1 < tokens.length
      ) {
        const next = tokens[i + 1]
        if (next !== undefined) push(next)
        i += 2
        continue
      }
      i += 1
      continue
    }
    // Positional path; PowerShell allows comma-separated lists in one token or split
    for (const part of token.split(',')) {
      if (part.trim().length > 0) push(part)
    }
    i += 1
  }
}

/**
 * Collect rm/unlink operands after flags.
 * @param rest - text after rm/unlink.
 * @param push - path acceptor.
 */
function collectUnixRmArgs(rest: string, push: (raw: string) => void): void {
  const tokens = tokenize(rest)
  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]
    if (token === undefined) break
    if (token === ';' || token === '|' || token === '&&' || token === '||') break
    if (token.startsWith('-')) {
      i += 1
      continue
    }
    push(token)
    i += 1
  }
}

/**
 * Split a command fragment into rough shell tokens (quotes preserved as one token).
 * @param text - command tail.
 */
function tokenize(text: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === undefined) break
    if (/\s/.test(ch)) {
      i += 1
      continue
    }
    if (text.startsWith('&&', i) || text.startsWith('||', i)) {
      tokens.push(text.slice(i, i + 2))
      i += 2
      continue
    }
    if (ch === ';' || ch === '|') {
      tokens.push(ch)
      i += 1
      continue
    }
    if (ch === '"' || ch === "'") {
      const quote = ch
      let j = i + 1
      while (j < text.length && text[j] !== quote) j += 1
      tokens.push(text.slice(i, j < text.length ? j + 1 : j))
      i = j < text.length ? j + 1 : j
      continue
    }
    let j = i
    while (j < text.length) {
      const cj = text[j]
      if (cj === undefined || /\s/.test(cj) || cj === ';' || cj === '|') break
      if (text.startsWith('&&', j) || text.startsWith('||', j)) break
      j += 1
    }
    tokens.push(text.slice(i, j))
    i = j
  }
  return tokens
}
