// @vitest-environment jsdom
/**
 * clickSettingsTrigger: no-op without a document or trigger; clicks the
 * existing settings button when present.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clickSettingsTrigger } from '../src/client/settings-trigger.ts'

afterEach(() => { document.body.replaceChildren() })

describe('clickSettingsTrigger', () => {
  it('no-ops when the document is missing or has no trigger', () => {
    expect(() => { clickSettingsTrigger(undefined) }).not.toThrow()
    expect(() => { clickSettingsTrigger(document) }).not.toThrow()
  })

  it('clicks the settings trigger when it exists', () => {
    const trigger = document.createElement('button')
    trigger.setAttribute('aria-haspopup', 'dialog')
    const clicked = vi.fn()
    trigger.addEventListener('click', clicked)
    document.body.append(trigger)
    clickSettingsTrigger(document)
    expect(clicked).toHaveBeenCalledOnce()
  })
})
