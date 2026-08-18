import { describe, expect, it } from 'vitest'
import { imageMimeType } from '../src/image-mime.ts'

describe('imageMimeType', () => {
  it('maps known image extensions on POSIX and Windows paths', () => {
    expect(imageMimeType('/ws/a.png')).toBe('image/png')
    expect(imageMimeType('C:\\ws\\Photo.JPEG')).toBe('image/jpeg')
    expect(imageMimeType('a.jpg')).toBe('image/jpeg')
    expect(imageMimeType('a.gif')).toBe('image/gif')
    expect(imageMimeType('a.webp')).toBe('image/webp')
    expect(imageMimeType('a.svg')).toBe('image/svg+xml')
    expect(imageMimeType('a.bmp')).toBe('image/bmp')
    expect(imageMimeType('a.ico')).toBe('image/x-icon')
  })

  it('falls back when the extension is missing or unknown', () => {
    expect(imageMimeType('/ws/README')).toBe('application/octet-stream')
    expect(imageMimeType('/ws/a.')).toBe('application/octet-stream')
    expect(imageMimeType('/ws/a.bin')).toBe('application/octet-stream')
  })
})
