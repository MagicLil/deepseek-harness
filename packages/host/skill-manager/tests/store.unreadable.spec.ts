import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    readFile: async (
      path: Parameters<typeof actual.readFile>[0],
      options?: Parameters<typeof actual.readFile>[1],
    ) => {
      if (String(path).includes('gone-note') && String(path).toLowerCase().endsWith('skill.md')) {
        throw new Error('gone')
      }
      return actual.readFile(path, options as BufferEncoding)
    },
  }
})

const { listProject, setEnabled } = await import('../src/store.ts')

describe('skill manager unreadable files', () => {
  it('skips a project skill whose file cannot be read', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-skill-gone-'))
    const home = join(root, 'home')
    const project = join(root, 'project')
    const user = join(root, 'user')
    const skillPath = join(project, '.agents', 'skills', 'gone-note', 'SKILL.md')
    await mkdir(join(project, '.agents', 'skills', 'gone-note'), { recursive: true })
    await writeFile(skillPath, [
      '---',
      'name: gone-note',
      'description: Gone',
      '---',
      'G',
    ].join('\n'), 'utf8')
    expect((await listProject({ projectRoot: project }, home, user)).items).toEqual([
      expect.objectContaining({ name: 'gone-note', description: 'gone-note', origin: 'agents' }),
    ])
    expect(await setEnabled({
      name: 'gone-note',
      enabled: false,
      sourcePath: skillPath,
    }, home)).toEqual({ ok: false, error: 'not-found' })
  })
})
