import { eq } from 'drizzle-orm'
import type { DrizzleDB } from '@careos/db'
import { chartNotes } from '@careos/db'
import {
  ChartNoteNotFoundError,
  ChartNoteAlreadySignedError,
  VersionConflictError,
} from '@careos/api-contract'

export interface ReopenForEditInput {
  chartNoteId: string
  version: number
  /** Practitioner performing the action. Sourced from auth context at the route layer. */
  reopenedBy: string
}

export interface ReopenForEditResult {
  chartNote: {
    id: string
    sessionId: string
    templateVersionId: string
    status: string
    fieldValues: unknown
    version: number
    createdAt: Date
    updatedAt: Date
  }
  alreadyDraft: boolean
}

export interface ReopenForEditEvents {
  'chartNote.reopened'?: { chartNoteId: string; reopenedBy: string; reopenedAt: string }
}

/**
 * Reopen a chart note for editing by walking it back from readyForSignature to draft.
 *
 * Precondition: status must be readyForSignature (cannot reopen a signed note).
 * Idempotency: if the chart note is already in draft, return 200 with alreadyDraft: true.
 * fieldValues are carried over unchanged; only the status flips.
 */
export async function reopenForEdit(
  db: DrizzleDB,
  input: ReopenForEditInput,
): Promise<{ result: ReopenForEditResult; events: ReopenForEditEvents }> {
  return db.transaction(async (tx) => {
    // 1. Load chart note
    const chartNote = await tx.query.chartNotes.findFirst({
      where: eq(chartNotes.id, input.chartNoteId),
    })

    if (!chartNote) {
      throw new ChartNoteNotFoundError(input.chartNoteId)
    }

    // 2. Idempotency: already draft — practitioner's intent is fulfilled
    if (chartNote.status === 'draft') {
      return {
        result: {
          chartNote: {
            id: chartNote.id,
            sessionId: chartNote.sessionId,
            templateVersionId: chartNote.templateVersionId,
            status: chartNote.status,
            fieldValues: chartNote.fieldValues,
            version: chartNote.version,
            createdAt: chartNote.createdAt,
            updatedAt: chartNote.updatedAt,
          },
          alreadyDraft: true,
        },
        events: {},
      }
    }

    // 3. Signed notes cannot be reopened — amendments are a future aggregate
    if (chartNote.status === 'signed') {
      throw new ChartNoteAlreadySignedError(input.chartNoteId)
    }

    // 4. At this point, status can only be 'readyForSignature'

    // 5. Optimistic locking: version must match
    if (chartNote.version !== input.version) {
      throw new VersionConflictError(input.chartNoteId, input.version, chartNote.version)
    }

    // 6. Transition chart note back to draft, bump version
    const now = new Date()
    const [updatedChartNote] = await tx
      .update(chartNotes)
      .set({
        status: 'draft',
        version: chartNote.version + 1,
        updatedAt: now,
      })
      .where(eq(chartNotes.id, input.chartNoteId))
      .returning()

    // 7. Build events
    const events: ReopenForEditEvents = {
      'chartNote.reopened': {
        chartNoteId: input.chartNoteId,
        reopenedBy: input.reopenedBy,
        reopenedAt: now.toISOString(),
      },
    }

    return {
      result: {
        chartNote: {
          id: updatedChartNote.id,
          sessionId: updatedChartNote.sessionId,
          templateVersionId: updatedChartNote.templateVersionId,
          status: updatedChartNote.status,
          fieldValues: updatedChartNote.fieldValues,
          version: updatedChartNote.version,
          createdAt: updatedChartNote.createdAt,
          updatedAt: updatedChartNote.updatedAt,
        },
        alreadyDraft: false,
      },
      events,
    }
  })
}
