import { describe, expect, it } from 'vitest'
import { ToolTimelinePresentations } from '../src/client/tool/timeline-presentations.ts'

describe('ToolTimelinePresentations', () => {
  it('keeps unregistered profiles on the native presentation', () => {
    const presentations = new ToolTimelinePresentations()

    expect(presentations.resolve(undefined)).toBeUndefined()
    expect(presentations.resolve('claude')).toBeUndefined()
  })

  it('registers and disposes one independent presentation', () => {
    const presentations = new ToolTimelinePresentations()
    const presentation = { experienceProfile: 'codex', Frame: () => null }

    const dispose = presentations.register(presentation)
    expect(presentations.resolve('codex')).toBe(presentation)
    dispose()
    expect(presentations.resolve('codex')).toBeUndefined()
  })

  it('rejects conflicting profile owners', () => {
    const presentations = new ToolTimelinePresentations()
    presentations.register({ experienceProfile: 'codex', Frame: () => null })

    expect(() => presentations.register({ experienceProfile: 'codex', Frame: () => null })).toThrow('already registered')
  })
})
