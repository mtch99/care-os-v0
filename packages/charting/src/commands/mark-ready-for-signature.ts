import { eq, and } from 'drizzle-orm'
import type { DrizzleDB } from '@careos/db'
import { chartNotes, aiChartNoteDrafts } from '@careos/db'
import { ChartNoteNotFoundError, VersionConflictError } from '@careos/api-contract'

export interface MarkReadyForSignatureInput {
  chartNoteId: string
  version: number
  /** Practitioner performing the action. Sourced from auth context at the route layer. */
  markedBy: string
}

export interface MarkReadyForSignatureResult {
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
  alreadyReady: boolean
}

export interface MarkReadyForSignatureEvents {
  'chartNote.readyForSignature'?: { chartNoteId: string; markedBy: string; markedAt: string }
  'aiChartDraft.rejected'?: Array<{ draftId: string; chartNoteId: string; reason: string }>
}

/**
 * Mark a chart note as ready for signature, freezing fieldValues for review.
 *
 * Idempotency: if the chart note is already readyForSignature or signed,
 * return 200 with alreadyReady: true. No events re-emitted.
 *
 * Cross-aggregate side effect: auto-rejects any pending AI drafts for this
 * chart note within the same transaction.
 */
export async function markReadyForSignature(
  db: DrizzleDB,
  input: MarkReadyForSignatureInput,
): Promise<{ result: MarkReadyForSignatureResult; events: MarkReadyForSignatureEvents }> {
  return db.transaction(async (tx) => {
    // 1. Load chart note
    const chartNote = await tx.query.chartNotes.findFirst({
      where: eq(chartNotes.id, input.chartNoteId),
    })

    if (!chartNote) {
      throw new ChartNoteNotFoundError(input.chartNoteId)
    }

    // 2. Idempotency: already readyForSignature or signed — return current state
    if (chartNote.status === 'readyForSignature' || chartNote.status === 'signed') {
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
          alreadyReady: true,
        },
        events: {},
      }
    }

    // 3. At this point, status can only be 'draft' (readyForSignature and signed
    //    were handled by the idempotency check above).

    // 4. Optimistic locking: version must match
    if (chartNote.version !== input.version) {
      throw new VersionConflictError(input.chartNoteId, input.version, chartNote.version)
    }

    // 5. Auto-reject pending AI drafts for this chart note
    const pendingDrafts = await tx.query.aiChartNoteDrafts.findMany({
      where: and(
        eq(aiChartNoteDrafts.chartNoteId, input.chartNoteId),
        eq(aiChartNoteDrafts.status, 'pending'),
      ),
    })

    const rejectedDraftEvents: Array<{
      draftId: string
      chartNoteId: string
      reason: string
    }> = []

    for (const draft of pendingDrafts) {
      await tx
        .update(aiChartNoteDrafts)
        .set({ status: 'rejected' })
        .where(eq(aiChartNoteDrafts.id, draft.id))

      rejectedDraftEvents.push({
        draftId: draft.id,
        chartNoteId: input.chartNoteId,
        reason: 'auto-rejected on ready-for-signature',
      })
    }

    // 6. Transition chart note to readyForSignature, bump version
    const now = new Date()
    const [updatedChartNote] = await tx
      .update(chartNotes)
      .set({
        status: 'readyForSignature',
        version: chartNote.version + 1,
        updatedAt: now,
      })
      .where(eq(chartNotes.id, input.chartNoteId))
      .returning()

    // 7. Build events
    const events: MarkReadyForSignatureEvents = {
      'chartNote.readyForSignature': {
        chartNoteId: input.chartNoteId,
        markedBy: input.markedBy,
        markedAt: now.toISOString(),
      },
    }

    if (rejectedDraftEvents.length > 0) {
      events['aiChartDraft.rejected'] = rejectedDraftEvents
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
        alreadyReady: false,
      },
      events,
    }
  })
}
