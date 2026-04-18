import {
  ChartNoteNotDraftError,
  UnknownFieldIdError,
  VersionConflictError,
} from '@careos/api-contract'
import type { TemplateContentV2 } from '@careos/api-contract'
import { FieldValueSchema } from '@careos/clinical'

import type { ChartNoteRow, ChartNoteEvent, FieldValue } from './ports'

function collectFieldKeys(content: TemplateContentV2): Set<string> {
  const keys = new Set<string>()
  for (const page of content.pages) {
    for (const section of page.sections) {
      for (const row of section.rows) {
        for (const field of row.columns) {
          keys.add(field.key)
        }
      }
    }
  }
  return keys
}

/**
 * ChartNote aggregate root.
 *
 * Invariants:
 * - Exactly one ChartNote per sessionId (enforced by UNIQUE constraint + application check)
 * - fieldValues keys must be a subset of the referenced template version's field IDs
 * - Initial state is 'draft'
 * - State machine: draft -> readyForSignature -> signed (only draft is set here)
 * - Edits allowed only in 'draft' status
 * - Optimistic locking via version column
 */
export class ChartNote {
  private readonly events: ChartNoteEvent[] = []

  private constructor(
    public readonly id: string,
    public readonly sessionId: string,
    public readonly templateVersionId: string,
    public readonly status: 'draft' | 'readyForSignature' | 'signed',
    public readonly fieldValues: Record<string, FieldValue>,
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
   * Apply human edits to a draft chart note (patch semantics).
   *
   * Preconditions (enforced here on the aggregate):
   * - status must be 'draft'
   * - incoming version must match current version (optimistic lock)
   * - every key in incomingFieldValues must exist in the template's field IDs
   *
   * Merge semantics:
   * - Keys present in incomingFieldValues are merged into existing fieldValues
   * - Keys absent from the payload are left unchanged
   * - A value of null means "clear this field"
   *
   * Returns a new ChartNote with bumped version and chartNote.saved event.
   */
  saveDraft(params: {
    incomingFieldValues: Record<string, FieldValue>
    templateContent: TemplateContentV2
    editedBy: string
    editedAt: Date
    incomingVersion: number
  }): ChartNote {
    // Precondition: must be in draft status
    if (this.status !== 'draft') {
      throw new ChartNoteNotDraftError()
    }

    // Precondition: optimistic lock — version must match
    if (params.incomingVersion !== this.version) {
      throw new VersionConflictError(this.id, params.incomingVersion, this.version)
    }

    // Precondition: every incoming key must exist in the template's field IDs.
    // Key-existence is enforced first so the user sees "this field doesn't
    // exist" before "this field's value is invalid" — the latter is
    // meaningless when the key is bogus.
    const templateFieldSet = collectFieldKeys(params.templateContent)
    const unknownKeys = Object.keys(params.incomingFieldValues).filter(
      (key) => !templateFieldSet.has(key),
    )
    if (unknownKeys.length > 0) {
      throw new UnknownFieldIdError(unknownKeys)
    }

    // Precondition: every incoming value must match its template-declared
    // type and per-type constraints. Throws FieldValueValidationError with
    // all per-field errors collected; propagates unchanged.
    FieldValueSchema.validate(params.incomingFieldValues, params.templateContent)

    // Merge: patch incoming values into existing fieldValues
    const mergedFieldValues: Record<string, FieldValue> = { ...this.fieldValues }
    for (const [key, value] of Object.entries(params.incomingFieldValues)) {
      mergedFieldValues[key] = value
    }

    const nextVersion = this.version + 1
    const fieldIdsChanged = Object.keys(params.incomingFieldValues)

    const updated = new ChartNote(
      this.id,
      this.sessionId,
      this.templateVersionId,
      this.status,
      mergedFieldValues,
      this.prePopulatedFromIntakeId,
      this.createdAt,
      params.editedAt,
      nextVersion,
    )

    updated.events.push({
      type: 'chartNote.saved',
      payload: {
        chartNoteId: this.id,
        editedBy: params.editedBy,
        editedAt: params.editedAt.toISOString(),
        fieldIdsChanged,
      },
    })

    return updated
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
