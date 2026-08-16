import { EventEmitter } from 'node:events'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChildProcess } from 'node:child_process'
import {
  SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT, SEARCH_MAX_LINE_CHARS, SEARCH_TIMEOUT_MS,
  buildSearchArgs, byteSpansToChars, capSearchLine, collectFileSearch, parseSearchRecord, resolveRgPath,
} from '../src/search-ops.ts'
import type { SearchSpawner } from '../src/search-ops.ts'

const SETTLEMENT_BOUND_MS = 5_000

/** Scripted child: tests emit stdout/stderr/close by hand and observe kill(). */
class FakeChild extends EventEmitter {
  readonly stdout = Object.assign(new EventEmitter(), { setEncoding: () => {} })
  readonly stderr = Object.assign(new EventEmitter(), { setEncoding: () => {} })
  killed = false
  kill = vi.fn((_signal?: NodeJS.Signals | number) => {
    this.killed = true
    return true
  })
}

function spawnerOf(child: FakeChild, rgPath = 'C:/fake/rg.exe'): SearchSpawner {
  return {
    rgPath: () => Promise.resolve(rgPath),
    spawn: () => child as unknown as ChildProcess,
  }
}

/**
 * Let collectFileSearch pass its `await rgPath()` suspension and attach the
 * child listeners before the test scripts any events.
 */
