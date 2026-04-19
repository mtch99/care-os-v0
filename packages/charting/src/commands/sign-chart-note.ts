import { eq } from 'drizzle-orm'
import type { DrizzleDB } from '@careos/db'
import { chartNotes } from '@careos/db'
import {
  ChartNoteNotFoundError,
  ChartNoteNotReadyForSignatureError,
  VersionConflictError,
} from '@careos/api-contract'

export interface SignChartNoteInput {
  chartNoteId: string
  version: number
  /** Practitioner performing the action. Sourced from auth context at the route layer. */
  signedBy: string
}

export interface SignChartNoteResult {
  chartNote: {
    id: string
    sessionId: string
    templateVersionId: string
    status: string
    fieldValues: unknown
    version: number
    signedAt: Date | null
    signedBy: string | null
    createdAt: Date
    updatedAt: Date
  }
  alreadySigned: boolean
}

export interface SignChartNoteEvents {
  'chartNote.signed'?: { chartNoteId: string; signedBy: string; signedAt: string }
}

/**
 * Sign a chart note, transitioning it from readyForSignature to signed (terminal state).
 *
 * Precondition: status must be readyForSignature (cannot sign a draft directly).
 * Idempotency: if the chart note is already signed, return 200 with alreadySigned: true.
 * No events re-emitted on idempotent return.
 */
export async function signChartNote(
  db: DrizzleDB,
  input: SignChartNoteInput,
): Promise<{ result: SignChartNoteResult; events: SignChartNoteEvents }> {
  return db.transaction(async (tx) => {
    // 1. Load chart note
    const chartNote = await tx.query.chartNotes.findFirst({
      where: eq(chartNotes.id, input.chartNoteId),
    })

    if (!chartNote) {
      throw new ChartNoteNotFoundError(input.chartNoteId)
    }

    // 2. Idempotency: already signed -- return current state, no events
    if (chartNote.status === 'signed') {
      return {
        result: {
          chartNote: {
            id: chartNote.id,
            sessionId: chartNote.sessionId,
            templateVersionId: chartNote.templateVersionId,
            status: chartNote.status,
            fieldValues: chartNote.fieldValues,
            version: chartNote.version,
            signedAt: chartNote.signedAt,
            signedBy: chartNote.signedBy,
            createdAt: chartNote.createdAt,
            updatedAt: chartNote.updatedAt,
          },
          alreadySigned: true,
        },
        events: {},
      }
    }

    // 3. Precondition: status must be readyForSignature
    if (chartNote.status !== 'readyForSignature') {
      throw new ChartNoteNotReadyForSignatureError(input.chartNoteId)
    }

    // 4. Optimistic locking: version must match
    if (chartNote.version !== input.version) {
      throw new VersionConflictError(input.chartNoteId, input.version, chartNote.version)
    }

    // 5. Transition to signed, set signedAt/signedBy, bump version
    const now = new Date()
    const [updatedChartNote] = await tx
      .update(chartNotes)
      .set({
        status: 'signed',
        signedAt: now,
        signedBy: input.signedBy,
        version: chartNote.version + 1,
        updatedAt: now,
      })
      .where(eq(chartNotes.id, input.chartNoteId))
      .returning()

    // 6. Build events
    const events: SignChartNoteEvents = {
      'chartNote.signed': {
        chartNoteId: input.chartNoteId,
        signedBy: input.signedBy,
        signedAt: now.toISOString(),
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
          signedAt: updatedChartNote.signedAt,
          signedBy: updatedChartNote.signedBy,
          createdAt: updatedChartNote.createdAt,
          updatedAt: updatedChartNote.updatedAt,
        },
        alreadySigned: false,
      },
      events,
    }
  })
}
