import { describe, expect, it } from 'vitest'
import { resolveExperienceProfile } from '../src/client/experience-profile.ts'

describe('resolveExperienceProfile', () => {
  const presets = [
    { id: 'standard' },
    { id: 'codex', experienceProfile: 'codex' },
    { id: 'claude', experienceProfile: 'claude' },
  ]

  it('preserves native DSH for sessions without a declared experience', () => {
    expect(resolveExperienceProfile(undefined, presets)).toBeUndefined()
    expect(resolveExperienceProfile('standard', presets)).toBeUndefined()
  })

  it('resolves each mode without coupling one profile to another', () => {
    expect(resolveExperienceProfile('codex', presets)).toBe('codex')
    expect(resolveExperienceProfile('claude', presets)).toBe('claude')
  })
})
