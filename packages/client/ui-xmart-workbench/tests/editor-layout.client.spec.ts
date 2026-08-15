// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bindEditorLayout, isSashTarget } from '../src/client/editor-layout.ts'

let resizeCb: ResizeObserverCallback | undefined
class ResizeObserverStub {
  constructor(cb: ResizeObserverCallback) { resizeCb = cb }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void { resizeCb = undefined }
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

function sizedHost(width: number, height: number): HTMLDivElement {
  const host = document.createElement('div')
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: width })
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: height })
  document.body.append(host)
  return host
}

function sash(): HTMLDivElement {
  const handle = document.createElement('div')
  handle.setAttribute('data-side', 'conversation')
  document.body.append(handle)
  return handle
}

describe('isSashTarget', () => {
  it('accepts a drag handle and rejects other nodes', () => {
    const handle = sash()
    const inner = document.createElement('span')
    handle.append(inner)
    expect(isSashTarget(handle)).toBe(true)
    expect(isSashTarget(inner)).toBe(true)
    expect(isSashTarget(document.createElement('div'))).toBe(false)
    expect(isSashTarget(null)).toBe(false)
  })
})

describe('bindEditorLayout', () => {
  it('layouts immediately when the host has a box', () => {
    const host = sizedHost(800, 600)
    const editor = { layout: vi.fn() }
    const dispose = bindEditorLayout(editor, host)
    expect(editor.layout).toHaveBeenCalledWith({ width: 800, height: 600 })
    resizeCb?.([] as never, {} as ResizeObserver)
    expect(editor.layout).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('freezes the host on sash pointerdown so a drag cannot wipe the canvas', () => {
    const host = sizedHost(800, 600)
    const handle = sash()
    const editor = { layout: vi.fn() }
    const dispose = bindEditorLayout(editor, host)
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(host.style.width).toBe('800px')
    expect(host.style.height).toBe('600px')
    Object.defineProperty(host, 'clientWidth', { configurable: true, value: 640 })
    resizeCb?.([] as never, {} as ResizeObserver)
    expect(editor.layout).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('layouts the released size on pointerup', () => {
    const host = sizedHost(800, 600)
    const handle = sash()
    const editor = { layout: vi.fn() }
    const dispose = bindEditorLayout(editor, host)
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    Object.defineProperty(host, 'clientWidth', { configurable: true, value: 640 })
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    expect(host.style.width).toBe('')
    expect(editor.layout).toHaveBeenLastCalledWith({ width: 640, height: 600 })
    dispose()
  })

  it('ignores pointerdown that is not a sash and skips a zero box', () => {
    const host = sizedHost(0, 0)
    const handle = sash()
    const editor = { layout: vi.fn() }
    const dispose = bindEditorLayout(editor, host)
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    expect(host.style.width).toBe('')
    expect(editor.layout).not.toHaveBeenCalled()
    dispose()
  })

  it('pointercancel unfreezes and dispose clears a live freeze', () => {
    const host = sizedHost(400, 300)
    const handle = sash()
    const editor = { layout: vi.fn() }
    const dispose = bindEditorLayout(editor, host)
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(host.style.width).toBe('400px')
    document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }))
    expect(host.style.width).toBe('')
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    dispose()
    expect(host.style.width).toBe('')
    expect(resizeCb).toBeUndefined()
  })
})
