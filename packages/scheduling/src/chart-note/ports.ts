/**
 * Port interfaces for the ChartNote aggregate.
 *
 * The domain depends on these interfaces; infrastructure adapters implement them.
 * Zero infrastructure imports — only domain types.
 */

export type FieldValue = string | number | boolean | null | Record<string, unknown>

export interface ChartNoteRow {
  id: string
  sessionId: string
  templateVersionId: string
  status: 'draft' | 'readyForSignature' | 'signed'
  fieldValues: Record<string, FieldValue> | null
  prePopulatedFromIntakeId: string | null
  signedAt: Date | null
  signedBy: string | null
  createdAt: Date
  updatedAt: Date
  version: number
}

export interface TemplateRow {
  id: string
  name: string
  discipline: string
  appointmentType: string
  content: unknown
  version: number
  parentTemplateId: string | null
  isDefault: boolean
  isArchived: boolean
}

export interface TemplateListItem {
  id: string
  name: string
  discipline: string
  appointmentType: string
}

export interface ChartNoteRepository {
  findBySessionId(sessionId: string): Promise<ChartNoteRow | null>
  findById(id: string): Promise<ChartNoteRow | null>
  insert(data: {
    id: string
    sessionId: string
    templateVersionId: string
    status: 'draft'
    fieldValues: Record<string, FieldValue>
    prePopulatedFromIntakeId: string | null
    version: number
  }): Promise<{ row: ChartNoteRow; created: boolean }>
  updateFieldValues(data: {
    id: string
    fieldValues: Record<string, FieldValue>
    updatedAt: Date
    expectedVersion: number
  }): Promise<ChartNoteRow | null>
}

export interface TemplateRepository {
  findDefault(discipline: string, appointmentType: string): Promise<TemplateRow | null>
  findById(id: string): Promise<TemplateRow | null>
  listByDisciplineAndType(discipline: string, appointmentType: string): Promise<TemplateListItem[]>
}

export interface IntakeLookupPort {
  findSignedIntakeForSession(
    sessionId: string,
  ): Promise<{ intakeId: string; fieldIds: string[] } | null>
}

export interface SessionLookupPort {
  findById(sessionId: string): Promise<{ id: string; practitionerId: string } | null>
}

export interface Clock {
  now(): Date
}

export interface ChartNoteEvent {
  type: string
  payload: Record<string, unknown>
}

export interface EventPublisher {
  publish(event: ChartNoteEvent): void
}
