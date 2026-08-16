import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { contentHash } from '../src/hash.ts'
import { openTurnFromEvents, pathFromToolArgs } from '../src/paths.ts'
import { ReviewEngine } from '../src/review.ts'
import type { ReviewDisk } from '../src/review.ts'
import { createNodeDisk } from '../src/index.ts'

describe('path helpers', () => {
  it('reads file_path or path', () => {
    expect(pathFromToolArgs({ file_path: 'a.ts' })).toBe('a.ts')
    expect(pathFromToolArgs({ path: 'b.ts' })).toBe('b.ts')
    expect(pathFromToolArgs({})).toBeUndefined()
  })

  it('tracks the open turn', () => {
    expect(openTurnFromEvents([
      { type: 'turn/start', data: { turn: 1 } },
      { type: 'tool/call', data: {} },
      { type: 'turn/end', data: { turn: 1 } },
      { type: 'turn/start', data: { turn: 2 } },
    ])).toBe(2)
    expect(openTurnFromEvents([{ type: 'turn/end', data: { turn: 1 } }])).toBeNull()
  })
})

describe('ReviewEngine', () => {
  let home: string
  let workspace: string
  let disk: ReviewDisk
  let engine: ReviewEngine

  afterEach(async () => {
    // temp dirs are left for the OS; tests are small
  })

  async function setup(): Promise<void> {
    home = await mkdtemp(join(tmpdir(), 'dsh-review-home-'))
    workspace = await mkdtemp(join(tmpdir(), 'dsh-review-ws-'))
    disk = createNodeDisk()
    engine = new ReviewEngine({ dshHome: home, disk })
  }

  it('captures create and update, settles afterHash, accepts and reverts', async () => {
    await setup()
    const created = join(workspace, 'new.txt')
    const updated = join(workspace, 'old.txt')
    await writeFile(updated, 'before\n', 'utf8')

    await engine.captureBefore('s1', 1, created)
    await engine.captureBefore('s1', 1, updated)
    await writeFile(created, 'fresh\n', 'utf8')
    await writeFile(updated, 'after\n', 'utf8')
    await engine.settle('s1', 1, created, true)
    await engine.settle('s1', 1, updated, true)

    let review = await engine.get('s1')
    expect(review.turns).toHaveLength(1)
    expect(review.turns[0]!.files.map(f => f.kind).sort()).toEqual(['create', 'update'])
    expect(review.turns[0]!.files.every(f => f.status === 'pending')).toBe(true)
    expect(review.turns[0]!.files.find(f => f.path === updated)?.beforeHash)
      .toBe(contentHash('before\n'))
    expect(review.turns[0]!.files.find(f => f.path === updated)?.afterHash)
      .toBe(contentHash('after\n'))

    expect((await engine.accept('s1', 1, created)).ok).toBe(true)
    expect((await engine.revert('s1', 1, updated)).ok).toBe(true)
    expect(await readFile(updated, 'utf8')).toBe('before\n')
    review = await engine.get('s1')
    expect(review.turns[0]!.files.find(f => f.path === created)?.status).toBe('accepted')
    expect(review.turns[0]!.files.find(f => f.path === updated)?.status).toBe('reverted')
  })

  it('keeps the first shadow across multiple edits and acceptAll', async () => {
    await setup()
    const path = join(workspace, 'multi.txt')
    await writeFile(path, 'v0\n', 'utf8')
    await engine.captureBefore('s1', 3, path)
    await writeFile(path, 'v1\n', 'utf8')
    await engine.settle('s1', 3, path, true)
    await engine.captureBefore('s1', 3, path)
    await writeFile(path, 'v2\n', 'utf8')
    await engine.settle('s1', 3, path, true)
    const file = (await engine.get('s1')).turns[0]!.files[0]!
    expect(file.beforeHash).toBe(contentHash('v0\n'))
    expect(file.afterHash).toBe(contentHash('v2\n'))
    expect((await engine.acceptAll('s1', 3)).ok).toBe(true)
    expect((await engine.get('s1')).turns[0]!.files[0]!.status).toBe('accepted')
  })

  it('blocks conflicting revert unless force, and respects dirty paths', async () => {
    await setup()
    const path = join(workspace, 'conflict.txt')
    await writeFile(path, 'orig\n', 'utf8')
    await engine.captureBefore('s1', 1, path)
    await writeFile(path, 'agent\n', 'utf8')
    await engine.settle('s1', 1, path, true)
    await writeFile(path, 'human\n', 'utf8')
    expect((await engine.revert('s1', 1, path)).error).toBe('conflict')
    expect((await engine.revert('s1', 1, path, false, [path])).error).toBe('dirty-editor')
    expect((await engine.revert('s1', 1, path, true)).ok).toBe(true)
    expect(await readFile(path, 'utf8')).toBe('orig\n')
  })

  it('marks oversize files irreversible and survives reload', async () => {
    await setup()
    const path = join(workspace, 'big.txt')
    await writeFile(path, 'x'.repeat(100), 'utf8')
    engine = new ReviewEngine({ dshHome: home, disk, maxShadowBytes: 10 })
    await engine.captureBefore('s1', 1, path)
    await engine.settle('s1', 1, path, true)
    expect((await engine.get('s1')).turns[0]!.files[0]!.status).toBe('irreversible')
    expect((await engine.revert('s1', 1, path)).error).toBe('irreversible')
    const reloaded = new ReviewEngine({ dshHome: home, disk })
    expect((await reloaded.get('s1')).turns[0]!.files[0]!.status).toBe('irreversible')
  })

  it('reverts a create by deleting the file and reports diff', async () => {
    await setup()
    const path = join(workspace, 'dir', 'made.txt')
    await engine.captureBefore('s1', 1, path)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, 'new\n', 'utf8')
    await engine.settle('s1', 1, path, true)
    const diff = await engine.diff('s1', 1, path)
    expect(diff).toMatchObject({ ok: true, before: '', after: 'new\n' })
    expect((await engine.revert('s1', 1, path)).ok).toBe(true)
    expect(await disk.readText(path)).toBeNull()
  })

  it('marks shellMaybeMutated and drops failed first settle', async () => {
    await setup()
    const path = join(workspace, 'fail.txt')
    await engine.markShell('s1', 2)
    await engine.captureBefore('s1', 2, path)
    await engine.settle('s1', 2, path, false)
    const review = await engine.get('s1')
    expect(review.turns[0]!.shellMaybeMutated).toBe(true)
    expect(review.turns[0]!.files).toEqual([])
  })

  it('captures shell deletes, settles when gone, and reverts from shadow', async () => {
    await setup()
    const path = join(workspace, 'gone.txt')
    await writeFile(path, 'keep-me\n', 'utf8')
    await engine.captureDelete('s1', 5, path)
    await disk.remove(path)
    await engine.settle('s1', 5, path, true)
    const pending = (await engine.get('s1')).turns[0]!.files[0]!
    expect(pending).toMatchObject({
      path, kind: 'delete', status: 'pending', afterHash: null,
    })
    const diff = await engine.diff('s1', 5, path)
    expect(diff).toMatchObject({ ok: true, before: 'keep-me\n', after: '' })
    expect((await engine.revert('s1', 5, path)).ok).toBe(true)
    expect(await readFile(path, 'utf8')).toBe('keep-me\n')
  })

  it('drops delete capture when settle finds the file still present', async () => {
    await setup()
    const path = join(workspace, 'still.txt')
    await writeFile(path, 'here\n', 'utf8')
    await engine.captureDelete('s1', 1, path)
    await engine.settle('s1', 1, path, true)
    expect((await engine.get('s1')).turns[0]!.files).toEqual([])
  })
})
