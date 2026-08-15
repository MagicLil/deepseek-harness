import type { SkillsKey } from './locales.ts'

const ERROR_KEYS = {
  'invalid-name': 'error.invalid-name',
  'invalid-description': 'error.invalid-description',
  'name-taken': 'error.name-taken',
  'not-found': 'error.not-found',
  'no-project': 'error.no-project',
  'invalid-project': 'error.invalid-project',
  'foreign-not-found': 'error.foreign-not-found',
} as const satisfies Record<string, SkillsKey>

/**
 * Map a Host job error code to a locale key.
 * @param code - Host `SkillManagerErrorCode` or unknown text.
 * @returns a SkillsKey for `t()`.
 */
export function errorKey(code: string | undefined): SkillsKey {
  if (code !== undefined && Object.hasOwn(ERROR_KEYS, code)) {
    return ERROR_KEYS[code as keyof typeof ERROR_KEYS]
  }
  return 'error'
}
