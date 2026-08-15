import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  deleteOwned,
  fail,
  getOwned,
  importForeign,
  listForeign,
  listOwned,
  listProject,
  ok,
  ownedRoot,
  resolveManagerHome,
  resolveUserHome,
  saveOwned,
  setEnabled,
} from '../src/store.ts'

async function tempHome(): Promise<{ home: string; project: string; user: string }> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-skill-mgr-'))
  return { home: join(root, 'home'), project: join(root, 'project'), user: join(root, 'user') }
}

describe('skill manager store', () => {
  it('resolves owned roots and rejects a missing project', () => {
    expect(ownedRoot('personal', '/h', undefined)).toEqual({ path: join('/h', 'skills') })
    expect(ownedRoot('project', '/h', undefined)).toEqual({ error: 'no-project' })
    expect(ownedRoot('project', '/h', '   ')).toEqual({ error: 'no-project' })
    expect(ownedRoot('project', '/h', 'relative/proj')).toEqual({ error: 'invalid-project' })
    expect(fail('not-found')).toEqual({ ok: false, error: 'not-found' })
    expect(ok()).toEqual({ ok: true })
    const customHome = join(tmpdir(), 'custom-dsh-home')
    expect(resolveManagerHome(customHome)).toBe(resolve(customHome))
    expect(resolveManagerHome()).toMatch(/[\\/]/)
    expect(resolveUserHome(customHome)).toBe(resolve(customHome))
    expect(resolveUserHome()).toMatch(/[\\/]/)
  })

  it('creates, lists, loads, and deletes a personal skill', async () => {
    const { home } = await tempHome()
    const saved = await saveOwned({
      scope: 'personal',
      name: 'mes-intake',
      description: 'Ask first',
      whenToUse: 'New MES work',
      content: 'Do not invent tables.',
      modelInvocable: true,
      userInvocable: true,
    }, home)
    expect(saved).toEqual({ ok: true })
    const listed = await listOwned({ scope: 'personal' }, home)
    expect(listed.items).toEqual([expect.objectContaining({
      name: 'mes-intake',
      origin: 'personal',
      whenToUse: 'New MES work',
    })])
    const loaded = await getOwned({ scope: 'personal', name: 'mes-intake' }, home)
    expect(loaded.ok).toBe(true)
    expect(loaded.skill?.content).toContain('Do not invent tables.')
    expect(await saveOwned({
      scope: 'personal',
      name: 'aaa-first',
      description: 'Sort earlier',
      content: 'A',
      modelInvocable: true,
      userInvocable: true,
    }, home)).toEqual({ ok: true })
    expect((await listOwned({ scope: 'personal' }, home)).items.map(item => item.name))
      .toEqual(['aaa-first', 'mes-intake'])
    expect(await deleteOwned({ scope: 'personal', name: 'mes-intake' }, home)).toEqual({ ok: true })
    expect(await getOwned({ scope: 'personal', name: 'mes-intake' }, home)).toEqual({
      ok: false,
      error: 'not-found',
    })
  })

  it('reads a flat project markdown file and rejects bad writes', async () => {
    const { home, project } = await tempHome()
    const dir = join(project, '.dsh', 'skills')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'flat-skill.md'), [
      '---',
      'name: flat-skill',
      'description: Flat',
      '---',
      'Body',
    ].join('\n'), 'utf8')
    const listed = await listOwned({ scope: 'project', projectRoot: project }, home)
    expect(listed.items.map(item => item.name)).toEqual(['flat-skill'])
    expect((await getOwned({ scope: 'project', name: 'flat-skill', projectRoot: project }, home)).ok).toBe(true)
    expect(await deleteOwned({ scope: 'project', name: 'flat-skill', projectRoot: project }, home)).toEqual({ ok: true })
    expect(await saveOwned({
      scope: 'project',
      name: 'BadName',
      description: 'x',
      content: 'y',
      modelInvocable: true,
      userInvocable: true,
      projectRoot: project,
    }, home)).toEqual({ ok: false, error: 'invalid-name' })
    expect(await saveOwned({
      scope: 'project',
      name: 'ok-name',
      description: '   ',
      content: 'y',
      modelInvocable: true,
      userInvocable: true,
      projectRoot: project,
    }, home)).toEqual({ ok: false, error: 'invalid-description' })
    expect(await saveOwned({
      scope: 'personal',
      name: 'ok-name',
      description: 'd',
      content: 'y',
      modelInvocable: true,
      userInvocable: true,
    }, home)).toEqual({ ok: true })
    expect(await getOwned({ scope: 'project', name: 'ok-name' }, home)).toEqual({
      ok: false,
      error: 'no-project',
    })
    expect(await saveOwned({
      scope: 'project',
      name: 'ok-name',
      description: 'd',
      content: 'y',
      modelInvocable: true,
      userInvocable: true,
      projectRoot: 'relative',
    }, home)).toEqual({ ok: false, error: 'invalid-project' })
    expect(await deleteOwned({ scope: 'project', name: 'missing', projectRoot: project }, home))
      .toEqual({ ok: false, error: 'not-found' })
    expect(await deleteOwned({ scope: 'personal', name: 'Not-Valid' }, home))
      .toEqual({ ok: false, error: 'invalid-name' })
    expect(await getOwned({ scope: 'personal', name: 'Not-Valid' }, home))
      .toEqual({ ok: false, error: 'invalid-name' })
  })

  it('lists foreign Claude and Cursor skills and copies them without touching the source', async () => {
    const { home, project, user } = await tempHome()
    const claude = join(project, '.claude', 'skills', 'claude-note')
    const cursor = join(project, '.cursor', 'skills')
    await mkdir(claude, { recursive: true })
    await mkdir(cursor, { recursive: true })
    await writeFile(join(claude, 'SKILL.md'), [
      '---',
      'name: claude-note',
      'description: From Claude',
      '---',
      'Claude body',
    ].join('\n'), 'utf8')
    await writeFile(join(claude, 'notes.md'), 'asset', 'utf8')
    await writeFile(join(cursor, 'cursor-tip.md'), [
      '---',
      'name: cursor-tip',
      'description: From Cursor',
      '---',
      'Cursor body',
    ].join('\n'), 'utf8')
    const foreign = await listForeign({ projectRoot: project }, home, user)
    expect(foreign.items.map(item => `${item.origin}:${item.name}`)).toEqual([
      'claude:claude-note',
      'cursor:cursor-tip',
    ])
    expect(foreign.items.every(item => item.imported !== true)).toBe(true)
    expect(foreign.items[0]?.location).toBe('project')
    expect(await importForeign({
      location: 'project',
      projectRoot: project,
      source: 'claude',
      name: 'claude-note',
      targetScope: 'project',
    }, home, user)).toEqual({ ok: true })
    expect(await readFile(join(claude, 'SKILL.md'), 'utf8')).toContain('From Claude')
    expect(await readFile(join(project, '.dsh', 'skills', 'claude-note', 'notes.md'), 'utf8')).toBe('asset')
    expect((await listForeign({ projectRoot: project }, home, user)).items.find(item => item.name === 'claude-note')?.imported)
      .toBe(true)
    expect(await importForeign({
      location: 'project',
      projectRoot: project,
      source: 'claude',
      name: 'claude-note',
      targetScope: 'project',
    }, home, user)).toEqual({ ok: false, error: 'name-taken' })
    expect(await importForeign({
      location: 'project',
      projectRoot: project,
      source: 'cursor',
      name: 'cursor-tip',
      targetScope: 'personal',
    }, home, user)).toEqual({ ok: true })
    expect((await getOwned({ scope: 'personal', name: 'cursor-tip' }, home)).skill?.description).toBe('From Cursor')
    expect(await importForeign({
      location: 'project',
      projectRoot: project,
      source: 'claude',
      name: 'missing-skill',
      targetScope: 'project',
    }, home, user)).toEqual({ ok: false, error: 'foreign-not-found' })
    expect(await importForeign({
      location: 'project',
      source: 'claude',
      name: 'claude-note',
      targetScope: 'personal',
    }, home, user)).toEqual({ ok: false, error: 'no-project' })
    expect(await importForeign({
      location: 'project',
      projectRoot: '',
      source: 'claude',
      name: 'claude-note',
      targetScope: 'project',
    }, home, user)).toEqual({ ok: false, error: 'no-project' })
    expect(await importForeign({
      location: 'project',
      projectRoot: project,
      source: 'claude',
      name: 'Bad',
      targetScope: 'project',
    }, home, user)).toEqual({ ok: false, error: 'invalid-name' })
    expect(await listForeign({}, home, user)).toEqual({ items: [] })
    expect(await listOwned({ scope: 'project' }, home)).toEqual({ items: [] })
  })

  it('skips hidden and unreadable entries while listing', async () => {
    const { home, project } = await tempHome()
    const root = join(project, '.dsh', 'skills')
    await mkdir(join(root, '.hidden'), { recursive: true })
    await writeFile(join(root, 'README.txt'), 'nope', 'utf8')
    await writeFile(join(root, 'broken.md'), '---\nname: broken\n---\n', 'utf8')
    await writeFile(join(root, 'invalid-yaml.md'), '---\nname: [\n---\n', 'utf8')
    await mkdir(join(root, 'empty-dir'), { recursive: true })
    await mkdir(join(root, 'wrong-dir'), { recursive: true })
    await writeFile(join(root, 'wrong-dir', 'SKILL.md'), [
      '---',
      'name: other-name',
      'description: Mismatch',
      '---',
      'x',
    ].join('\n'), 'utf8')
    expect((await listOwned({ scope: 'project', projectRoot: project }, home)).items.map(item => item.name).sort())
      .toEqual(['broken', 'invalid-yaml', 'wrong-dir'])
    expect(await listOwned({ scope: 'personal' }, join(home, 'missing-home'))).toEqual({ items: [] })
    await writeFile(join(root, 'Bad_Name.md'), [
      '---',
      'name: Bad_Name',
      'description: Invalid filename',
      '---',
      'x',
    ].join('\n'), 'utf8')
    await writeFile(join(root, 'alias.md'), [
      '---',
      'name: other-name',
      'description: Filename mismatch',
      '---',
      'x',
    ].join('\n'), 'utf8')
    expect((await listOwned({ scope: 'project', projectRoot: project }, home)).items.map(item => item.name).sort())
      .toEqual(['alias', 'broken', 'invalid-yaml', 'wrong-dir'])
    expect(await getOwned({ scope: 'project', name: 'wrong-dir', projectRoot: project }, home))
      .toEqual({ ok: false, error: 'not-found' })
    expect(await deleteOwned({ scope: 'project', name: 'missing', projectRoot: 'relative' }, home))
      .toEqual({ ok: false, error: 'invalid-project' })
    expect(await deleteOwned({ scope: 'project', name: 'missing' }, home))
      .toEqual({ ok: false, error: 'no-project' })
    expect(await getOwned({ scope: 'project', name: 'ok-name', projectRoot: 'relative' }, home))
      .toEqual({ ok: false, error: 'invalid-project' })
  })

  it('copies nested foreign bundles and rejects a flat name collision', async () => {
    const { home, project, user } = await tempHome()
    const nested = join(project, '.claude', 'skills', 'nested-note', 'assets', 'deep')
    await mkdir(nested, { recursive: true })
    await writeFile(join(project, '.claude', 'skills', 'nested-note', 'SKILL.md'), [
      '---',
      'name: nested-note',
      'description: Nested',
      '---',
      'Body',
    ].join('\n'), 'utf8')
    await writeFile(join(nested, 'ref.txt'), 'deep-asset', 'utf8')
    const cursor = join(project, '.cursor', 'skills')
    await mkdir(cursor, { recursive: true })
    await writeFile(join(cursor, 'nested-note.md'), [
      '---',
      'name: nested-note',
      'description: Cursor twin',
      '---',
      'Twin',
    ].join('\n'), 'utf8')
    const foreign = await listForeign({ projectRoot: project }, home, user)
    expect(foreign.items.map(item => `${item.origin}:${item.name}`)).toEqual([
      'cursor:nested-note',
    ])
    expect(await importForeign({
      location: 'project',
      projectRoot: project,
      source: 'claude',
      name: 'nested-note',
      targetScope: 'project',
    }, home, user)).toEqual({ ok: true })
    expect(await readFile(
      join(project, '.dsh', 'skills', 'nested-note', 'assets', 'deep', 'ref.txt'),
      'utf8',
    )).toBe('deep-asset')
    const personal = join(home, 'skills')
    await mkdir(personal, { recursive: true })
    await writeFile(join(personal, 'nested-note.md'), [
      '---',
      'name: nested-note',
      'description: Already personal',
      '---',
      'x',
    ].join('\n'), 'utf8')
    expect(await importForeign({
      location: 'project',
      projectRoot: project,
      source: 'cursor',
      name: 'nested-note',
      targetScope: 'personal',
    }, home, user)).toEqual({ ok: false, error: 'name-taken' })
    await mkdir(join(project, '.claude', 'skills', 'empty-foreign'), { recursive: true })
    await writeFile(join(project, '.claude', 'skills', 'plain-file'), 'not-a-skill', 'utf8')
    await mkdir(join(project, '.claude', 'skills', 'dir-as-file.md'), { recursive: true })
    expect(await importForeign({
      location: 'project',
      projectRoot: project,
      source: 'claude',
      name: 'empty-foreign',
      targetScope: 'project',
    }, home, user)).toEqual({ ok: false, error: 'foreign-not-found' })
    expect(await importForeign({
      location: 'project',
      projectRoot: project,
      source: 'claude',
      name: 'plain-file',
      targetScope: 'project',
    }, home, user)).toEqual({ ok: false, error: 'foreign-not-found' })
    expect(await importForeign({
      location: 'project',
      projectRoot: project,
      source: 'claude',
      name: 'dir-as-file',
      targetScope: 'project',
    }, home, user)).toEqual({ ok: false, error: 'foreign-not-found' })
    expect(await listForeign({ projectRoot: 'relative' }, home, user)).toEqual({ items: [] })
  })

  it('lists home Claude and Cursor skills and imports without a project', async () => {
    const { home, project, user } = await tempHome()
    const homeClaude = join(user, '.claude', 'skills', 'home-claude')
    const homeCursor = join(user, '.cursor', 'skills')
    const linked = join(user, 'real-link-skill')
    await mkdir(homeClaude, { recursive: true })
    await mkdir(homeCursor, { recursive: true })
    await mkdir(linked, { recursive: true })
    await mkdir(join(user, '.claude', 'skills', 'shared-name'), { recursive: true })
    await writeFile(join(homeClaude, 'SKILL.md'), [
      '---',
      'name: home-claude',
      'description: Home Claude',
      '---',
      'Body',
    ].join('\n'), 'utf8')
    await writeFile(join(homeCursor, 'home-cursor.md'), [
      '---',
      'name: home-cursor',
      'description: Home Cursor',
      '---',
      'Cursor',
    ].join('\n'), 'utf8')
    await writeFile(join(user, '.claude', 'skills', 'shared-name', 'SKILL.md'), [
      '---',
      'name: shared-name',
      'description: Claude shared',
      '---',
      'C',
    ].join('\n'), 'utf8')
    await writeFile(join(homeCursor, 'shared-name.md'), [
      '---',
      'name: shared-name',
      'description: Cursor shared',
      '---',
      'K',
    ].join('\n'), 'utf8')
    await writeFile(join(linked, 'SKILL.md'), [
      '---',
      'name: link-skill',
      'description: Via junction',
      '---',
      'L',
    ].join('\n'), 'utf8')
    await symlink(
      linked,
      join(user, '.claude', 'skills', 'link-skill'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    await mkdir(join(project, '.cursor', 'skills'), { recursive: true })
    await writeFile(join(project, '.cursor', 'skills', 'home-cursor.md'), [
      '---',
      'name: home-cursor',
      'description: Project Cursor',
      '---',
      'P',
    ].join('\n'), 'utf8')
    const homeOnly = await listForeign({}, home, user)
    expect(homeOnly.items.map(item => `${item.location}:${item.origin}:${item.name}`)).toEqual([
      'home:claude:home-claude',
      'home:cursor:home-cursor',
      'home:claude:link-skill',
      'home:cursor:shared-name',
    ])
    expect((await listForeign({ projectRoot: project }, home, user)).items.find(item => item.name === 'home-cursor'))
      .toMatchObject({ location: 'project', origin: 'cursor', description: 'Project Cursor' })
    expect(await importForeign({
      location: 'home',
      source: 'cursor',
      name: 'home-cursor',
      targetScope: 'personal',
    }, home, user)).toEqual({ ok: true })
    expect((await getOwned({ scope: 'personal', name: 'home-cursor' }, home)).skill?.description).toBe('Home Cursor')
    expect((await listForeign({}, home, user)).items.find(item => item.name === 'home-cursor')?.imported).toBe(true)
    expect(await importForeign({
      location: 'home',
      source: 'claude',
      name: 'missing-home',
      targetScope: 'personal',
    }, home, user)).toEqual({ ok: false, error: 'foreign-not-found' })
    expect(await importForeign({
      location: 'home',
      source: 'cursor',
      name: 'home-cursor',
      targetScope: 'project',
      projectRoot: 'relative',
    }, home, user)).toEqual({ ok: false, error: 'invalid-project' })
    expect(await importForeign({
      location: 'home',
      source: 'claude',
      name: 'home-claude',
      targetScope: 'project',
      projectRoot: project,
    }, home, user)).toEqual({ ok: true })
  })

  it('lists a project catalog from owned, agents, Claude, and Cursor roots', async () => {
    const { home, project, user } = await tempHome()
    await mkdir(join(project, '.dsh', 'skills', 'owned-note'), { recursive: true })
    await mkdir(join(project, '.agents', 'skills', 'agents-note'), { recursive: true })
    await mkdir(join(project, '.claude', 'skills', 'claude-note'), { recursive: true })
    await mkdir(join(project, '.cursor', 'skills'), { recursive: true })
    await writeFile(join(project, '.dsh', 'skills', 'owned-note', 'SKILL.md'), [
      '---',
      'name: owned-note',
      'description: Owned',
      '---',
      'O',
    ].join('\n'), 'utf8')
    await writeFile(join(project, '.agents', 'skills', 'agents-note', 'SKILL.md'), [
      '---',
      'name: agents-note',
      'description: Agents',
      '---',
      'A',
    ].join('\n'), 'utf8')
    await writeFile(join(project, '.claude', 'skills', 'claude-note', 'SKILL.md'), [
      '---',
      'name: claude-note',
      'description: Claude',
      '---',
      'C',
    ].join('\n'), 'utf8')
    await writeFile(join(project, '.cursor', 'skills', 'claude-note.md'), [
      '---',
      'name: claude-note',
      'description: Cursor twin',
      '---',
      'K',
    ].join('\n'), 'utf8')
    expect((await listProject({ projectRoot: project }, home, user)).items.map(item => `${item.origin}:${item.name}`))
      .toEqual(['agents:agents-note', 'cursor:claude-note', 'project:owned-note'])
    expect(await listProject({ projectRoot: '' }, home, user)).toEqual({ items: [] })
    expect(await listProject({ projectRoot: 'relative' }, home, user)).toEqual({ items: [] })
  })

  it('walks nested project skills and hides personal names unless the project overrides', async () => {
    const { home, project, user } = await tempHome()
    await mkdir(join(project, 'nested', '.agents', 'skills', 'nested-note'), { recursive: true })
    await mkdir(join(project, '.claude', 'skills', 'personal-twin'), { recursive: true })
    await mkdir(join(project, '.dsh', 'skills', 'personal-twin'), { recursive: true })
    await writeFile(join(project, 'nested', '.agents', 'skills', 'nested-note', 'SKILL.md'), [
      '---',
      'name: nested-note',
      'description: Nested agents',
      '---',
      'N',
    ].join('\n'), 'utf8')
    await writeFile(join(project, '.claude', 'skills', 'personal-twin', 'SKILL.md'), [
      '---',
      'name: personal-twin',
      'description: Claude copy',
      '---',
      'C',
    ].join('\n'), 'utf8')
    await writeFile(join(project, '.dsh', 'skills', 'personal-twin', 'SKILL.md'), [
      '---',
      'name: personal-twin',
      'description: Project wins',
      '---',
      'P',
    ].join('\n'), 'utf8')
    await saveOwned({
      scope: 'personal',
      name: 'personal-twin',
      description: 'Personal',
      content: 'Mine',
      modelInvocable: true,
      userInvocable: true,
    }, home)
    const items = (await listProject({ projectRoot: project }, home, user)).items
    expect(items.map(item => `${item.origin}:${item.name}`)).toEqual([
      'agents:nested-note',
      'project:personal-twin',
    ])
    expect(items.find(item => item.name === 'personal-twin')?.description).toBe('Project wins')
  })

  it('toggles owned skills and copies a foreign skill into an owned root', async () => {
    const { home, project, user } = await tempHome()
    await saveOwned({
      scope: 'personal',
      name: 'toggle-me',
      description: 'On',
      content: 'Body',
      modelInvocable: true,
      userInvocable: true,
    }, home)
    expect(await setEnabled({ name: 'toggle-me', enabled: false }, home)).toEqual({ ok: true })
    expect((await getOwned({ scope: 'personal', name: 'toggle-me' }, home)).skill?.modelInvocable).toBe(false)
    expect(await setEnabled({ name: 'has_underscore', enabled: true }, home)).toEqual({ ok: false, error: 'invalid-name' })
    expect(await setEnabled({ name: 'missing-skill', enabled: true }, home)).toEqual({ ok: false, error: 'not-found' })
    const foreign = join(user, '.cursor', 'skills', 'cursor-only', 'SKILL.md')
    await mkdir(join(user, '.cursor', 'skills', 'cursor-only'), { recursive: true })
    await writeFile(foreign, [
      '---',
      'name: cursor-only',
      'description: Cursor only',
      '---',
      'C',
    ].join('\n'), 'utf8')
    expect(await setEnabled({
      name: 'cursor-only',
      enabled: false,
      sourcePath: foreign,
    }, home)).toEqual({ ok: true })
    expect((await getOwned({ scope: 'personal', name: 'cursor-only' }, home)).skill?.modelInvocable).toBe(false)
    await mkdir(join(project, '.claude', 'skills'), { recursive: true })
    await writeFile(join(project, '.claude', 'skills', 'flat-foreign.md'), [
      '---',
      'name: flat-foreign',
      'description: Flat',
      '---',
      'F',
    ].join('\n'), 'utf8')
    expect(await setEnabled({
      name: 'flat-foreign',
      enabled: true,
      sourcePath: join(project, '.claude', 'skills', 'flat-foreign.md'),
      projectRoot: project,
    }, home)).toEqual({ ok: true })
    expect((await getOwned({
      scope: 'project',
      name: 'flat-foreign',
      projectRoot: project,
    }, home)).ok).toBe(true)
    expect(await setEnabled({
      name: 'toggle-me',
      enabled: true,
      sourcePath: join(home, 'skills', 'toggle-me', 'SKILL.md'),
    }, home)).toEqual({ ok: true })
    await mkdir(join(home, 'skills', 'no-fm'), { recursive: true })
    await writeFile(join(home, 'skills', 'no-fm', 'SKILL.md'), 'plain', 'utf8')
    expect(await setEnabled({
      name: 'no-fm',
      enabled: false,
      sourcePath: join(home, 'skills', 'no-fm', 'SKILL.md'),
    }, home)).toEqual({ ok: false, error: 'not-found' })
    expect((await listOwned({ scope: 'personal' }, home, user)).items.map(item => item.name))
      .toContain('cursor-only')
  })

  it('merges personal roots by rank and hides a personal Claude copy in a project', async () => {
    const { home, project, user } = await tempHome()
    await saveOwned({
      scope: 'personal',
      name: 'shared-note',
      description: 'Dsh wins',
      content: 'Mine',
      modelInvocable: true,
      userInvocable: true,
    }, home)
    await mkdir(join(user, '.agents', 'skills', 'agents-only'), { recursive: true })
    await mkdir(join(user, '.agents', 'skills', 'shared-note'), { recursive: true })
    await mkdir(join(user, '.cursor', 'skills'), { recursive: true })
    await mkdir(join(user, '.claude', 'skills', 'shared-note'), { recursive: true })
    await writeFile(join(user, '.agents', 'skills', 'agents-only', 'SKILL.md'), [
      '---',
      'name: agents-only',
      'description: Agents home',
      '---',
      'A',
    ].join('\n'), 'utf8')
    await writeFile(join(user, '.agents', 'skills', 'shared-note', 'SKILL.md'), [
      '---',
      'name: shared-note',
      'description: Agents loses',
      '---',
      'A',
    ].join('\n'), 'utf8')
    await writeFile(join(user, '.cursor', 'skills', 'shared-note.md'), [
      '---',
      'name: shared-note',
      'description: Cursor loses',
      '---',
      'K',
    ].join('\n'), 'utf8')
    await writeFile(join(user, '.claude', 'skills', 'shared-note', 'SKILL.md'), [
      '---',
      'name: shared-note',
      'description: Claude loses',
      '---',
      'C',
    ].join('\n'), 'utf8')
    const personal = await listOwned({ scope: 'personal' }, home, user)
    expect(personal.items.find(item => item.name === 'shared-note')).toMatchObject({
      origin: 'personal',
      description: 'Dsh wins',
    })
    expect(personal.items.find(item => item.name === 'agents-only')?.origin).toBe('agents')
    await mkdir(join(home, 'skills', 'loean7-codingJournal'), { recursive: true })
    await writeFile(join(home, 'skills', 'loean7-codingJournal', 'SKILL.md'), [
      '---',
      'name: loean7-codingJournal',
      'description: 开发日记',
      '---',
      'J',
    ].join('\n'), 'utf8')
    expect((await listOwned({ scope: 'personal' }, home, user)).items.find(item => item.name === 'loean7-codingJournal'))
      .toMatchObject({ description: '开发日记', origin: 'personal' })
    await mkdir(join(project, '.claude', 'skills', 'shared-note'), { recursive: true })
    await mkdir(join(project, 'docs', 'skills', 'repo-note'), { recursive: true })
    await writeFile(join(project, '.claude', 'skills', 'shared-note', 'SKILL.md'), [
      '---',
      'name: shared-note',
      'description: Project Claude copy',
      '---',
      'C',
    ].join('\n'), 'utf8')
    await writeFile(join(project, 'docs', 'skills', 'repo-note', 'SKILL.md'), [
      '---',
      'name: repo-note',
      'description: In repo',
      '---',
      'R',
    ].join('\n'), 'utf8')
    expect((await listProject({ projectRoot: project }, home, user)).items.map(item => `${item.origin}:${item.name}`))
      .toEqual(['other:repo-note'])
    await writeFile(join(user, '.cursor', 'skills', 'broken-home.md'), '---\nname: broken-home\n---\n', 'utf8')
    expect((await listForeign({}, home, user)).items.find(item => item.name === 'broken-home'))
      .toMatchObject({ location: 'home', origin: 'cursor', description: 'broken-home' })
  })

  it('toggles a flat personal skill and a project-owned bundle', async () => {
    const { home, project } = await tempHome()
    await mkdir(join(home, 'skills'), { recursive: true })
    await writeFile(join(home, 'skills', 'flat-toggle.md'), [
      '---',
      'name: flat-toggle',
      'description: Flat',
      '---',
      'F',
    ].join('\n'), 'utf8')
    expect(await setEnabled({ name: 'flat-toggle', enabled: false }, home)).toEqual({ ok: true })
    expect(await readFile(join(home, 'skills', 'flat-toggle.md'), 'utf8')).toContain('disable-model-invocation: true')
    await mkdir(join(project, '.dsh', 'skills', 'proj-toggle'), { recursive: true })
    await writeFile(join(project, '.dsh', 'skills', 'proj-toggle', 'SKILL.md'), [
      '---',
      'name: proj-toggle',
      'description: Project',
      '---',
      'P',
    ].join('\n'), 'utf8')
    expect(await setEnabled({
      name: 'proj-toggle',
      enabled: false,
      projectRoot: project,
    }, home)).toEqual({ ok: true })
    expect(await setEnabled({
      name: 'proj-toggle',
      enabled: true,
      sourcePath: join(project, '.dsh', 'skills', 'proj-toggle', 'SKILL.md'),
    }, home)).toEqual({ ok: true })
    expect(await setEnabled({
      name: 'proj-toggle',
      enabled: false,
      sourcePath: join(project, '.dsh', 'skills', 'proj-toggle'),
      projectRoot: project,
    }, home)).toEqual({ ok: true })
    expect(await setEnabled({
      name: 'missing-file',
      enabled: true,
      sourcePath: join(home, 'no-such.md'),
    }, home)).toEqual({ ok: false, error: 'not-found' })
    expect(await setEnabled({
      name: 'nope',
      enabled: true,
      sourcePath: join(project, '.dsh', 'skills', 'nope', 'SKILL.md'),
    }, home)).toEqual({ ok: false, error: 'not-found' })
    const foreign = join(project, '.cursor', 'skills', 'copy-me.md')
    await mkdir(join(project, '.cursor', 'skills'), { recursive: true })
    await writeFile(foreign, [
      '---',
      'name: copy-me',
      'description: Copy',
      '---',
      'C',
    ].join('\n'), 'utf8')
    expect(await setEnabled({
      name: 'copy-me',
      enabled: false,
      sourcePath: foreign,
      projectRoot: 'relative',
    }, home)).toEqual({ ok: true })
    expect((await getOwned({ scope: 'personal', name: 'copy-me' }, home)).ok).toBe(true)
    const linkedOwned = join(home, 'real-owned-link')
    await mkdir(linkedOwned, { recursive: true })
    await writeFile(join(linkedOwned, 'SKILL.md'), [
      '---',
      'name: link-owned',
      'description: Linked owned',
      '---',
      'L',
    ].join('\n'), 'utf8')
    await symlink(
      linkedOwned,
      join(home, 'skills', 'link-owned'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    await symlink(
      join(home, 'missing-owned'),
      join(home, 'skills', 'broken-owned'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    expect((await listOwned({ scope: 'personal' }, home)).items.map(item => item.name))
      .toContain('link-owned')
    await mkdir(join(home, 'skills', 'Not_Valid'), { recursive: true })
    await writeFile(join(home, 'skills', 'Not_Valid', 'SKILL.md'), [
      '---',
      'name: not-valid',
      'description: Bad folder',
      '---',
      'X',
    ].join('\n'), 'utf8')
    expect((await listOwned({ scope: 'personal' }, home)).items.map(item => item.name))
      .not.toContain('Not_Valid')
  })
})
