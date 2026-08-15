import { describe, expect, it } from 'vitest'
import { isListedSkillName, isSkillName, parseSkillMarkdown, serializeSkillMarkdown, setDisableModelInvocation } from '../src/parse.ts'

describe('skill markdown parse and serialize', () => {
  it('accepts kebab-case names only', () => {
    expect(isSkillName('mes-intake')).toBe(true)
    expect(isSkillName('MES')).toBe(false)
    expect(isSkillName('has_underscore')).toBe(false)
    expect(isSkillName('loean7-codingJournal')).toBe(false)
    expect(isListedSkillName('loean7-codingJournal')).toBe(true)
    expect(isListedSkillName('mes-intake')).toBe(true)
    expect(isListedSkillName('has_underscore')).toBe(false)
    expect(isListedSkillName('_loean7-meta')).toBe(false)
  })

  it('parses frontmatter, invocation defaults, and the body', () => {
    const parsed = parseSkillMarkdown([
      '---',
      'name: mes-intake',
      'description: Ask before inventing tables',
      'whenToUse: New MES work',
      '---',
      '',
      'Do not invent APIs.',
      '',
    ].join('\n'))
    expect(parsed).toEqual({
      name: 'mes-intake',
      description: 'Ask before inventing tables',
      whenToUse: 'New MES work',
      modelInvocable: true,
      userInvocable: true,
      content: 'Do not invent APIs.\n',
    })
  })

  it('reads kebab-case invocation flags and string booleans', () => {
    const parsed = parseSkillMarkdown([
      '---',
      'name: user-only',
      'description: Person only',
      'disable-model-invocation: yes',
      'user-invocable: "true"',
      '---',
      'Body',
    ].join('\n'))
    expect(parsed?.modelInvocable).toBe(false)
    expect(parsed?.userInvocable).toBe(true)
    const off = parseSkillMarkdown([
      '---',
      'name: hidden',
      'description: Off',
      'disable-model-invocation: 0',
      'user-invocable: off',
      '---',
      'x',
    ].join('\n'))
    expect(off?.modelInvocable).toBe(true)
    expect(off?.userInvocable).toBe(false)
  })

  it('rejects missing fences, names, legacy keys, and bad booleans', () => {
    expect(parseSkillMarkdown('no frontmatter')).toBeUndefined()
    expect(parseSkillMarkdown('---\nname: x\n')).toBeUndefined()
    expect(parseSkillMarkdown('---\n[]\n---\n')).toBeUndefined()
    expect(parseSkillMarkdown('---\nname: has_underscore\ndescription: x\n---\n')).toBeUndefined()
    expect(parseSkillMarkdown('---\nname: loean7-codingJournal\ndescription: Dev diary\n---\n')?.name)
      .toBe('loean7-codingJournal')
    expect(parseSkillMarkdown('---\nname: ok\n---\n')).toBeUndefined()
    expect(parseSkillMarkdown('---\nname: ok\ndescription: x\ndisableModelInvocation: true\n---\n')).toBeUndefined()
    expect(parseSkillMarkdown('---\nname: ok\ndescription: x\nuserInvocable: true\n---\n')).toBeUndefined()
    expect(parseSkillMarkdown('---\nname: [\n---\n')).toBeUndefined()
    expect(parseSkillMarkdown('---\nname: ok\ndescription: x\nuser-invocable: maybe\n---\n')).toBeUndefined()
    expect(parseSkillMarkdown('---\nname: ok\ndescription: x\nmodelInvocable: true\n---\n')).toBeUndefined()
    expect(parseSkillMarkdown('---')).toBeUndefined()
    expect(parseSkillMarkdown('hello\n---\nname: ok\ndescription: x\n---\n')).toBeUndefined()
    expect(parseSkillMarkdown('---\nname: ok\ndescription: x\nuser-invocable: 2\n---\n')).toBeUndefined()
    expect(parseSkillMarkdown('---\nnull\n---\n')).toBeUndefined()
    expect(parseSkillMarkdown('---\njust-a-string\n---\n')).toBeUndefined()
  })

  it('round-trips optional fields and invocation overrides', () => {
    const text = serializeSkillMarkdown({
      name: 'qms-review',
      description: 'Review a QMS change',
      whenToUse: 'Before editing inspection pages',
      modelInvocable: false,
      userInvocable: false,
      content: 'Check the form first.\n',
    })
    expect(text).toContain('disable-model-invocation: true')
    expect(text).toContain('user-invocable: false')
    expect(parseSkillMarkdown(text)).toMatchObject({
      name: 'qms-review',
      whenToUse: 'Before editing inspection pages',
      modelInvocable: false,
      userInvocable: false,
      content: 'Check the form first.\n',
    })
    const minimal = serializeSkillMarkdown({
      name: 'plain',
      description: 'D',
      whenToUse: '',
      modelInvocable: true,
      userInvocable: true,
      content: 'Body',
    })
    expect(minimal).not.toContain('whenToUse')
    expect(minimal).not.toContain('disable-model-invocation')
    expect(parseSkillMarkdown(minimal)?.content).toBe('Body\n')
    const omitted = serializeSkillMarkdown({
      name: 'plain',
      description: 'D',
      modelInvocable: true,
      userInvocable: true,
      content: '\nLeading',
    })
    expect(omitted).not.toContain('whenToUse')
    expect(parseSkillMarkdown(omitted)?.content).toBe('Leading\n')
    const bom = parseSkillMarkdown('---\nname: bom-skill\ndescription: D\n---\n\uFEFFBody')
    expect(bom?.content).toBe('Body')
    const upper = parseSkillMarkdown('---\nname: case-skill\ndescription: D\ndisable-model-invocation: TRUE\n---\nX')
    expect(upper?.modelInvocable).toBe(false)
  })

  it('accepts CRLF fences and numeric invocation flags', () => {
    const parsed = parseSkillMarkdown([
      '---\r',
      'name: crlf-skill\r',
      'description: Windows\r',
      'disable-model-invocation: 1\r',
      'user-invocable: 0\r',
      '---\r',
      'Body\r',
    ].join('\n'))
    expect(parsed).toMatchObject({
      name: 'crlf-skill',
      modelInvocable: false,
      userInvocable: false,
    })
    const on = parseSkillMarkdown('---\nname: on-skill\ndescription: D\nuser-invocable: on\n---\nX')
    expect(on?.userInvocable).toBe(true)
    const no = parseSkillMarkdown('---\nname: no-skill\ndescription: D\nuser-invocable: no\n---\nX')
    expect(no?.userInvocable).toBe(false)
    const bools = parseSkillMarkdown('---\nname: bool-skill\ndescription: D\ndisable-model-invocation: false\nuser-invocable: true\n---\nX')
    expect(bools).toMatchObject({ modelInvocable: true, userInvocable: true })
    expect(parseSkillMarkdown('---\nname: eof-skill\ndescription: D\n---')).toMatchObject({
      name: 'eof-skill',
      content: '',
    })
  })

  it('toggles disable-model-invocation without dropping other keys', () => {
    const raw = [
      '---',
      'name: toggle-me',
      'description: Keep me',
      'version: "1.0.0"',
      '---',
      '',
      'Body',
      '',
    ].join('\n')
    const off = setDisableModelInvocation(raw, false)
    expect(off).toContain('disable-model-invocation: true')
    expect(off).toContain('version: "1.0.0"')
    expect(parseSkillMarkdown(off ?? '')?.modelInvocable).toBe(false)
    const on = setDisableModelInvocation(off ?? '', true)
    expect(on).not.toContain('disable-model-invocation')
    expect(parseSkillMarkdown(on ?? '')?.modelInvocable).toBe(true)
    expect(setDisableModelInvocation('no frontmatter', false)).toBeUndefined()
    expect(setDisableModelInvocation('---', false)).toBeUndefined()
    expect(setDisableModelInvocation('hello\n---\n', false)).toBeUndefined()
    expect(setDisableModelInvocation('---\nname: x\n', false)).toBeUndefined()
    const tight = setDisableModelInvocation('---\nname: tight\ndescription: D\n---\nBody\n', false)
    expect(tight).toContain('Body')
    expect(tight).toContain('disable-model-invocation: true')
    const padded = setDisableModelInvocation('---\nname: padded\ndescription: D\n\n---\n\nBody\n', true)
    expect(padded).not.toContain('disable-model-invocation')
  })
})
