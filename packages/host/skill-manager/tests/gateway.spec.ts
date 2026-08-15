import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import SkillManagerGateway from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

describe('SkillManagerGateway', () => {
  it('publishes the skillManager remotes and uses Config.dshHome', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-skill-gw-'))
    const ctx = new Context()
    contexts.push(ctx)
    const userHome = join(home, 'nobody')
    await ctx.plugin(SkillManagerGateway, { dshHome: home, userHome })
    const gw = ctx.get('skillManager') as SkillManagerGateway
    expect(gw.typertRemote).toMatchObject({ serviceKey: 'skillManager', namespace: 'skillManager' })
    expect(remoteMethods(gw).map(item => item.method)).toEqual([
      'listOwned',
      'listProject',
      'getOwned',
      'saveOwned',
      'deleteOwned',
      'setEnabled',
      'listForeign',
      'importForeign',
    ])
    expect(gw.dshHome).toBe(home)
    expect(gw.userHome).toBe(userHome)
    expect(await gw.saveOwned({
      scope: 'personal',
      name: 'via-gateway',
      description: 'Saved',
      content: 'Body',
      modelInvocable: true,
      userInvocable: true,
    })).toEqual({ ok: true })
    expect((await gw.listOwned({ scope: 'personal' })).items[0]?.name).toBe('via-gateway')
    expect(await gw.listProject({ projectRoot: '' })).toEqual({ items: [] })
    expect((await gw.getOwned({ scope: 'personal', name: 'via-gateway' })).ok).toBe(true)
    expect(await gw.listForeign({})).toEqual({ items: [] })
    expect(await gw.importForeign({
      location: 'home',
      source: 'claude',
      name: 'via-gateway',
      targetScope: 'personal',
    })).toEqual({ ok: false, error: 'foreign-not-found' })
    expect(await gw.importForeign({
      location: 'project',
      projectRoot: '',
      source: 'claude',
      name: 'via-gateway',
      targetScope: 'personal',
    })).toEqual({ ok: false, error: 'no-project' })
    expect(await gw.setEnabled({ name: 'via-gateway', enabled: false })).toEqual({ ok: true })
    expect(await gw.deleteOwned({ scope: 'personal', name: 'via-gateway' })).toEqual({ ok: true })
  })
})
