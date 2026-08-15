/**
 * SKILL.md frontmatter parse and serialize for the manager.
 * Invocation keys match the local filesystem provider: kebab-case
 * `disable-model-invocation` and `user-invocable`.
 */

import { parse as parseYaml } from 'yaml'
import type { ManagedSkill, SkillInvocationFields } from './types.ts'

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const LISTED_SKILL_NAME = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/

/**
 * Whether a string is a kebab-case skill name.
 * Used when creating a new owned skill.
 * @param name - candidate.
 * @returns true when the name matches the catalog contract.
 */
export function isSkillName(name: string): boolean {
  return SKILL_NAME.test(name)
}

/**
 * Whether an on-disk folder or file stem can be listed.
 * Other agents keep camelCase names such as `loean7-codingJournal`.
 * @param name - candidate.
 * @returns true when the name is safe to show and toggle.
 */
export function isListedSkillName(name: string): boolean {
  return LISTED_SKILL_NAME.test(name)
}

/**
 * Parse a SKILL.md (or flat `<name>.md`) document.
 * @param raw - file text.
 * @returns parsed fields, or undefined when frontmatter is missing or invalid.
 */
export function parseSkillMarkdown(raw: string): Omit<ManagedSkill, 'origin'> | undefined {
  const parsed = parseFrontmatter(raw)
  if (parsed === undefined) return undefined
  const name = stringField(parsed.data, 'name')
  const description = stringField(parsed.data, 'description')
  if (name === undefined || description === undefined || !isListedSkillName(name)) return undefined
  let invocation: SkillInvocationFields
  try {
    invocation = parseInvocationPolicy(parsed.data)
  } catch {
    return undefined
  }
  const whenToUse = stringField(parsed.data, 'whenToUse')
  return {
    name,
    description,
    ...whenToUse === undefined ? {} : { whenToUse },
    modelInvocable: invocation.modelInvocable,
    userInvocable: invocation.userInvocable,
    content: parsed.body.replace(/^\uFEFF/, '').replace(/^\n/, ''),
  }
}

/**
 * Render an owned skill as SKILL.md text.
 * @param skill - fields to persist.
 * @returns file text with YAML frontmatter.
 */
export function serializeSkillMarkdown(skill: {
  readonly name: string
  readonly description: string
  readonly whenToUse?: string
  readonly modelInvocable: boolean
  readonly userInvocable: boolean
  readonly content: string
}): string {
  const lines = [
    '---',
    `name: ${yamlString(skill.name)}`,
    `description: ${yamlString(skill.description)}`,
  ]
  if (skill.whenToUse !== undefined && skill.whenToUse.length > 0) {
    lines.push(`whenToUse: ${yamlString(skill.whenToUse)}`)
  }
  if (!skill.modelInvocable) lines.push('disable-model-invocation: true')
  if (!skill.userInvocable) lines.push('user-invocable: false')
  const body = skill.content.replace(/\r\n/g, '\n').replace(/^\n+/, '')
  lines.push('---', '', body.endsWith('\n') ? body : `${body}\n`)
  return lines.join('\n')
}

function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } | undefined {
  const firstLineEnd = raw.indexOf('\n')
  if (firstLineEnd < 0) return undefined
  const firstLine = raw.slice(0, firstLineEnd).replace(/\r$/, '')
  if (firstLine !== '---') return undefined
  const start = firstLineEnd + 1
  const closing = findClosingFrontmatter(raw, start)
  if (closing === undefined) return undefined
  let parsed: unknown
  try {
    parsed = parseYaml(raw.slice(start, closing.start))
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
  return { data: parsed as Record<string, unknown>, body: raw.slice(closing.bodyStart) }
}

function findClosingFrontmatter(raw: string, start: number): { start: number; bodyStart: number } | undefined {
  let lineStart = start
  while (lineStart <= raw.length) {
    const nextNewline = raw.indexOf('\n', lineStart)
    const lineEnd = nextNewline < 0 ? raw.length : nextNewline
    const line = raw.slice(lineStart, lineEnd).replace(/\r$/, '')
    if (line === '---') {
      return { start: lineStart, bodyStart: nextNewline < 0 ? raw.length : nextNewline + 1 }
    }
    if (nextNewline < 0) return undefined
    lineStart = nextNewline + 1
  }
}

function parseInvocationPolicy(data: Record<string, unknown>): SkillInvocationFields {
  if (Object.hasOwn(data, 'disableModelInvocation') || Object.hasOwn(data, 'modelInvocable')) {
    throw new Error('legacy-invocation')
  }
  if (Object.hasOwn(data, 'userInvocable')) throw new Error('legacy-invocation')
  return {
    modelInvocable: frontmatterBoolean(data, 'disable-model-invocation') !== true,
    userInvocable: frontmatterBoolean(data, 'user-invocable') !== false,
  }
}

function frontmatterBoolean(data: Record<string, unknown>, key: string): boolean | undefined {
  if (!Object.hasOwn(data, key)) return undefined
  const value = data[key]
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1') return true
  if (value === 0 || value === '0') return false
  if (typeof value === 'string') {
    const folded = value.toLowerCase()
    if (folded === 'true' || folded === 'yes' || folded === 'on') return true
    if (folded === 'false' || folded === 'no' || folded === 'off') return false
  }
  throw new TypeError('not-boolean')
}

function stringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Set or clear `disable-model-invocation` without rewriting other frontmatter.
 * @param raw - original SKILL.md text.
 * @param enabled - true when the model may load the skill.
 * @returns updated text, or undefined when frontmatter is missing.
 */
export function setDisableModelInvocation(raw: string, enabled: boolean): string | undefined {
  const firstLineEnd = raw.indexOf('\n')
  if (firstLineEnd < 0) return undefined
  const firstLine = raw.slice(0, firstLineEnd).replace(/\r$/, '')
  if (firstLine !== '---') return undefined
  const start = firstLineEnd + 1
  const closing = findClosingFrontmatter(raw, start)
  if (closing === undefined) return undefined
  const kept = raw.slice(start, closing.start)
    .split(/\r?\n/)
    .filter(line => !/^\s*disable-model-invocation\s*:/.test(line))
  while (kept.length > 0 && kept[kept.length - 1] === '') kept.pop()
  if (!enabled) kept.push('disable-model-invocation: true')
  const body = raw.slice(closing.bodyStart)
  return `---\n${kept.join('\n')}\n---\n${body.startsWith('\n') ? body.slice(1) : body}`
}

function yamlString(value: string): string {
  return JSON.stringify(value)
}
