/* eslint-disable @typescript-eslint/require-await,  */
/**
 * In-memory fake ports for testing the ChartNote aggregate and initialize command.
 * Deterministic and reusable across tests. No real DB, no real HTTP.
 */
import type {
  ChartNoteRepository,
  ChartNoteRow,
  TemplateRepository,
  TemplateRow,
  TemplateListItem,
  IntakeLookupPort,
  SessionLookupPort,
  Clock,
  EventPublisher,
  ChartNoteEvent,
} from './ports'

export class FakeChartNoteRepository implements ChartNoteRepository {
  private store: ChartNoteRow[] = []

  async findBySessionId(sessionId: string): Promise<ChartNoteRow | null> {
    return this.store.find((r) => r.sessionId === sessionId) ?? null
  }

  async insert(data: {
    id: string
    sessionId: string
    templateVersionId: string
    status: 'draft'
    fieldValues: Record<string, null>
    prePopulatedFromIntakeId: string | null
    version: number
  }): Promise<{ row: ChartNoteRow; created: boolean }> {
    const existing = this.store.find((r) => r.sessionId === data.sessionId)
    if (existing) {
      return { row: existing, created: false }
    }

    const row: ChartNoteRow = {
      id: data.id,
      sessionId: data.sessionId,
      templateVersionId: data.templateVersionId,
      status: data.status,
      fieldValues: data.fieldValues,
      prePopulatedFromIntakeId: data.prePopulatedFromIntakeId,
      signedAt: null,
      signedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: data.version,
    }
    this.store.push(row)
    return { row, created: true }
  }

  seed(row: ChartNoteRow): void {
    this.store.push(row)
  }

  getAll(): readonly ChartNoteRow[] {
    return [...this.store]
  }
}

export class FakeTemplateRepository implements TemplateRepository {
  private defaults: TemplateRow[] = []
  private allTemplates: TemplateListItem[] = []

  async findDefault(discipline: string, appointmentType: string): Promise<TemplateRow | null> {
    return (
      this.defaults.find(
        (t) => t.discipline === discipline && t.appointmentType === appointmentType && t.isDefault,
      ) ?? null
    )
  }

  async listByDisciplineAndType(
    discipline: string,
    appointmentType: string,
  ): Promise<TemplateListItem[]> {
    return this.allTemplates.filter(
      (t) => t.discipline === discipline && t.appointmentType === appointmentType,
    )
  }

  seedDefault(template: TemplateRow): void {
    this.defaults.push(template)
  }

  seedList(templates: TemplateListItem[]): void {
    this.allTemplates.push(...templates)
  }
}

export class FakeIntakeLookup implements IntakeLookupPort {
  private result: { intakeId: string; fieldIds: string[] } | null = null

  async findSignedIntakeForSession(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _sessionId: string,
  ): Promise<{ intakeId: string; fieldIds: string[] } | null> {
    return this.result
  }

  setResult(result: { intakeId: string; fieldIds: string[] } | null): void {
    this.result = result
  }
}

export class FakeSessionLookup implements SessionLookupPort {
  private sessions: Map<string, { id: string }> = new Map()

  async findById(sessionId: string): Promise<{ id: string } | null> {
    return this.sessions.get(sessionId) ?? null
  }

  seed(sessionId: string): void {
    this.sessions.set(sessionId, { id: sessionId })
  }
}

export class FakeClock implements Clock {
  private fixedTime: Date

  constructor(fixedTime: Date = new Date('2026-04-12T10:00:00.000Z')) {
    this.fixedTime = fixedTime
  }

  now(): Date {
    return this.fixedTime
  }

  setTime(time: Date): void {
    this.fixedTime = time
  }
}

export class FakeEventPublisher implements EventPublisher {
  private events: ChartNoteEvent[] = []

  publish(event: ChartNoteEvent): void {
    this.events.push(event)
  }

  getPublished(): readonly ChartNoteEvent[] {
    return [...this.events]
  }

  clear(): void {
    this.events = []
  }
}
