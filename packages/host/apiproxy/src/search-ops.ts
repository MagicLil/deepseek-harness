/**
 * Workspace text search for the workbench search panel. Spawns the PACKAGED
 * ripgrep binary (`@vscode/ripgrep` — the same binary the agent's grep tool
 * uses, so desktop packaging already ships it) with a fixed `rg --json` argv
 * and parses the NDJSON stream incrementally: once the match cap or the time
 * budget is reached the child is killed and the collected rows are returned
 * as a `truncated` result instead of buffering unbounded output. No shell
 * layer exists between the argv vector and ripgrep, and `--no-config` blocks
 * host-level `--pre` injection (same hardening as the grep tool).
 */
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import type { FileSearchHit, FileSearchResult, FileSearchSpan } from './api/host.ts'

/** Match cap applied when the request omits `limit`. */
export const SEARCH_DEFAULT_LIMIT = 500

/** Hard host bound on the match cap (the schema enforces the same ceiling). */
export const SEARCH_MAX_LIMIT = 2000

/** Per-line preview bound in UTF-16 code units (the full line stays on disk). */
export const SEARCH_MAX_LINE_CHARS = 500

/** Wall-clock budget for one search child; expiry returns a truncated result. */
export const SEARCH_TIMEOUT_MS = 25_000

/** Bound on the retained stderr diagnostic tail. */
const SEARCH_STDERR_MAX_CHARS = 4096

/** One unterminated `rg --json` record may not grow past this many characters. */
const SEARCH_MAX_RECORD_CHARS = 1_000_000

/** Grace between SIGTERM and SIGKILL when the child ignores the first signal. */
const SEARCH_KILL_GRACE_MS = 5_000

/** One host.search request after schema validation (fields mirror the wire payload). */
export interface FileSearchSpec {
  /** Directory to search (absolute host path). */
  path: string
  /** Pattern text; plain text unless `regex` is true. */
  query: string
  /** When true, `query` is ripgrep regex syntax. */
  regex?: boolean | undefined
  /** When true, match case exactly (default is case-insensitive). */
  caseSensitive?: boolean | undefined
  /** When true, match whole words (`rg --word-regexp`). */
  wholeWord?: boolean | undefined
  /** Positive glob of files to search. */
  include?: string | undefined
  /** Positive glob of files to skip (negated onto the rg command line). */
  exclude?: string | undefined
  /** Match cap; clamped into `[1, SEARCH_MAX_LIMIT]`. */
  limit?: number | undefined
}

/** Classified search failure (the api-proxy handler maps these to RpcError codes). */
export type FileSearchOpsResult =
  | { ok: true; value: FileSearchResult }
  | { ok: false; code: 'search-unavailable' | 'search-invalid' | 'search-failed'; message: string }

/**
 * Process seam so tests drive the parser with a scripted child instead of a
 * real ripgrep run: `rgPath` resolves the binary, `spawn` launches it.
 */
export interface SearchSpawner {
  /** Absolute path of the ripgrep binary. */
  rgPath(): Promise<string>
  /** Launch the search child (stdout/stderr piped). */
  spawn(command: string, args: readonly string[]): ChildProcess
}

let rgPathPromise: Promise<string> | undefined

/**
 * The packaged ripgrep binary path, resolved lazily once per process.
 * `@vscode/ripgrep` resolves its platform package at module evaluation, so a
 * static import would turn a missing platform package into a load-time
 * failure of the whole host; resolving at the call boundary keeps that
 * failure at the first search as `search-unavailable`.
 * @returns the binary's absolute path; the memoized promise rejects when the
 *   platform package cannot be resolved.
 */
export function resolveRgPath(): Promise<string> {
  rgPathPromise ??= import('@vscode/ripgrep').then(module => module.rgPath)
  return rgPathPromise
}

