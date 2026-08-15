// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { loadMonaco, resetMonacoLoader } from '../src/client/monaco-loader.ts'

afterEach(() => {
  resetMonacoLoader()
  delete (window as unknown as { monaco?: unknown }).monaco
  delete (window as unknown as { require?: unknown }).require
  document.head.innerHTML = ''
})

function fireLoader(kind: 'load' | 'error'): void {
  const script = document.querySelector('script')
  if (script === null) throw new Error('monaco loader script was not inserted')
  script.dispatchEvent(new Event(kind))
}

describe('loadMonaco', () => {
  it('returns a namespace already on window', async () => {
    const monaco = { already: true }
    ;(window as unknown as { monaco: unknown }).monaco = monaco
    const first = loadMonaco()
    const second = loadMonaco()
    expect(first).toBe(second)
    await expect(first).resolves.toBe(monaco)
  })

  it('boots through the AMD loader', async () => {
    const monaco = { booted: true }
    ;(window as unknown as { require: unknown }).require = Object.assign(
      (mods: string[], onLoad: () => void) => {
        expect(mods).toEqual(['vs/editor/editor.main'])
        ;(window as unknown as { monaco: unknown }).monaco = monaco
        onLoad()
      },
      { config: () => {} },
    )
    const pending = loadMonaco()
    fireLoader('load')
    await expect(pending).resolves.toBe(monaco)
  })

  it('rejects when require is missing, monaco is missing, or the script fails', async () => {
    const missingRequire = loadMonaco()
    fireLoader('load')
    await expect(missingRequire).rejects.toThrow('did not install an AMD require')
    resetMonacoLoader()
    document.head.innerHTML = ''
    ;(window as unknown as { require: unknown }).require = Object.assign(
      (_mods: string[], onLoad: () => void) => { onLoad() },
      { config: () => {} },
    )
    const missingNs = loadMonaco()
    fireLoader('load')
    await expect(missingNs).rejects.toThrow('did not publish window.monaco')
    resetMonacoLoader()
    document.head.innerHTML = ''
    delete (window as unknown as { require?: unknown }).require
    const failedFetch = loadMonaco()
    fireLoader('error')
    await expect(failedFetch).rejects.toThrow('monaco loader fetch failed')
    resetMonacoLoader()
    document.head.innerHTML = ''
    ;(window as unknown as { require: unknown }).require = Object.assign(
      (_mods: string[], _onLoad: () => void, onError: (error: unknown) => void) => { onError('boom') },
      { config: () => {} },
    )
    const amdString = loadMonaco()
    fireLoader('load')
    await expect(amdString).rejects.toThrow('boom')
    resetMonacoLoader()
    document.head.innerHTML = ''
    ;(window as unknown as { require: unknown }).require = Object.assign(
      (_mods: string[], _onLoad: () => void, onError: (error: unknown) => void) => { onError(new Error('amd')) },
      { config: () => {} },
    )
    const amdError = loadMonaco()
    fireLoader('load')
    await expect(amdError).rejects.toThrow('amd')
  })
})
