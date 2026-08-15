import { describe, expect, it } from 'vitest'
import { errorKey } from '../src/client/errors.ts'
import { filterProjectGroups, filterSkills, matchesSkillQuery } from '../src/client/filter.ts'
import { originKey } from '../src/client/origin.ts'
import { projectRootOf, requireProjectRoot, workspaceTitle } from '../src/client/project-root.ts'

describe('skills settings helpers', () => {
  it('picks the recent workspace path and falls back', () => {
    expect(projectRootOf({ items: [], recentWorkspaceId: undefined })).toBeUndefined()
    expect(projectRootOf({
      items: [{ workspaceId: 'a', path: '/a' }, { workspaceId: 'b', path: '/b' }],
      recentWorkspaceId: 'b',
    })).toBe('/b')
    expect(projectRootOf({
      items: [{ workspaceId: 'a', path: '/a' }],
      recentWorkspaceId: 'missing',
    })).toBe('/a')
    expect(projectRootOf({
      items: [{ workspaceId: 'a', path: '/a' }],
      recentWorkspaceId: undefined,
    })).toBe('/a')
    expect(requireProjectRoot('/proj')).toBe('/proj')
    expect(() => requireProjectRoot(undefined)).toThrow('project-root')
    expect(workspaceTitle('/proj/deepseek-harness')).toBe('deepseek-harness')
    expect(workspaceTitle('C:\\Users\\me\\app\\')).toBe('app')
    expect(workspaceTitle('/')).toBe('/')
    expect(workspaceTitle('')).toBe('')
  })

  it('maps every catalog origin to a locale key', () => {
    expect(originKey('claude')).toBe('origin.claude')
    expect(originKey('cursor')).toBe('origin.cursor')
    expect(originKey('agents')).toBe('origin.agents')
    expect(originKey('personal')).toBe('origin.personal')
    expect(originKey('project')).toBe('origin.project')
    expect(originKey('codex')).toBe('origin.codex')
    expect(originKey('other')).toBe('origin.other')
  })

  it('filters skills by name, description, routing note, or origin', () => {
    const item = {
      name: 'mes-intake',
      description: 'Ask first',
      whenToUse: 'New MES work',
      modelInvocable: true,
      userInvocable: true,
      origin: 'personal' as const,
    }
    expect(matchesSkillQuery(item, '  ')).toBe(true)
    expect(matchesSkillQuery(item, 'MES-INTAKE')).toBe(true)
    expect(matchesSkillQuery(item, 'ask')).toBe(true)
    expect(matchesSkillQuery(item, 'new mes')).toBe(true)
    expect(matchesSkillQuery(item, 'personal')).toBe(true)
    expect(matchesSkillQuery({ ...item, whenToUse: undefined }, 'new mes')).toBe(false)
    expect(filterSkills([item], 'qms')).toEqual([])
    expect(filterSkills([item], 'intake')).toEqual([item])
    expect(filterProjectGroups([
      { id: 'a', items: [item] },
      { id: 'b', items: [{ ...item, name: 'qms-review', description: 'Form' }] },
    ], 'qms')).toEqual([
      { id: 'b', items: [{ ...item, name: 'qms-review', description: 'Form' }] },
    ])
    expect(filterProjectGroups([{ id: 'a', items: [item] }], '')).toEqual([
      { id: 'a', items: [item] },
    ])
  })

  it('maps known job codes and falls back to the generic error key', () => {
    expect(errorKey('name-taken')).toBe('error.name-taken')
    expect(errorKey('foreign-not-found')).toBe('error.foreign-not-found')
    expect(errorKey('nope')).toBe('error')
    expect(errorKey(undefined)).toBe('error')
  })
})