const defaultSpawner: SearchSpawner = {
  rgPath: resolveRgPath,
  spawn: (command, args) => spawn(command, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
}

/**
 * Build the fixed `rg --json` argv for one search. Every user value rides in
 * `--flag=value` form or behind `--`, so a leading-dash value can never be
 * parsed as a flag; there is no shell layer, so no quoting applies.
 * @param spec - the validated search request.
 * @returns the complete ripgrep argument vector (excluding the binary itself).
 */
export function buildSearchArgs(spec: FileSearchSpec): string[] {
  const args = ['--json', '--no-config']
  if (spec.caseSensitive !== true) args.push('--ignore-case')
  if (spec.regex !== true) args.push('--fixed-strings')
  if (spec.wholeWord === true) args.push('--word-regexp')
  if (spec.include !== undefined) args.push(`--glob=${spec.include}`)
  if (spec.exclude !== undefined) args.push(`--glob=!${spec.exclude}`)
  args.push(`--regexp=${spec.query}`, '--', spec.path)
  return args
}

/**
 * Convert ripgrep byte offsets (UTF-8 offsets into the matched line) to
 * UTF-16 code-unit ranges the renderer can slice with `String.prototype.slice`.
 * @param text - the matched line text.
 * @param submatches - `[startByte, endByte)` pairs from one rg match record.
 * @returns UTF-16 `[start, end)` spans in the same order.
 */
export function byteSpansToChars(
  text: string,
  submatches: readonly { start: number; end: number }[],
): FileSearchSpan[] {
  const bytes = Buffer.from(text, 'utf8')
  const toChars = (offset: number): number =>
    bytes.subarray(0, Math.max(0, Math.min(offset, bytes.length))).toString('utf8').length
  return submatches.map(m => ({ start: toChars(m.start), end: toChars(m.end) }))
}

/**
 * Bound one matched line to {@link SEARCH_MAX_LINE_CHARS}: the preview text is
 * sliced and spans are clamped into the kept range (a span entirely past the
 * cut is dropped — the complete line stays in the file).
 * @param text - the matched line text (newline already stripped).
 * @param spans - UTF-16 spans into `text`.
 * @returns the bounded text plus the surviving spans.
 */
export function capSearchLine(
  text: string,
  spans: readonly FileSearchSpan[],
): { text: string; spans: FileSearchSpan[] } {
  if (text.length <= SEARCH_MAX_LINE_CHARS) return { text, spans: [...spans] }
  const kept = text.slice(0, SEARCH_MAX_LINE_CHARS)
  const survivors: FileSearchSpan[] = []
  for (const span of spans) {
    if (span.start >= SEARCH_MAX_LINE_CHARS) continue
    survivors.push({ start: span.start, end: Math.min(span.end, SEARCH_MAX_LINE_CHARS) })
  }
  return { text: kept, spans: survivors }
}

/**
 * Parse one `rg --json` NDJSON line into a hit. Non-match record types
 * (`begin`/`end`/`context`/`summary`) and malformed lines yield undefined —
 * the search panel is best-effort, so one corrupt record never fails the
 * whole result. A line that is not valid UTF-8 (rg sends base64 `bytes`
 * instead of `text`) yields a placeholder without spans.
 * @param line - one NDJSON line (no trailing newline).
 * @returns the hit, or undefined for non-match records.
 */
export function parseSearchRecord(line: string): FileSearchHit | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const record = parsed as { type?: unknown; data?: unknown }
  if (record.type !== 'match') return undefined
  if (typeof record.data !== 'object' || record.data === null) return undefined
  const data = record.data as {
    path?: unknown
    line_number?: unknown
    lines?: unknown
    submatches?: unknown
  }
  const pathText = typeof data.path === 'object' && data.path !== null
    ? (data.path as { text?: unknown }).text
    : undefined
  if (typeof pathText !== 'string' || typeof data.line_number !== 'number') return undefined
  if (typeof data.lines !== 'object' || data.lines === null) return undefined
  const lines = data.lines as { text?: unknown; bytes?: unknown }
  if (typeof lines.text !== 'string') {
    if (typeof lines.bytes !== 'string') return undefined
    return { path: pathText, line: data.line_number, text: '(line is not valid UTF-8)', spans: [] }
  }
  const text = lines.text.replace(/\r?\n$/, '')
  const rawSubmatches = Array.isArray(data.submatches) ? data.submatches : []
  const submatches: { start: number; end: number }[] = []
  for (const sub of rawSubmatches as unknown[]) {
    if (typeof sub !== 'object' || sub === null) continue
    const { start, end } = sub as { start?: unknown; end?: unknown }
    if (typeof start !== 'number' || typeof end !== 'number') continue
    submatches.push({ start, end })
  }
  const capped = capSearchLine(text, byteSpansToChars(text, submatches))
  return { path: pathText, line: data.line_number, text: capped.text, spans: capped.spans }
}

/** Whether rg stderr describes a user-fixable pattern/glob problem. */
function isInvalidPattern(stderr: string): boolean {
  return /regex parse error|error parsing glob/i.test(stderr)
}

/**
 * Run one bounded workspace search. The child is killed as soon as the match
 * cap or {@link SEARCH_TIMEOUT_MS} is reached; both settle as an `ok` result
 * with `truncated: true`. Abort (the RPC signal) settles as `search-failed`
 * so the api-proxy handler can map it to the carrier's `cancelled` error.
 * @param spec - the validated search request.
 * @param signal - aborts the search child (request cancellation).
 * @param spawner - process seam; tests inject a scripted child.
 * @returns the collected hits or a classified failure.
 */
