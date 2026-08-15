/**
 * Generate the desktop window / tray / installer icon as a PNG.
 * @module @deepseek-ai/dsh-desktop/icon
 */

import { deflateSync } from 'node:zlib'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** Pixel size of the shipped PNG (Electron scales it for the tray). */
export const DESKTOP_ICON_SIZE = 256

/**
 * Path of `build/icon.png` under the desktop package (source or packed root).
 * @param packageRoot - `apps/desktop` or the packed app root.
 */
export function desktopIconFilePath(packageRoot: string): string {
  return join(packageRoot, 'build', 'icon.png')
}

/**
 * Path of `build/icon.ico` under the desktop package.
 * @param packageRoot - `apps/desktop` or the packed app root.
 */
export function desktopIconIcoPath(packageRoot: string): string {
  return join(packageRoot, 'build', 'icon.ico')
}

/**
 * Generate the PNG when missing and the tree is writable (dev / pack).
 * Packaged installs must already ship the file.
 * @param path - destination.
 * @param packaged - `app.isPackaged`.
 * @returns `path`.
 */
export function ensureDesktopIconFile(path: string, packaged: boolean): string {
  if (existsSync(path) || packaged) return path
  writeDesktopIconPng(path)
  return path
}

/** Official lockup green (sampled from xmart-web default-logo.png). */
const XMART_GREEN = { r: 91, g: 183, b: 59 }

/** Native mark box used by the SVG X (two bars, evenodd overlap = void). */
const MARK_WIDTH = 40
const MARK_HEIGHT = 24
const MARK_QUADS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[3, 0], [12, 0], [37, 24], [28, 24]],
  [[28, 0], [37, 0], [12, 24], [3, 24]],
]

/**
 * Rasterize the green X: brand green bars, transparent corners and diamond void.
 * @param size - width and height in pixels.
 * @returns tightly packed RGBA bytes.
 */
export function desktopIconRgba(size: number): Buffer {
  const data = Buffer.alloc(size * size * 4)
  const pad = size * 0.12
  const avail = size - pad * 2
  const scale = Math.min(avail / MARK_WIDTH, avail / MARK_HEIGHT)
  const drawW = MARK_WIDTH * scale
  const drawH = MARK_HEIGHT * scale
  const originX = (size - drawW) / 2
  const originY = (size - drawH) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const mx = (x + 0.5 - originX) / scale
      const my = (y + 0.5 - originY) / scale
      if (!inXMark(mx, my)) continue
      const offset = (y * size + x) * 4
      data[offset] = XMART_GREEN.r
      data[offset + 1] = XMART_GREEN.g
      data[offset + 2] = XMART_GREEN.b
      data[offset + 3] = 255
    }
  }
  return data
}

/**
 * Evenodd hit-test for the two diagonal bars.
 * @param x - mark-space x in 0..40.
 * @param y - mark-space y in 0..24.
 */
function inXMark(x: number, y: number): boolean {
  let hits = 0
  for (const quad of MARK_QUADS) {
    if (pointInPolygon(x, y, quad)) hits += 1
  }
  return hits === 1
}

/**
 * Ray-cast point-in-polygon.
 * @param x - query x.
 * @param y - query y.
 * @param poly - closed polygon vertices.
 */
function pointInPolygon(
  x: number,
  y: number,
  poly: ReadonlyArray<readonly [number, number]>,
): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const current = poly[i]
    const previous = poly[j]
    if (current === undefined || previous === undefined) continue
    const [xi, yi] = current
    const [xj, yj] = previous
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Write a PNG for {@link desktopIconRgba} at {@link DESKTOP_ICON_SIZE}.
 * @param path - destination file.
 */
export function writeDesktopIconPng(path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, encodePng(DESKTOP_ICON_SIZE, DESKTOP_ICON_SIZE, desktopIconRgba(DESKTOP_ICON_SIZE)))
}

/**
 * Write a PNG-in-ICO (Vista+) so electron-builder does not download an icon converter.
 * @param path - destination `.ico`.
 */
export function writeDesktopIconIco(path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const png = encodePng(DESKTOP_ICON_SIZE, DESKTOP_ICON_SIZE, desktopIconRgba(DESKTOP_ICON_SIZE))
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  header[6] = 0
  header[7] = 0
  header[8] = 0
  header[9] = 0
  header.writeUInt16LE(1, 10)
  header.writeUInt16LE(32, 12)
  header.writeUInt32LE(png.length, 14)
  header.writeUInt32LE(22, 18)
  writeFileSync(path, Buffer.concat([header, png]))
}

/**
 * Encode an RGBA buffer as a PNG.
 * @param width - pixel width.
 * @param height - pixel height.
 * @param rgba - tightly packed RGBA bytes.
 */
function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * One PNG chunk (length + type + data + CRC).
 * @param type - four-character chunk type.
 * @param data - chunk payload.
 */
function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([length, typeBuf, data, crc])
}

/**
 * PNG CRC-32 (IEEE 802.3).
 * @param data - bytes to checksum.
 */
function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}
