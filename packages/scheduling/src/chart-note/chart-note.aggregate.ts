import type { ChartNoteRow, ChartNoteEvent } from './ports'

/**
 * ChartNote aggregate root.
 *
 * Invariants:
 * - Exactly one ChartNote per sessionId (enforced by UNIQUE constraint + application check)
 * - fieldValues keys must be a subset of the referenced template version's field IDs
 * - Initial state is 'draft'
 * - State machine: draft -> readyForSignature -> signed (only draft is set here)
 */
export class ChartNote {
  private readonly events: ChartNoteEvent[] = []

  private constructor(
    public readonly id: string,
    public readonly sessionId: string,
    public readonly templateVersionId: string,
    public readonly status: 'draft' | 'readyForSignature' | 'signed',
    public readonly fieldValues: Record<string, null>,
    public readonly prePopulatedFromIntakeId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly version: number,
  ) {}

  /**
   * Initialize a new chart note in draft status.
   *
   * Preconditions (enforced by the command handler before calling this):
   * - Session exists
   * - No existing chart note for this session
   * - Default template resolved with a valid templateVersionId
   * - fieldKeys are extracted from the template content
   *
   * This factory enforces the aggregate's own invariants:
   * - Status must be 'draft'
   * - fieldValues keys initialized to null
   */
  static initialize(params: {
    id: string
    sessionId: string
    templateVersionId: string
    fieldKeys: string[]
    initializedAt: Date
    initializedBy: string
    prePopulatedFromIntakeId: string | null
    prePopulatedFieldIds: string[]
  }): ChartNote {
    const fieldValues: Record<string, null> = {}
    for (const key of params.fieldKeys) {
      fieldValues[key] = null
    }

    const note = new ChartNote(
      params.id,
      params.sessionId,
      params.templateVersionId,
      'draft',
      fieldValues,
      params.prePopulatedFromIntakeId,
      params.initializedAt,
      params.initializedAt,
      1,
    )

    note.events.push({
      type: 'chartNote.initialized',
      payload: {
        chartNoteId: params.id,
        sessionId: params.sessionId,
        templateVersionId: params.templateVersionId,
        initializedAt: params.initializedAt.toISOString(),
        initializedBy: params.initializedBy,
      },
    })

    if (params.prePopulatedFromIntakeId) {
      note.events.push({
        type: 'chartNote.prePopulated',
        payload: {
          chartNoteId: params.id,
          intakeId: params.prePopulatedFromIntakeId,
          fieldIdsPopulated: params.prePopulatedFieldIds,
        },
      })
    }

    return note
  }

  /**
   * Reconstitute a ChartNote from a persisted row.
   * Used for idempotent returns — no events emitted.
   */
  static fromRow(row: ChartNoteRow): ChartNote {
    return new ChartNote(
      row.id,
      row.sessionId,
      row.templateVersionId,
      row.status,
      row.fieldValues ?? {},
      row.prePopulatedFromIntakeId,
      row.createdAt,
      row.updatedAt,
      row.version,
    )
  }

  getUncommittedEvents(): readonly ChartNoteEvent[] {
    return [...this.events]
  }
}
