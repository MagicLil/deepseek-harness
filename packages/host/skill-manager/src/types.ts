/** Shared skill-manager payloads. JSON-only so they cross the Remote wire. */

/** Owned write scope. Personal is `~/.dsh/skills`; project is `<root>/.dsh/skills`. */
export type SkillScope = 'personal' | 'project'

/** Foreign tool directory that can be imported, never written. */
export type ForeignSkillSource = 'claude' | 'cursor'

/** Whether the foreign skill lives in the user home or the current project. */
export type ForeignSkillLocation = 'home' | 'project'

/** Stable job error codes the Settings page localizes. */
export type SkillManagerErrorCode =
  | 'invalid-name'
  | 'invalid-description'
  | 'name-taken'
  | 'not-found'
  | 'no-project'
  | 'invalid-project'
  | 'foreign-not-found'

/** Invocation flags stored as skill frontmatter. */
export interface SkillInvocationFields {
  /** Whether the model catalog and `skill` tool may load this skill. */
  readonly modelInvocable: boolean
  /** Whether `/name` may load this skill. */
  readonly userInvocable: boolean
}

/** Catalog row for an owned or foreign skill. */
export interface ManagedSkillSummary extends SkillInvocationFields {
  /** Kebab-case skill name. */
  readonly name: string
  /** Short routing description. */
  readonly description: string
  /** Optional extra routing guidance. */
  readonly whenToUse?: string
  /** Personal or project owned root, agents catalog, or a foreign source id. */
  readonly origin: SkillScope | ForeignSkillSource | 'agents' | 'codex' | 'other'
  /** Absolute path to the SKILL.md or flat markdown file. */
  readonly sourcePath?: string
  /** Home or project directory for a foreign skill. */
  readonly location?: ForeignSkillLocation
  /** True when a same-name owned skill already exists in an owned root. */
  readonly imported?: boolean
}

/** Full owned skill body for the editor. */
export interface ManagedSkill extends ManagedSkillSummary {
  /** Markdown instruction body after frontmatter. */
  readonly content: string
}

/** List request for one owned scope. */
export interface ListOwnedRequest {
  /** Personal or project. */
  readonly scope: SkillScope
  /** Absolute project root; required for `project`. */
  readonly projectRoot?: string
}

/** List result. */
export interface ListOwnedResult {
  /** Sorted owned summaries. */
  readonly items: readonly ManagedSkillSummary[]
}

/** Load one owned skill. */
export interface GetOwnedRequest {
  /** Personal or project. */
  readonly scope: SkillScope
  /** Kebab-case name. */
  readonly name: string
  /** Absolute project root; required for `project`. */
  readonly projectRoot?: string
}

/** Create or replace an owned skill. */
export interface SaveOwnedRequest extends SkillInvocationFields {
  /** Personal or project. */
  readonly scope: SkillScope
  /** Kebab-case name. */
  readonly name: string
  /** Short routing description. */
  readonly description: string
  /** Optional extra routing guidance. */
  readonly whenToUse?: string
  /** Markdown instruction body. */
  readonly content: string
  /** Absolute project root; required for `project`. */
  readonly projectRoot?: string
}

/** Delete one owned skill. */
export interface DeleteOwnedRequest {
  /** Personal or project. */
  readonly scope: SkillScope
  /** Kebab-case name. */
  readonly name: string
  /** Absolute project root; required for `project`. */
  readonly projectRoot?: string
}

/** List every recognizable skill root in one project. */
export interface ListProjectRequest {
  /** Absolute project root. */
  readonly projectRoot: string
}

/** Turn a skill on or off for the model catalog. */
export interface SetEnabledRequest {
  /** Kebab-case name. */
  readonly name: string
  /** True when the model may load this skill. */
  readonly enabled: boolean
  /** Absolute path of the file currently listed. */
  readonly sourcePath?: string
  /** Absolute project root when the toggle belongs to a project row. */
  readonly projectRoot?: string
}

/** Scan foreign home and optional project directories. */
export interface ListForeignRequest {
  /** Absolute project root. Home skills are listed even when this is omitted. */
  readonly projectRoot?: string
}

/** Foreign catalog. */
export interface ListForeignResult {
  /** Sorted foreign summaries. */
  readonly items: readonly ManagedSkillSummary[]
}

/** Copy a foreign skill into an owned root. */
export interface ImportForeignRequest {
  /** Absolute project root. Required for a project source or a project target. */
  readonly projectRoot?: string
  /** Claude or Cursor directory. */
  readonly source: ForeignSkillSource
  /** Home or project directory. */
  readonly location: ForeignSkillLocation
  /** Kebab-case name to copy. */
  readonly name: string
  /** Destination owned root. */
  readonly targetScope: SkillScope
}

/** Mutation outcome. */
export interface SkillJobResult {
  /** True when the filesystem write finished. */
  readonly ok: boolean
  /** Stable error code when `ok` is false. */
  readonly error?: SkillManagerErrorCode
}

/** Load outcome. */
export interface GetOwnedResult extends SkillJobResult {
  /** Full skill when `ok` is true. */
  readonly skill?: ManagedSkill
}

/** Cordis plugin config. */
export interface Config {
  /** DeepSeek Harness config root. Defaults to `$DSH_HOME` or `~/.dsh`. */
  readonly dshHome?: string
  /** User home used to find `~/.claude/skills` and `~/.cursor/skills`. */
  readonly userHome?: string
}
