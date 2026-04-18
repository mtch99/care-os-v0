/**
 * Port interfaces for the ChartNote aggregate.
 *
 * The domain depends on these interfaces; infrastructure adapters implement them.
 * Zero infrastructure imports — only domain types.
 */

/**
 * The runtime shape of a single field's saved value inside a chart note.
 *
 * The union must admit every concrete shape the template content schema
 * (packages/api-contract/src/clinical/field-configs.ts) permits at runtime:
 *
 *   - narrative, text, select, radio, date, signature  → string
 *   - scale                                             → number
 *   - checkboxGroup                                     → string[]             (array of option strings)
 *   - checkboxWithText                                  → unknown[]            (array of { key, checked, text? })
 *   - repeaterTable                                     → unknown[]            (array of { [columnKey]: value })
 *   - table                                             → Record<string, ...>  (already covered)
 *   - bodyDiagram, romDiagram                           → Record<string, ...>  (opaque; passthrough)
 *   - legend                                            → null                 (display-only)
 *
 * `unknown[]` (rather than a tighter per-type variant) keeps this type
 * declarative without forcing every consumer to narrow. The field-value
 * validator (`@careos/clinical`'s FieldValueSchema) narrows to the correct
 * per-type shape at runtime before persistence.
 */
export type FieldValue = string | number | boolean | null | Record<string, unknown> | unknown[]

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
