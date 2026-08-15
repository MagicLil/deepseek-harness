/**
 * Walk a project tree for SKILL.md and flat skills, regardless of which
 * agent created the folder.
 */

import { readdir, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { isListedSkillName } from './parse.ts'
import type { ManagedSkillSummary } from './types.ts'

/** Directories never descended into. */
export const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'lib',
  'coverage',
  'out',
  'build',
  '.next',
  '.turbo',
  '.cache',
  '.tmp',
  'tmp',
  'vendor',
  '.pnpm-store',
  '.idea',
  '.vscode',
])

/** Dot directories that commonly hold skills. */
export const ENTER_DOT_DIRS = new Set([
  '.dsh',
  '.agents',
  '.claude',
  '.cursor',
  '.codex',
  '.github',
  '.continue',
  '.windsurf',
  '.gemini',
  '.opencode',
  '.codeium',
  '.qwen',
  '.kilocode',
])

/** How deep to walk from a workspace root. */
export const MAX_SCAN_DEPTH = 8

/** A discovered skill file. */
export interface FoundSkillFile {
  /** Absolute path to SKILL.md or a flat markdown file. */
  readonly path: string
  /** Directory-bundle or flat file. */
  readonly kind: 'bundle' | 'flat'
  /** Folder or file stem used as the skill name. */
  readonly name: string
}

/**
 * Infer a catalog origin from a skill file path.
 * @param path - absolute skill file path.
 * @returns origin id.
 */
export function originFromPath(path: string): ManagedSkillSummary['origin'] {
  const normalized = path.replace(/\\/g, '/').toLowerCase()
  if (normalized.includes('/.dsh/skills/') || normalized.endsWith('/.dsh/skills')) return 'project'
  if (normalized.includes('/.agents/skills/') || normalized.endsWith('/.agents/skills')) return 'agents'
  if (normalized.includes('/.claude/skills/') || normalized.endsWith('/.claude/skills')) return 'claude'
  if (normalized.includes('/.cursor/skills/') || normalized.endsWith('/.cursor/skills')) return 'cursor'
  if (normalized.includes('/.codex/skills/') || normalized.endsWith('/.codex/skills')) return 'codex'
  return 'other'
}

/**
 * Rank used when the same name appears in more than one project root.
 * Higher wins, so a project-owned copy overrides a Claude/Cursor copy.
 * @param origin - catalog origin.
 * @returns numeric rank.
 */
export function originRank(origin: ManagedSkillSummary['origin']): number {
  if (origin === 'project') return 5
  if (origin === 'agents') return 4
  if (origin === 'other') return 3
  if (origin === 'cursor') return 2
  if (origin === 'personal') return 0
  return 1
}

/**
 * Whether a project-found skill should stay visible when personal already
 * has the same name. Project-owned and in-repo copies override personal.
 * @param origin - catalog origin.
 * @returns true when the project row should replace the personal one.
 */
export function isProjectOverride(origin: ManagedSkillSummary['origin']): boolean {
  return origin === 'project' || origin === 'agents' || origin === 'other'
}

/**
 * Recursively find skill files under a workspace.
 * @param root - absolute workspace path.
 * @returns discovered files.
 */
export async function findSkillFiles(root: string): Promise<FoundSkillFile[]> {
  const found: FoundSkillFile[] = []
  await walk(root, 0, found)
  return found
}

/**
 * Whether a skill file can be toggled in place.
 * @param path - absolute skill file path.
 * @returns true for `.dsh/skills` and `.agents/skills`.
 */
export function isWritableSkillPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/')
  return normalized.includes('/.dsh/skills/') || normalized.includes('/.agents/skills/')
}

async function walk(root: string, depth: number, found: FoundSkillFile[]): Promise<void> {
  if (depth > MAX_SCAN_DEPTH) return
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(root, entry.name)
    if (await isFile(full)) {
      collectFile(entry.name, full, root, found)
      continue
    }
    if (shouldSkipDir(entry.name)) continue
    if (await isDirectory(full)) await walk(full, depth + 1, found)
  }
}

function shouldSkipDir(name: string): boolean {
  return SKIP_DIR_NAMES.has(name) || (name.startsWith('.') && !ENTER_DOT_DIRS.has(name))
}

function collectFile(
  name: string,
  full: string,
  root: string,
  found: FoundSkillFile[],
): void {
  if (name === 'SKILL.md') {
    const skillName = basename(root)
    if (isListedSkillName(skillName)) found.push({ path: full, kind: 'bundle', name: skillName })
    return
  }
  if (basename(root) === 'skills' && name.endsWith('.md')) {
    const skillName = name.slice(0, -3)
    if (isListedSkillName(skillName)) found.push({ path: full, kind: 'flat', name: skillName })
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

/** Exposed for tests that need the parent of a bundle file. */
export function bundleDirectory(skillFile: string): string {
  return dirname(skillFile)
}