export async function collectFileSearch(
  spec: FileSearchSpec,
  signal?: AbortSignal,
  spawner: SearchSpawner = defaultSpawner,
): Promise<FileSearchOpsResult> {
  if (signal?.aborted) {
    return { ok: false, code: 'search-failed', message: 'search was aborted' }
  }
  let rg: string
  try {
    rg = await spawner.rgPath()
  } catch (error: unknown) {
    return {
      ok: false,
      code: 'search-unavailable',
      message: `the packaged ripgrep binary is unavailable: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
  if (signal?.aborted) {
    return { ok: false, code: 'search-failed', message: 'search was aborted' }
  }
  const limit = Math.max(1, Math.min(Math.floor(spec.limit ?? SEARCH_DEFAULT_LIMIT), SEARCH_MAX_LIMIT))
  let child: ChildProcess
  try {
    child = spawner.spawn(rg, buildSearchArgs(spec))
  } catch (error: unknown) {
    return {
      ok: false,
      code: 'search-failed',
      message: `ripgrep launch failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
  return await new Promise<FileSearchOpsResult>((resolve) => {
    const hits: FileSearchHit[] = []
    let buffer = ''
    let stderrTail = ''
    let capped = false
    let timedOut = false
    let aborted = false
    let overflowed = false
    let settled = false
    let killGrace: ReturnType<typeof setTimeout> | undefined

    const value = (): FileSearchResult => {
      const kept = hits.slice(0, limit)
      return {
        root: spec.path,
        hits: kept,
        fileCount: new Set(kept.map(hit => hit.path)).size,
        truncated: capped || timedOut,
      }
    }

    const overflowFailure = (): FileSearchOpsResult => ({
      ok: false,
      code: 'search-failed',
      message: `JSON record exceeded the host bound of ${String(SEARCH_MAX_RECORD_CHARS)} characters`,
    })

    const settle = (result: FileSearchOpsResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (killGrace !== undefined) clearTimeout(killGrace)
      signal?.removeEventListener('abort', onAbort)
      resolve(result)
    }

    const requestKill = (): void => {
      if (killGrace !== undefined) return
      child.kill('SIGTERM')
      killGrace = setTimeout(() => {
        child.kill('SIGKILL')
        if (aborted) {
          settle({ ok: false, code: 'search-failed', message: 'search was aborted' })
          return
        }
        if (overflowed) {
          settle(overflowFailure())
          return
        }
        settle({ ok: true, value: value() })
      }, SEARCH_KILL_GRACE_MS)
    }

    const append = (line: string): void => {
      if (capped || overflowed || line.length === 0) return
      const hit = parseSearchRecord(line)
      if (hit === undefined) return
      hits.push(hit)
      if (hits.length >= limit) {
        capped = true
        requestKill()
      }
    }

    const timer = setTimeout(() => {
      timedOut = true
      requestKill()
    }, SEARCH_TIMEOUT_MS)

    const onAbort = (): void => {
      aborted = true
      requestKill()
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      if (overflowed) return
      buffer += chunk
      let boundary: number
      while ((boundary = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, boundary).replace(/\r$/, '')
        buffer = buffer.slice(boundary + 1)
        append(line)
      }
      if (buffer.length > SEARCH_MAX_RECORD_CHARS) {
        overflowed = true
        requestKill()
      }
    })
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      if (stderrTail.length < SEARCH_STDERR_MAX_CHARS) {
        stderrTail = (stderrTail + chunk).slice(0, SEARCH_STDERR_MAX_CHARS)
      }
    })

    child.on('error', (error: NodeJS.ErrnoException) => {
      settle(error.code === 'ENOENT'
        ? { ok: false, code: 'search-unavailable', message: 'the ripgrep binary is missing on this host' }
        : { ok: false, code: 'search-failed', message: `ripgrep launch failed: ${error.message}` })
    })

    child.on('close', (code) => {
      if (!overflowed) append(buffer.replace(/\r$/, ''))
      if (aborted) {
        settle({ ok: false, code: 'search-failed', message: 'search was aborted' })
        return
      }
      if (overflowed) {
        settle(overflowFailure())
        return
      }
      if (capped || timedOut || code === 0 || code === 1) {
        settle({ ok: true, value: value() })
        return
      }
      const detail = stderrTail.trim()
      if (isInvalidPattern(detail)) {
        // detail matched the invalid-pattern text, so it is never empty here.
        settle({ ok: false, code: 'search-invalid', message: detail })
        return
      }
      settle({
        ok: false,
        code: 'search-failed',
        message: detail.length > 0 ? detail : `search failed (exit ${String(code)})`,
      })
    })
  })
}
