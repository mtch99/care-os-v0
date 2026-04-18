import {
  SessionNotFoundError,
  NoDefaultTemplateError,
  TemplateVersionUnresolvableError,
} from '@careos/api-contract'

import { ChartNote } from './chart-note.aggregate'
import { extractFieldKeys } from './extract-field-keys'
import type {
  ChartNoteRepository,
  TemplateRepository,
  IntakeLookupPort,
  SessionLookupPort,
  Clock,
  EventPublisher,
  FieldValue,
} from './ports'

export interface InitializeChartNoteInput {
  sessionId: string
  discipline: string
  appointmentType: string
  practitionerId: string
}

export interface InitializeChartNoteResult {
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
  created: boolean
}

export interface InitializeChartNotePorts {
  chartNoteRepo: ChartNoteRepository
  templateRepo: TemplateRepository
  intakeLookup: IntakeLookupPort
  sessionLookup: SessionLookupPort
  clock: Clock
  eventPublisher: EventPublisher
}

/**
 * Initialize a chart note for a session.
 *
 * Command handler shape: load aggregate -> call aggregate method -> persist -> emit events.
 *
 * Idempotent: if a chart note already exists for the session, return it with created: false.
 * On concurrent double-tap: adapter handles conflict idempotently via ON CONFLICT DO NOTHING.
 */
export async function initializeChartNote(
  input: InitializeChartNoteInput,
  ports: InitializeChartNotePorts,
): Promise<InitializeChartNoteResult> {
  const { chartNoteRepo, templateRepo, intakeLookup, sessionLookup, clock, eventPublisher } = ports

  // 1. Validate session exists
  const session = await sessionLookup.findById(input.sessionId)
  if (!session) {
    throw new SessionNotFoundError(input.sessionId)
  }

  // 2. Idempotency check: return existing chart note if found
  const existing = await chartNoteRepo.findBySessionId(input.sessionId)
  if (existing) {
    return {
      chartNote: toResult(ChartNote.fromRow(existing)),
      created: false,
    }
  }

  // 3. Look up default template for discipline x appointmentType
  const template = await templateRepo.findDefault(input.discipline, input.appointmentType)
  if (!template) {
    const available = await templateRepo.listByDisciplineAndType(
      input.discipline,
      input.appointmentType,
    )
    throw new NoDefaultTemplateError(input.discipline, input.appointmentType, available)
  }

  // 4. Resolve immutable templateVersionId
  // The template row itself IS the version — its id is the templateVersionId
  if (!template.id) {
    throw new TemplateVersionUnresolvableError(input.discipline, input.appointmentType)
  }

  // 5. Extract field keys from template content
  const fieldKeys = extractFieldKeys(
    template.content as {
      pages: Array<{
        sections: Array<{
          rows: Array<{
            columns: Array<{ key: string }>
          }>
        }>
      }>
    },
  )

  // 6. Pre-populate from intake (link only — no values copied)
  const intakeResult = await intakeLookup.findSignedIntakeForSession(input.sessionId)

  const now = clock.now()

  // 7. Initialize the aggregate
  const chartNote = ChartNote.initialize({
    id: crypto.randomUUID(),
    sessionId: input.sessionId,
    templateVersionId: template.id,
    fieldKeys,
    initializedAt: now,
    initializedBy: input.practitionerId,
    prePopulatedFromIntakeId: intakeResult?.intakeId ?? null,
    prePopulatedFieldIds: intakeResult?.fieldIds ?? [],
  })

  // 8. Persist — adapter handles conflict idempotently via ON CONFLICT DO NOTHING
  const { row: inserted, created } = await chartNoteRepo.insert({
    id: chartNote.id,
    sessionId: chartNote.sessionId,
    templateVersionId: chartNote.templateVersionId,
    status: 'draft',
    fieldValues: chartNote.fieldValues,
    prePopulatedFromIntakeId: chartNote.prePopulatedFromIntakeId,
    version: chartNote.version,
  })

  if (!created) {
    return {
      chartNote: toResult(ChartNote.fromRow(inserted)),
      created: false,
    }
  }

  // 9. Emit events only after successful creation
  for (const event of chartNote.getUncommittedEvents()) {
    eventPublisher.publish(event)
  }

  return {
    chartNote: toResult(ChartNote.fromRow(inserted)),
    created: true,
  }
}

function toResult(note: ChartNote): InitializeChartNoteResult['chartNote'] {
  return {
    id: note.id,
    sessionId: note.sessionId,
    templateVersionId: note.templateVersionId,
    status: note.status,
    fieldValues: note.fieldValues,
    prePopulatedFromIntakeId: note.prePopulatedFromIntakeId,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    version: note.version,
  }
}
