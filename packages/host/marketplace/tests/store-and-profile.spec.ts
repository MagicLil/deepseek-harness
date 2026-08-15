import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import {
  addPlugin, installedPackageNames, readProfilePackage, reconcileBundles,
  removePlugin, runPnpm, writeProfilePackage,
} from '../src/profile-install.ts'
import { profileDirOf, resolveRunningProfile } from '../src/profile-name.ts'
import { createRuntime, runtimeProfileDir } from '../src/runtime.ts'
import {
  cardsFromStored, extensionsDir, listStored, removeStored, storeVsix, writeManifest,
  type VsixFs,
} from '../src/vsix-store.ts'
import {
  memFs, profilePkg, spawnBare, spawnError, spawnFail, spawnNull, spawnOk, testRuntime,
} from './helpers.ts'

describe('profile-name', () => {
  it('prefers DSH_PROFILE, then Electron, then web', () => {
    expect(resolveRunningProfile({ DSH_PROFILE: ' custom ' })).toBe('custom')
    expect(resolveRunningProfile({}, '1')).toBe('desktop')
    expect(resolveRunningProfile({}, undefined)).toBe('web')
    expect(profileDirOf('desktop', '/home/.dsh')).toBe(join('/home/.dsh', 'profiles', 'desktop'))
    expect(() => profileDirOf('', '/h')).toThrow('invalid profile name')
    expect(() => profileDirOf('a/b', '/h')).toThrow('invalid profile name')
    expect(() => profileDirOf('a\\b', '/h')).toThrow('invalid profile name')
    expect(() => profileDirOf('.', '/h')).toThrow('invalid profile name')
    expect(() => profileDirOf('..', '/h')).toThrow('invalid profile name')
    expect(() => profileDirOf('node_modules', '/h')).toThrow('invalid profile name')
  })
})

describe('runtime', () => {
  it('builds a default runtime and a profile directory', () => {
    const runtime = createRuntime({ DSH_HOME: '/tmp/dsh-home', DSH_PROFILE: 'web' }, undefined)
    expect(runtime.profile).toBe('web')
    expect(runtimeProfileDir(runtime)).toBe(join(runtime.home, 'profiles', 'web'))
  })
})

describe('profile-install', () => {
  it('reads, reconciles, and writes a profile package.json', async () => {
    const fs = memFs()
    const dir = '/p'
    expect(await readProfilePackage(dir, fs.readText)).toEqual({})
    fs.files.set(join(dir, 'package.json'), 'null')
    expect(await readProfilePackage(dir, fs.readText)).toEqual({})
    fs.files.set(join(dir, 'package.json'), '"x"')
    expect(await readProfilePackage(dir, fs.readText)).toEqual({})
    expect(installedPackageNames({})).toEqual(new Set())
    expect(reconcileBundles({}).dsh?.profile?.bundles).toEqual([])
    const next = reconcileBundles({
      dependencies: { a: '1', b: '2' },
      dsh: { profile: { bundles: ['gone', 'a'] } },
    })
    expect(next.dsh?.profile?.bundles).toEqual(['a', 'b'])
    await writeProfilePackage(dir, { dependencies: { a: '1' } }, fs.writeText)
    expect(JSON.parse(String(fs.files.get(join(dir, 'package.json'))))).toEqual({ dependencies: { a: '1' } })
  })

  it('runs pnpm and reconciles after add/remove', async () => {
    const fs = memFs()
    const dir = '/p'
    fs.files.set(join(dir, 'package.json'), JSON.stringify({ dependencies: { a: '1' } }))
    expect(await runPnpm(dir, ['add', 'x'], spawnOk())).toMatchObject({ code: 0 })
    expect(await runPnpm(dir, ['add', 'x'], spawnFail())).toMatchObject({ code: 1 })
    expect(await runPnpm(dir, ['add', 'x'], spawnError())).toMatchObject({ code: 1 })
    expect(await runPnpm(dir, ['add', 'x'], spawnNull())).toMatchObject({ code: 1 })
    expect(await runPnpm(dir, ['add', 'x'], spawnBare())).toMatchObject({ code: 0 })
    const fail = await addPlugin(dir, 'x', false, spawnFail(), fs.readText, fs.writeText)
    expect(fail.code).toBe(1)
    const added = await addPlugin(dir, 'x', true, spawnOk(), fs.readText, fs.writeText)
    expect(added.code).toBe(0)
    expect(JSON.parse(String(fs.files.get(join(dir, 'package.json')))).dsh.profile.bundles).toContain('a')
    const removedFail = await removePlugin(dir, 'a', spawnFail(), fs.readText, fs.writeText)
    expect(removedFail.code).toBe(1)
    const removed = await removePlugin(dir, 'a', spawnOk(), fs.readText, fs.writeText)
    expect(removed.code).toBe(0)
  })
})

describe('vsix-store', () => {
  it('lists, stores, and removes vsix files', async () => {
    const home = '/home'
    const fs = memFs()
    expect(extensionsDir(home)).toBe(join(home, '.dsh', 'extensions'))
    expect(await listStored(home, fs)).toEqual([])
    fs.files.set(join(extensionsDir(home), 'manifest.json'), 'null')
    expect(await listStored(home, fs)).toEqual([])
    fs.files.set(join(extensionsDir(home), 'manifest.json'), '{}')
    expect(await listStored(home, fs)).toEqual([])
    fs.files.set(join(extensionsDir(home), 'manifest.json'), JSON.stringify({ items: [1, { id: 'a' }] }))
    expect(await listStored(home, fs)).toEqual([])
    await writeManifest(home, [], fs)
    const row = await storeVsix(home, {
      id: 'Vue.volar',
      displayName: 'Vue',
      publisher: 'Vue',
      description: 'lang',
    }, new Uint8Array([1]), fs)
    expect(row.fileName).toContain('Vue.volar')
    await storeVsix(home, {
      id: 'Vue.volar',
      displayName: 'Vue2',
      publisher: 'Vue',
      description: 'lang',
      version: '3.0.0',
    }, new Uint8Array([2]), fs)
    const listed = await listStored(home, fs)
    expect(listed).toHaveLength(1)
    expect(listed[0]?.displayName).toBe('Vue2')
    expect(cardsFromStored(listed, new Map([['Vue.volar', { main: './x.js' }]]))[0]?.compatibility)
      .toBe('needs-node-host')
    expect(await removeStored(home, 'missing', fs)).toBe(false)
    expect(await removeStored(home, 'Vue.volar', fs)).toBe(true)
    expect(await listStored(home, fs)).toEqual([])
  })

  it('ignores a failed rm when uninstalling', async () => {
    const home = '/home'
    const fs = memFs()
    await storeVsix(home, {
      id: 'a.b',
      displayName: 'ab',
      publisher: 'a',
      description: '',
    }, new Uint8Array([1]), fs)
    const listed = await listStored(home, fs)
    const row = listed[0]!
    fs.files.set(join(extensionsDir(home), 'files', row.fileName), new Uint8Array([1]))
    const throwing = {
      ...fs,
      rm: (async () => {
        throw new Error('busy')
      }) as VsixFs['rm'],
    }
    expect(await removeStored(home, 'a.b', throwing)).toBe(true)
  })
})

describe('testRuntime helper', () => {
  it('points at an isolated home', () => {
    const runtime = testRuntime('/tmp/h')
    expect(runtime.home).toBe('/tmp/h')
    expect(profilePkg('/tmp/h')).toContain('package.json')
  })
})
