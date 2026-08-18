/** Registry of independently packaged Tool timeline presentations. */
import type { ToolTimelinePresentation } from '../contract/slots.ts'

/** Runtime registry consumed by the generic Tool call tree. */
export interface IToolTimelinePresentations {
  /** Add one profile-owned presentation. @param presentation - unique profile renderer. @returns disposer. */
  register(presentation: ToolTimelinePresentation): () => void
  /** Resolve the selected presentation. @param experienceProfile - declared preset profile. @returns matching renderer, if loaded. */
  resolve(experienceProfile: string | undefined): ToolTimelinePresentation | undefined
}

/** Mutable registry whose ownership stays inside the Tool UI package. */
export class ToolTimelinePresentations implements IToolTimelinePresentations {
  private readonly presentations = new Map<string, ToolTimelinePresentation>()

  register(presentation: ToolTimelinePresentation): () => void {
    if (this.presentations.has(presentation.experienceProfile)) {
      throw new Error(`Tool timeline presentation already registered: ${presentation.experienceProfile}`)
    }
    this.presentations.set(presentation.experienceProfile, presentation)
    return () => { this.presentations.delete(presentation.experienceProfile) }
  }

  resolve(experienceProfile: string | undefined): ToolTimelinePresentation | undefined {
    return experienceProfile === undefined ? undefined : this.presentations.get(experienceProfile)
  }
}
