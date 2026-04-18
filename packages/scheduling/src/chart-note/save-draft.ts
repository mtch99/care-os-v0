import {
  ChartNoteNotFoundError,
  NotSessionOwnerError,
  TemplateNotFoundError,
  VersionConflictError,
} from '@careos/api-contract'
import type { TemplateContentV2 } from '@careos/api-contract'

import { ChartNote } from './chart-note.aggregate'
import type {
  ChartNoteRepository,
  TemplateRepository,
  SessionLookupPort,
  Clock,
  EventPublisher,
  FieldValue,
} from './ports'

export interface SaveDraftInput {
  chartNoteId: string
  fieldValues: Record<string, FieldValue>
  version: number
  practitionerId: string
}

export interface SaveDraftResult {
  chartNote: {
    id: string
    sessionId: string
    templateVersionId: string
    status: string
    fieldValues: Record<string, FieldValue>
    prePopulatedFromIntakeId: string | null
    createdAt: string
    updatedAt: string
    version: number
  }
}

export interface SaveDraftPorts {
  chartNoteRepo: ChartNoteRepository
  templateRepo: TemplateRepository
  sessionLookup: SessionLookupPort
  clock: Clock
  eventPublisher: EventPublisher
}

/**
 * Save human edits to a draft chart note (patch semantics).
 *
 * Command handler shape: load aggregate -> call aggregate method -> persist -> emit events.
 *
 * Preconditions (enforced by the aggregate):
 * - Chart note must be in 'draft' status
 * - Version must match (optimistic lock)
 * - All incoming field keys must exist in the template version
 *
 * Preconditions (enforced by the handler):
 * - Chart note must exist
 * - Practitioner must be the session owner
 */
export async function saveDraft(
  input: SaveDraftInput,
  ports: SaveDraftPorts,
): Promise<SaveDraftResult> {
  const { chartNoteRepo, templateRepo, sessionLookup, clock, eventPublisher } = ports

  // 1. Load chart note
  const row = await chartNoteRepo.findById(input.chartNoteId)
  if (!row) {
    throw new ChartNoteNotFoundError(input.chartNoteId)
  }

  // 2. Load session and verify ownership
  const session = await sessionLookup.findById(row.sessionId)
  if (!session || session.practitionerId !== input.practitionerId) {
    throw new NotSessionOwnerError(input.practitionerId)
  }

  // 3. Load template content for key + value validation inside the aggregate.
  // Template must exist since templateVersionId is an FK — missing it is a
  // data-integrity failure, not a user error, so surface it loudly.
  const template = await templateRepo.findById(row.templateVersionId)
  if (!template) {
    throw new TemplateNotFoundError(row.templateVersionId)
  }

  // 4. Reconstitute aggregate and apply the command
  const chartNote = ChartNote.fromRow(row)
  const updated = chartNote.saveDraft({
    incomingFieldValues: input.fieldValues,
    templateContent: template.content as TemplateContentV2,
    editedBy: input.practitionerId,
    editedAt: clock.now(),
    incomingVersion: input.version,
  })

  // 5. Persist — optimistic lock check in the repository
  const persisted = await chartNoteRepo.updateFieldValues({
    id: updated.id,
    fieldValues: updated.fieldValues,
    updatedAt: updated.updatedAt,
    expectedVersion: chartNote.version,
  })

  // If updateFieldValues returns null, a concurrent update occurred between
  // our read and write. The aggregate already validated the version from the
  // client, but another writer may have bumped the DB version in between.
  if (!persisted) {
    const current = await chartNoteRepo.findById(input.chartNoteId)
    throw new VersionConflictError(input.chartNoteId, input.version, current?.version ?? 0)
  }

  // 6. Emit events
  for (const event of updated.getUncommittedEvents()) {
    eventPublisher.publish(event)
  }

  // 7. Return the persisted state
  const result = ChartNote.fromRow(persisted)
  return {
    chartNote: {
      id: result.id,
      sessionId: result.sessionId,
      templateVersionId: result.templateVersionId,
      status: result.status,
      fieldValues: result.fieldValues,
      prePopulatedFromIntakeId: result.prePopulatedFromIntakeId,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      version: result.version,
    },
  }
}