async function started(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function matchLine(path: string, line: number, text: string, spans: [number, number][] = []): string {
  return JSON.stringify({
    type: 'match',
    data: {
      path: { text: path },
      line_number: line,
      lines: { text: `${text}\n` },
      submatches: spans.map(([start, end]) => ({ start, end })),
    },
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('buildSearchArgs', () => {
  it('defaults to case-insensitive fixed strings', () => {
    expect(buildSearchArgs({ path: 'C:/repo', query: 'todo' })).toEqual([
      '--json', '--no-config', '--ignore-case', '--fixed-strings', '--regexp=todo', '--', 'C:/repo',
    ])
  })

  it('maps every flag and rides values behind = and --', () => {
    expect(buildSearchArgs({
      path: 'C:/repo',
      query: '-todo.*',
      regex: true,
      caseSensitive: true,
      wholeWord: true,
      include: '*.ts',
      exclude: '*.spec.ts',
    })).toEqual([
      '--json', '--no-config', '--word-regexp',
      '--glob=*.ts', '--glob=!*.spec.ts',
      '--regexp=-todo.*', '--', 'C:/repo',
    ])
  })
})

describe('byteSpansToChars / capSearchLine', () => {
  it('converts UTF-8 byte offsets to UTF-16 offsets', () => {
    // '你好x' = 3 + 3 + 1 bytes; match on 'x' starts at byte 6, char 2.
    expect(byteSpansToChars('你好x', [{ start: 6, end: 7 }])).toEqual([{ start: 2, end: 3 }])
    expect(byteSpansToChars('abc', [{ start: -1, end: 99 }])).toEqual([{ start: 0, end: 3 }])
  })

  it('keeps short lines and clamps or drops spans past the preview bound', () => {
    expect(capSearchLine('short', [{ start: 0, end: 5 }]))
      .toEqual({ text: 'short', spans: [{ start: 0, end: 5 }] })
    const long = 'a'.repeat(SEARCH_MAX_LINE_CHARS + 40)
    const capped = capSearchLine(long, [
      { start: 2, end: SEARCH_MAX_LINE_CHARS + 10 },
      { start: SEARCH_MAX_LINE_CHARS + 1, end: SEARCH_MAX_LINE_CHARS + 5 },
    ])
    expect(capped.text).toHaveLength(SEARCH_MAX_LINE_CHARS)
    expect(capped.spans).toEqual([{ start: 2, end: SEARCH_MAX_LINE_CHARS }])
  })
})

describe('parseSearchRecord', () => {
  it('parses one match record and strips the trailing newline', () => {
    expect(parseSearchRecord(matchLine('C:/repo/a.ts', 3, 'const x = 1', [[6, 7]]))).toEqual({
      path: 'C:/repo/a.ts', line: 3, text: 'const x = 1', spans: [{ start: 6, end: 7 }],
    })
  })

  it('skips non-match, malformed, and field-missing records', () => {
    expect(parseSearchRecord('not json')).toBeUndefined()
    expect(parseSearchRecord('42')).toBeUndefined()
    expect(parseSearchRecord(JSON.stringify({ type: 'begin', data: {} }))).toBeUndefined()
    expect(parseSearchRecord(JSON.stringify({ type: 'match' }))).toBeUndefined()
    expect(parseSearchRecord(JSON.stringify({ type: 'match', data: { path: {}, line_number: 1, lines: { text: 'x' } } })))
      .toBeUndefined()
    expect(parseSearchRecord(JSON.stringify({ type: 'match', data: { path: 'flat', line_number: 1, lines: { text: 'x' } } })))
      .toBeUndefined()
    expect(parseSearchRecord(JSON.stringify({ type: 'match', data: { path: { text: 'a' }, line_number: 'x', lines: { text: 'x' } } })))
      .toBeUndefined()
    expect(parseSearchRecord(JSON.stringify({ type: 'match', data: { path: { text: 'a' }, line_number: 1 } })))
      .toBeUndefined()
    expect(parseSearchRecord(JSON.stringify({ type: 'match', data: { path: { text: 'a' }, line_number: 1, lines: {} } })))
      .toBeUndefined()
  })

  it('parses a match record with no submatches field into an empty span list', () => {
    expect(parseSearchRecord(JSON.stringify({
      type: 'match',
      data: { path: { text: 'a.ts' }, line_number: 4, lines: { text: 'plain\n' } },
    }))).toEqual({ path: 'a.ts', line: 4, text: 'plain', spans: [] })
  })

  it('placeholders non-UTF-8 lines and filters malformed submatches', () => {
    expect(parseSearchRecord(JSON.stringify({
      type: 'match',
      data: { path: { text: 'a.bin' }, line_number: 2, lines: { bytes: 'AAEC' } },
    }))).toEqual({ path: 'a.bin', line: 2, text: '(line is not valid UTF-8)', spans: [] })
    expect(parseSearchRecord(JSON.stringify({
      type: 'match',
      data: {
        path: { text: 'a.ts' },
        line_number: 1,
        lines: { text: 'abc' },
        submatches: [null, { start: 'x', end: 2 }, { start: 0, end: 1 }],
      },
    }))).toEqual({ path: 'a.ts', line: 1, text: 'abc', spans: [{ start: 0, end: 1 }] })
  })
})

describe('collectFileSearch (scripted child)', () => {
  it('collects hits across chunk boundaries and counts files', async () => {
    const child = new FakeChild()
    const done = collectFileSearch({ path: 'C:/repo', query: 'x' }, undefined, spawnerOf(child))
    await started()
    const lineA = matchLine('C:/repo/a.ts', 1, 'x alpha', [[0, 1]])
    const lineB = matchLine('C:/repo/b.ts', 9, 'beta x', [[5, 6]])
    child.stdout.emit('data', lineA.slice(0, 10))
    child.stdout.emit('data', `${lineA.slice(10)}\r\n{"type":"summary"}\n${lineB}`)
    child.emit('close', 0)
    const result = await done
    expect(result).toEqual({
      ok: true,
      value: {
        root: 'C:/repo',
        hits: [
          { path: 'C:/repo/a.ts', line: 1, text: 'x alpha', spans: [{ start: 0, end: 1 }] },
          { path: 'C:/repo/b.ts', line: 9, text: 'beta x', spans: [{ start: 5, end: 6 }] },
        ],
        fileCount: 2,
        truncated: false,
      },
    })
  })

  it('treats exit 1 as an empty result', async () => {
    const child = new FakeChild()
    const done = collectFileSearch({ path: 'C:/repo', query: 'none' }, undefined, spawnerOf(child))
    await started()
    child.emit('close', 1)
    expect(await done).toEqual({
      ok: true,
      value: { root: 'C:/repo', hits: [], fileCount: 0, truncated: false },
    })
  })

  it('force-kills and settles at the match cap when the child never closes', async () => {
    vi.useFakeTimers()
    const child = new FakeChild()
    const done = collectFileSearch({ path: 'C:/repo', query: 'x', limit: 2 }, undefined, spawnerOf(child))
    const settled = vi.fn()
    void done.then(settled)
    await started()
    const rows = [1, 2, 3, 4].map(line => matchLine('C:/repo/a.ts', line, `x${line}`)).join('\n')
    child.stdout.emit('data', `${rows}\n`)
    expect(child.kill).toHaveBeenNthCalledWith(1, 'SIGTERM')
    await vi.advanceTimersByTimeAsync(SETTLEMENT_BOUND_MS)
    expect(child.kill).toHaveBeenNthCalledWith(2, 'SIGKILL')
    expect(settled).toHaveBeenCalledWith({
      ok: true,
      value: {
        root: 'C:/repo',
        hits: [
          { path: 'C:/repo/a.ts', line: 1, text: 'x1', spans: [] },
          { path: 'C:/repo/a.ts', line: 2, text: 'x2', spans: [] },
        ],
        fileCount: 1,
        truncated: true,
      },
    })
  })

  it('uses the default cap when limit is omitted', async () => {
    const child = new FakeChild()
    const done = collectFileSearch({ path: 'C:/repo', query: 'x' }, undefined, spawnerOf(child))
    await started()
    child.stdout.emit('data', `${Array.from(
      { length: SEARCH_DEFAULT_LIMIT + 1 },
      (_, index) => matchLine('C:/repo/a.ts', index + 1, 'x'),
    ).join('\n')}\n`)
    child.emit('close', null)
    const result = await done
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.value.hits).toHaveLength(SEARCH_DEFAULT_LIMIT)
    expect(result.value.truncated).toBe(true)
  })

  it('clamps an oversized limit to the host maximum', async () => {
    const child = new FakeChild()
    const done = collectFileSearch(
      { path: 'C:/repo', query: 'x', limit: Number.MAX_SAFE_INTEGER },
      undefined,
      spawnerOf(child),
    )
    await started()
    child.stdout.emit('data', `${Array.from(
      { length: SEARCH_MAX_LIMIT + 1 },
      (_, index) => matchLine('C:/repo/a.ts', index + 1, 'x'),
    ).join('\n')}\n`)
    child.emit('close', null)
    const result = await done
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.value.hits).toHaveLength(SEARCH_MAX_LIMIT)
    expect(result.value.truncated).toBe(true)
  })

  it('flushes the unterminated final line on close', async () => {
    const child = new FakeChild()
    const done = collectFileSearch({ path: 'C:/repo', query: 'x' }, undefined, spawnerOf(child))
    await started()
    child.stdout.emit('data', matchLine('C:/repo/a.ts', 7, 'tail x'))
    child.emit('close', 0)
    const result = await done
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.value.hits.map(hit => hit.line)).toEqual([7])
  })

  it('force-kills and returns truncated hits before the carrier deadline when the child never closes', async () => {
    vi.useFakeTimers()
    expect(SEARCH_TIMEOUT_MS).toBeLessThanOrEqual(25_000)
    const child = new FakeChild()
    const done = collectFileSearch({ path: 'C:/repo', query: 'x' }, undefined, spawnerOf(child))
    const settled = vi.fn()
    void done.then(settled)
    await started()
    child.stdout.emit('data', `${matchLine('C:/repo/a.ts', 1, 'x')}\n`)
    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS)
    expect(child.kill).toHaveBeenNthCalledWith(1, 'SIGTERM')
    await vi.advanceTimersByTimeAsync(SETTLEMENT_BOUND_MS)
    expect(child.kill).toHaveBeenNthCalledWith(2, 'SIGKILL')
    expect(settled).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      value: expect.objectContaining({ truncated: true }),
    }))
  })

  it('force-kills and settles as search-failed after abort when the child never closes', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const child = new FakeChild()
    const done = collectFileSearch({ path: 'C:/repo', query: 'x' }, controller.signal, spawnerOf(child))
    const settled = vi.fn()
    void done.then(settled)
    await started()
    controller.abort()
    expect(child.kill).toHaveBeenNthCalledWith(1, 'SIGTERM')
    await vi.advanceTimersByTimeAsync(SETTLEMENT_BOUND_MS)
    expect(child.kill).toHaveBeenNthCalledWith(2, 'SIGKILL')
    expect(settled).toHaveBeenCalledWith({
      ok: false, code: 'search-failed', message: 'search was aborted',
    })
  })

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const child = new FakeChild()
    expect(await collectFileSearch({ path: 'C:/repo', query: 'x' }, controller.signal, spawnerOf(child)))
      .toEqual({ ok: false, code: 'search-failed', message: 'search was aborted' })
  })

  it('does not spawn when aborted during deferred binary resolution', async () => {
    const controller = new AbortController()
    const rgPath = Promise.withResolvers<string>()
    const spawn = vi.fn(() => {
      throw new Error('spawn must not run after abort')
    })
    const done = collectFileSearch(
      { path: 'C:/repo', query: 'x' },
      controller.signal,
      { rgPath: () => rgPath.promise, spawn },
    )
    controller.abort()
    rgPath.resolve('C:/fake/rg.exe')
    expect(await done).toEqual({ ok: false, code: 'search-failed', message: 'search was aborted' })
    expect(spawn).not.toHaveBeenCalled()
  })

  it('kills and fails when one unterminated JSON record exceeds the buffer bound', async () => {
    vi.useFakeTimers()
    const child = new FakeChild()
    const done = collectFileSearch({ path: 'C:/repo', query: 'x' }, undefined, spawnerOf(child))
    const settled = vi.fn()
    void done.then(settled)
    await started()
    child.stdout.emit('data', 'x'.repeat(1_000_001))
    expect(child.kill).toHaveBeenNthCalledWith(1, 'SIGTERM')
    await vi.advanceTimersByTimeAsync(SETTLEMENT_BOUND_MS)
    expect(child.kill).toHaveBeenNthCalledWith(2, 'SIGKILL')
    expect(settled).toHaveBeenCalledWith(expect.objectContaining({
      ok: false,
      code: 'search-failed',
      message: expect.stringContaining('JSON record exceeded'),
    }))
  })

  it('classifies binary resolution and launch failures', async () => {
    const child = new FakeChild()
    expect(await collectFileSearch({ path: 'C:/repo', query: 'x' }, undefined, {
      rgPath: () => Promise.reject(new Error('no platform package')),
      spawn: () => child as unknown as ChildProcess,
    })).toMatchObject({ ok: false, code: 'search-unavailable' })
    expect(await collectFileSearch({ path: 'C:/repo', query: 'x' }, undefined, {
      rgPath: () => Promise.reject(new Error('busted')),
      spawn: () => child as unknown as ChildProcess,
    })).toMatchObject({ ok: false, code: 'search-unavailable' })
    expect(await collectFileSearch({ path: 'C:/repo', query: 'x' }, undefined, {
      rgPath: () => Promise.resolve('rg'),
      spawn: () => {
        throw new Error('EMFILE')
      },
    })).toMatchObject({ ok: false, code: 'search-failed', message: 'ripgrep launch failed: EMFILE' })
    expect(await collectFileSearch({ path: 'C:/repo', query: 'x' }, undefined, {
      rgPath: () => Promise.resolve('rg'),
      spawn: () => {
        // A non-Error throw exercises the String(error) fallback.
        throw 'busted'
      },
    })).toMatchObject({ ok: false, code: 'search-failed' })
  })

  it('maps child error events to unavailable or failed', async () => {
    const missing = new FakeChild()
    const missingDone = collectFileSearch({ path: 'C:/repo', query: 'x' }, undefined, spawnerOf(missing))
    await started()
    const enoent = Object.assign(new Error('spawn rg ENOENT'), { code: 'ENOENT' })
    missing.emit('error', enoent)
    expect(await missingDone).toMatchObject({ ok: false, code: 'search-unavailable' })

    const broken = new FakeChild()
    const brokenDone = collectFileSearch({ path: 'C:/repo', query: 'x' }, undefined, spawnerOf(broken))
    await started()
    broken.emit('error', new Error('EACCES'))
    // A late close after settling must be ignored (the settle latch).
    broken.emit('close', 2)
    expect(await brokenDone).toMatchObject({ ok: false, code: 'search-failed' })
  })

  it('classifies exit-2 stderr into invalid or failed', async () => {
    const invalid = new FakeChild()
    const invalidDone = collectFileSearch({ path: 'C:/repo', query: '[', regex: true }, undefined, spawnerOf(invalid))
    await started()
    invalid.stderr.emit('data', 'regex parse error:\n  [\n  ^ unclosed character class')
    invalid.emit('close', 2)
    expect(await invalidDone).toMatchObject({ ok: false, code: 'search-invalid' })

    const failed = new FakeChild()
    const failedDone = collectFileSearch({ path: 'C:/repo', query: 'x' }, undefined, spawnerOf(failed))
    await started()
    failed.stderr.emit('data', 'some hard failure')
    failed.emit('close', 2)
    expect(await failedDone).toMatchObject({ ok: false, code: 'search-failed', message: 'some hard failure' })

    const silent = new FakeChild()
    const silentDone = collectFileSearch({ path: 'C:/repo', query: 'x' }, undefined, spawnerOf(silent))
    await started()
    silent.emit('close', 2)
    expect(await silentDone).toMatchObject({ ok: false, code: 'search-failed', message: 'search failed (exit 2)' })
  })

  it('bounds the retained stderr tail', async () => {
    const child = new FakeChild()
    const done = collectFileSearch({ path: 'C:/repo', query: 'x' }, undefined, spawnerOf(child))
    await started()
    child.stderr.emit('data', 'e'.repeat(5000))
    child.stderr.emit('data', 'more that must be dropped')
    child.emit('close', 2)
    const result = await done
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.message.length).toBeLessThanOrEqual(4096)
  })
})

