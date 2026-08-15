import { afterEach, describe, expect, it } from 'vitest'
import { isAppQuitting, markAppQuitting, resetAppQuitting } from '../src/lifecycle.ts'

afterEach(() => {
  resetAppQuitting()
})

describe('desktop quit flag', () => {
  it('starts clear and becomes set for the whole process', () => {
    expect(isAppQuitting()).toBe(false)
    markAppQuitting()
    expect(isAppQuitting()).toBe(true)
    markAppQuitting()
    expect(isAppQuitting()).toBe(true)
  })

  it('resets so a later launch in the same process can hide-on-close again', () => {
    markAppQuitting()
    resetAppQuitting()
    expect(isAppQuitting()).toBe(false)
  })
})
