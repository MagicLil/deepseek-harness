// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { DocumentTitle } from '../src/client/DocumentTitle.tsx'

afterEach(() => {
  cleanup()
  document.title = ''
  vi.unstubAllEnvs()
})

describe('DocumentTitle', () => {
  it('preserves the product title without a durable title and restores it on unmount', () => {
    document.title = '万物智汇'
    const mounted = render(<DocumentTitle />)
    expect(document.title).toBe('万物智汇')

    mounted.rerender(<DocumentTitle title="First title" />)
    expect(document.title).toBe('First title — 万物智汇')

    mounted.rerender(<DocumentTitle title="Revised title" />)
    expect(document.title).toBe('Revised title — 万物智汇')

    mounted.rerender(<DocumentTitle />)
    expect(document.title).toBe('万物智汇')
    mounted.unmount()
    expect(document.title).toBe('万物智汇')
  })

  it('uses the generic title when the build provides no title', () => {
    vi.stubEnv('DSH_CLIENT_TITLE', '')
    delete process.env.DSH_CLIENT_TITLE
    const mounted = render(<DocumentTitle title="First title" />)
    expect(document.title).toBe('First title — DSH Local Build')
    mounted.unmount()
    expect(document.title).toBe('DSH Local Build')
  })
})
