import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DESKTOP_ICON_SIZE,
  desktopIconFilePath,
  desktopIconRgba,
  ensureDesktopIconFile,
  writeDesktopIconIco,
  writeDesktopIconPng,
} from '../src/icon.ts'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('desktop icon', () => {
  it('paints a green X on a dark rounded plate with transparent corners', () => {
    const pixels = desktopIconRgba(DESKTOP_ICON_SIZE)
    const center = ((DESKTOP_ICON_SIZE * DESKTOP_ICON_SIZE + DESKTOP_ICON_SIZE) / 2) * 4
    expect(pixels.subarray(center, center + 4)).toEqual(Buffer.from([20, 20, 20, 255]))
    expect(pixels.subarray(0, 4)).toEqual(Buffer.from([0, 0, 0, 0]))
    const arm = (91 * DESKTOP_ICON_SIZE + 78) * 4
    expect(pixels.subarray(arm, arm + 4)).toEqual(Buffer.from([91, 183, 59, 255]))
  })

  it('writes a 256×256 RGBA PNG', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-desktop-icon-'))
    dirs.push(dir)
    const path = join(dir, 'icon.png')
    writeDesktopIconPng(path)
    const png = readFileSync(path)
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(png.readUInt32BE(16)).toBe(256)
    expect(png.readUInt32BE(20)).toBe(256)
    expect(png[25]).toBe(6)
  })

  it('writes a one-image PNG-in-ICO', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-desktop-ico-'))
    dirs.push(dir)
    const path = join(dir, 'icon.ico')
    writeDesktopIconIco(path)
    const ico = readFileSync(path)
    expect(ico.readUInt16LE(0)).toBe(0)
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBe(1)
    expect(ico.readUInt32LE(18)).toBe(22)
    expect([...ico.subarray(22, 30)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  })

  it('resolves build/icon.png and overwrites it when unpackaged', () => {
    expect(desktopIconFilePath('C:/app')).toBe(join('C:/app', 'build', 'icon.png'))
    const dir = mkdtempSync(join(tmpdir(), 'dsh-desktop-icon-ensure-'))
    dirs.push(dir)
    const path = join(dir, 'build', 'icon.png')
    expect(ensureDesktopIconFile(path, true)).toBe(path)
    expect(() => readFileSync(path)).toThrow()
    ensureDesktopIconFile(path, false)
    expect(readFileSync(path).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    const first = readFileSync(path)
    ensureDesktopIconFile(path, false)
    expect(readFileSync(path)).toEqual(first)
  })
})