describe('collectFileSearch (real ripgrep)', () => {
  it('finds matches in a real directory through the packaged binary', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-search-ops-'))
    writeFileSync(join(root, 'alpha.ts'), 'const marker = 1\nplain line\nMARKER twice marker\n')
    writeFileSync(join(root, 'beta.txt'), 'no hits here\n')
    const rg = await resolveRgPath()
    expect(typeof rg).toBe('string')
    const result = await collectFileSearch({ path: root, query: 'marker' })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.value.fileCount).toBe(1)
    expect(result.value.truncated).toBe(false)
    expect(result.value.hits.map(hit => hit.line).sort((a, b) => a - b)).toEqual([1, 3])
    const third = result.value.hits.find(hit => hit.line === 3)
    // Case-insensitive default: both MARKER and marker on line 3 highlight.
    expect(third?.spans).toHaveLength(2)
  }, 30_000)

  it('honors caseSensitive, wholeWord, include, exclude, and regex flags end to end', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-search-ops-flags-'))
    writeFileSync(join(root, 'a.ts'), 'Marker\nmarker\nremarkers\n')
    writeFileSync(join(root, 'b.txt'), 'marker\n')
    const sensitive = await collectFileSearch({ path: root, query: 'Marker', caseSensitive: true, include: '*.ts' })
    expect(sensitive.ok && sensitive.value.hits.length).toBe(1)
    const word = await collectFileSearch({ path: root, query: 'marker', wholeWord: true, exclude: '*.txt' })
    expect(word.ok && word.value.hits.map(hit => hit.line)).toEqual([1, 2])
    const regex = await collectFileSearch({ path: root, query: 'mark.rs', regex: true, include: '*.ts' })
    expect(regex.ok && regex.value.hits.map(hit => hit.line)).toEqual([3])
    const invalid = await collectFileSearch({ path: root, query: '[', regex: true })
    expect(invalid).toMatchObject({ ok: false, code: 'search-invalid' })
  }, 30_000)
})
