/** Host Remote for owned skill files and foreign-skill import. */

import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type {} from 'zod'
import {
  deleteOwned,
  getOwned,
  importForeign,
  listForeign,
  listOwned,
  listProject,
  resolveManagerHome,
  setEnabled,
  resolveUserHome,
  saveOwned,
} from './store.ts'
import type {
  Config,
  DeleteOwnedRequest,
  GetOwnedRequest,
  GetOwnedResult,
  ImportForeignRequest,
  ListForeignRequest,
  ListForeignResult,
  ListOwnedRequest,
  ListOwnedResult,
  ListProjectRequest,
  SaveOwnedRequest,
  SetEnabledRequest,
  SkillJobResult,
} from './types.ts'

export type * from './types.ts'

/** Remote-only skill manager (no same-process Context merge). */
export class SkillManagerGateway extends TypertRemoteService {
  /** Resolved harness home used for the personal skill root. */
  dshHome: string
  /** User home used to find Claude / Cursor skills. */
  userHome: string

  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'skillManager')
    this.dshHome = resolveManagerHome(config.dshHome)
    this.userHome = resolveUserHome(config.userHome)
  }

  /**
   * List owned skills in one scope.
   * @param request - scope and optional project root.
   * @returns sorted summaries. A missing project scope returns an empty list.
   */
  @Remote('listOwned')
  listOwned(request: ListOwnedRequest): Promise<ListOwnedResult> {
    return listOwned(request, this.dshHome, this.userHome)
  }

  /**
   * List this product's skills and other-tool skills in one project.
   * @param request - absolute project root.
   * @returns sorted summaries. An invalid project returns an empty list.
   */
  @Remote('listProject')
  listProject(request: ListProjectRequest): Promise<ListOwnedResult> {
    return listProject(request, this.dshHome, this.userHome)
  }

  /**
   * Load one owned skill body.
   * @param request - scope, name, optional project root.
   * @returns the skill or a job error.
   */
  @Remote('getOwned')
  getOwned(request: GetOwnedRequest): Promise<GetOwnedResult> {
    return getOwned(request, this.dshHome)
  }

  /**
   * Create or replace an owned skill as `<name>/SKILL.md`.
   * @param request - fields to persist.
   * @returns job result.
   */
  @Remote('saveOwned')
  saveOwned(request: SaveOwnedRequest): Promise<SkillJobResult> {
    return saveOwned(request, this.dshHome)
  }

  /**
   * Delete an owned directory bundle or flat markdown file.
   * @param request - scope and name.
   * @returns job result.
   */
  @Remote('deleteOwned')
  deleteOwned(request: DeleteOwnedRequest): Promise<SkillJobResult> {
    return deleteOwned(request, this.dshHome)
  }

  /**
   * Turn a listed skill on or off for the model catalog.
   * @param request - name, enabled flag, and optional source path.
   * @returns job result.
   */
  @Remote('setEnabled')
  setEnabled(request: SetEnabledRequest): Promise<SkillJobResult> {
    return setEnabled(request, this.dshHome)
  }

  /**
   * List Claude and Cursor skills from the user home and optional project.
   * Those files stay read-only until imported.
   * @param request - optional project root.
   * @returns sorted foreign summaries.
   */
  @Remote('listForeign')
  listForeign(request: ListForeignRequest): Promise<ListForeignResult> {
    return listForeign(request, this.dshHome, this.userHome)
  }

  /**
   * Copy a foreign skill into an owned root. The source files stay untouched.
   * @param request - source, name, and destination scope.
   * @returns job result.
   */
  @Remote('importForeign')
  importForeign(request: ImportForeignRequest): Promise<SkillJobResult> {
    return importForeign(request, this.dshHome, this.userHome)
  }
}

export default SkillManagerGateway
