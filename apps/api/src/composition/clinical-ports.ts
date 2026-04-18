import { eq, and } from 'drizzle-orm'
import { db, chartNotes, chartNoteTemplates, sessions } from '@careos/db'
import type { InitializeChartNotePorts } from '@careos/scheduling'

type AppointmentTypeLiteral = 'initial' | 'follow_up'

function toChartNoteRow(row: {
  id: string
  sessionId: string
  templateVersionId: string
  status: 'draft' | 'readyForSignature' | 'signed'
  fieldValues: unknown
  prePopulatedFromIntakeId: string | null
  signedAt: Date | null
  signedBy: string | null
  createdAt: Date
  updatedAt: Date
  version: number
}) {
  return {
    ...row,
    fieldValues: row.fieldValues ? (row.fieldValues as Record<string, null>) : null,
  }
}

export function makeChartNotePorts(): InitializeChartNotePorts {
  return {
    chartNoteRepo: {
      async findBySessionId(sessionId) {
        const row = await db.query.chartNotes.findFirst({
          where: eq(chartNotes.sessionId, sessionId),
        })
        return row ? toChartNoteRow(row) : null
      },
      async insert(data) {
        const rows = await db
          .insert(chartNotes)
          .values({
            id: data.id,
            sessionId: data.sessionId,
            templateVersionId: data.templateVersionId,
            status: data.status,
            fieldValues: data.fieldValues,
            prePopulatedFromIntakeId: data.prePopulatedFromIntakeId,
            version: data.version,
          })
          .onConflictDoNothing({ target: chartNotes.sessionId })
          .returning()

        if (rows.length > 0) {
          return { row: toChartNoteRow(rows[0]), created: true }
        }

        const existing = await db.query.chartNotes.findFirst({
          where: eq(chartNotes.sessionId, data.sessionId),
        })

        if (!existing) {
          throw new Error(
            `Concurrent conflict resolution failed: chart note for session ${data.sessionId} not found after ON CONFLICT`,
          )
        }

        return { row: toChartNoteRow(existing), created: false }
      },
    },
    templateRepo: {
      async findDefault(discipline, appointmentType) {
        const row = await db.query.chartNoteTemplates.findFirst({
          where: and(
            eq(chartNoteTemplates.discipline, discipline),
            eq(chartNoteTemplates.appointmentType, appointmentType as AppointmentTypeLiteral),
            eq(chartNoteTemplates.isDefault, true),
          ),
        })
        return row ?? null
      },
      async listByDisciplineAndType(discipline, appointmentType) {
        const rows = await db
          .select({
            id: chartNoteTemplates.id,
            name: chartNoteTemplates.name,
            discipline: chartNoteTemplates.discipline,
            appointmentType: chartNoteTemplates.appointmentType,
          })
          .from(chartNoteTemplates)
          .where(
            and(
              eq(chartNoteTemplates.discipline, discipline),
              eq(chartNoteTemplates.appointmentType, appointmentType as AppointmentTypeLiteral),
              eq(chartNoteTemplates.isArchived, false),
            ),
          )
        return rows
      },
    },
    // Stub: IntakeLookupPort — cross-subdomain, no intake aggregate exists yet
    intakeLookup: {
      // eslint-disable-next-line @typescript-eslint/require-await
      async findSignedIntakeForSession() {
        // Patient Intake subdomain not yet implemented.
        // Returns null to indicate no signed intake form available.
        return null
      },
    },
    sessionLookup: {
      async findById(sessionId) {
        const row = await db.query.sessions.findFirst({
          where: eq(sessions.id, sessionId),
        })
        return row ? { id: row.id } : null
      },
    },
    clock: {
      now: () => new Date(),
    },
    // In-process event collector — events are logged for now.
    // Will be replaced by Inngest event publishing in a follow-up.
    eventPublisher: {
      publish(event) {
        console.log(`[event] ${event.type}`, JSON.stringify(event.payload))
      },
    },
  }
}
