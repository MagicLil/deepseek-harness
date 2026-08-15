import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import type { SpawnFn } from '../src/profile-install.ts'
import type { MarketplaceRuntime } from '../src/runtime.ts'
import type { VsixFs } from '../src/vsix-store.ts'

/** In-memory vsix + profile filesystem. */
export function memFs(): VsixFs & {
  files: Map<string, string | Uint8Array>
  readText: typeof import('node:fs/promises').readFile
  writeText: typeof import('node:fs/promises').writeFile
} {
  const files = new Map<string, string | Uint8Array>()
  const readFile = (async (path: string) => {
    const value = files.get(path)
    if (value === undefined) throw new Error('enoent')
    return value
  }) as VsixFs['readFile']
  const writeFile = (async (path: string, data: string | Uint8Array) => {
    files.set(path, data)
  }) as VsixFs['writeFile']
  const mkdir: VsixFs['mkdir'] = async () => undefined
  const rm: VsixFs['rm'] = async (path) => {
    if (String(path).endsWith('throw')) throw new Error('rm-failed')
    files.delete(String(path))
  }
  return {
    files,
    mkdir,
    readFile,
    writeFile,
    rm,
    readText: readFile,
    writeText: writeFile,
  }
}

/** JSON fetch that never hits the network. */
export function jsonFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return (async () => ({
    ok,
    status,
    json: async () => body,
    arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
  })) as unknown as typeof fetch
}

/** Fetch that throws. */
export function throwFetch(): typeof fetch {
  const impl: typeof fetch = async () => {
    throw new Error('net')
  }
  return impl
}

function child(close: number | null, error?: Error, bare = false): ReturnType<SpawnFn> {
  const emitter = new EventEmitter() as ReturnType<SpawnFn>
  if (!bare) {
    const stdout = new EventEmitter()
    const stderr = new EventEmitter()
    Object.assign(emitter, { stdout, stderr })
    queueMicrotask(() => {
      if (error !== undefined) {
        emitter.emit('error', error)
        return
      }
      stdout.emit('data', 'out\n')
      stderr.emit('data', 'err\n')
      emitter.emit('close', close)
    })
    return emitter
  }
  queueMicrotask(() => {
    emitter.emit('close', close)
  })
  return emitter
}

/** Spawn that exits 0 and writes logs. */
export function spawnOk(): SpawnFn {
  return (() => child(0)) as SpawnFn
}

/** Spawn that exits 1. */
export function spawnFail(): SpawnFn {
  return (() => child(1)) as SpawnFn
}

/** Spawn that emits an error. */
export function spawnError(): SpawnFn {
  return (() => child(1, new Error('spawn-failed'))) as SpawnFn
}

/** Spawn that closes with a null code. */
export function spawnNull(): SpawnFn {
  return (() => child(null)) as SpawnFn
}

/** Spawn with no stdio streams. */
export function spawnBare(): SpawnFn {
  return (() => child(0, undefined, true)) as SpawnFn
}

/** Runtime pointed at a temp home with in-memory I/O. */
export function testRuntime(home: string, extra: Partial<MarketplaceRuntime> = {}): MarketplaceRuntime {
  const fs = memFs()
  return {
    fetch: jsonFetch({ plugins: [] }),
    spawn: spawnOk(),
    home,
    profile: 'desktop',
    vsixFs: fs,
    readFile: fs.readText,
    writeFile: fs.writeText,
    ...extra,
  }
}

/** Profile package.json path. */
export function profilePkg(home: string, profile = 'desktop'): string {
  return join(home, 'profiles', profile, 'package.json')
}
