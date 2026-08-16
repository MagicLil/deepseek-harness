import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const clientJs = join(fileURLToPath(new URL('..', import.meta.url)), 'lib/client.js')

describe.skipIf(!existsSync(clientJs))('api-remotes client bundle', () => {
  it('inlines zod instead of requiring it from the loader module table', () => {
    const source = readFileSync(clientJs, 'utf8')
    expect(source).not.toContain('require("zod")')
  })
})
