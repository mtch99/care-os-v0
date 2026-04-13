/**
 * Port interfaces for the ChartNote aggregate.
 *
 * The domain depends on these interfaces; infrastructure adapters implement them.
 * Zero infrastructure imports — only domain types.
 */

export interface ChartNoteRow {
  id: string
  sessionId: string
  templateVersionId: string
  status: 'draft' | 'readyForSignature' | 'signed'
  fieldValues: Record<string, null> | null
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
  insert(data: {
    id: string
    sessionId: string
    templateVersionId: string
    status: 'draft'
    fieldValues: Record<string, null>
    prePopulatedFromIntakeId: string | null
    version: number
  }): Promise<ChartNoteRow>
}

export interface TemplateRepository {
  findDefault(discipline: string, appointmentType: string): Promise<TemplateRow | null>
  listByDisciplineAndType(discipline: string, appointmentType: string): Promise<TemplateListItem[]>
}

export interface IntakeLookupPort {
  findSignedIntakeForSession(
    sessionId: string,
  ): Promise<{ intakeId: string; fieldIds: string[] } | null>
}

export interface SessionLookupPort {
  findById(sessionId: string): Promise<{ id: string } | null>
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
