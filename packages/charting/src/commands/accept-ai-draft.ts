import { eq } from 'drizzle-orm'
import type { DrizzleDB } from '@careos/db'
import { chartNotes, aiChartNoteDrafts } from '@careos/db'
import {
  ChartNoteNotFoundError,
  ChartNoteNotDraftError,
  DraftNotFoundError,
  DraftAlreadyResolvedError,
} from '@careos/api-contract'

export interface AcceptAiDraftInput {
  chartNoteId: string
  draftId: string
}

export interface AcceptAiDraftResult {
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
}

export interface AcceptAiDraftEvents {
  'aiChartDraft.accepted': { draftId: string; chartNoteId: string }
}

/**
 * Accept an AI draft: copy draft fieldValues into the chart note (overwrite strategy),
 * mark the draft as accepted.
 *
 * Decision: overwrite, not merge. The AI draft contains the complete set of fields
 * it could fill. Merging with potentially stale partial data risks inconsistency.
 * The practitioner can edit individual fields after acceptance.
 */
export async function acceptAiDraft(
  db: DrizzleDB,
  input: AcceptAiDraftInput,
): Promise<{ result: AcceptAiDraftResult; events: Partial<AcceptAiDraftEvents> }> {
  return db.transaction(async (tx) => {
    // 1. Load AI draft, verify it exists and belongs to the chart note
    const draft = await tx.query.aiChartNoteDrafts.findFirst({
      where: eq(aiChartNoteDrafts.id, input.draftId),
    })

    if (!draft || draft.chartNoteId !== input.chartNoteId) {
      throw new DraftNotFoundError()
    }

    // Idempotent: repeat accept on an already-accepted draft returns current state
    if (draft.status === 'accepted') {
      const chartNote = await tx.query.chartNotes.findFirst({
        where: eq(chartNotes.id, input.chartNoteId),
      })

      if (!chartNote) {
        throw new ChartNoteNotFoundError(input.chartNoteId)
      }

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
        },
        events: {},
      }
    }

    // Contradicting action: draft was resolved to a different status
    if (draft.status !== 'pending') {
      throw new DraftAlreadyResolvedError()
    }

    // 2. Load chart note, verify it is still in draft status
    const chartNote = await tx.query.chartNotes.findFirst({
      where: eq(chartNotes.id, input.chartNoteId),
    })

    if (!chartNote) {
      throw new ChartNoteNotFoundError(input.chartNoteId)
    }

    if (chartNote.status !== 'draft') {
      throw new ChartNoteNotDraftError()
    }

    // 3. Copy draft fieldValues into chart note (overwrite strategy)
    const now = new Date()
    const [updatedChartNote] = await tx
      .update(chartNotes)
      .set({
        fieldValues: draft.fieldValues,
        updatedAt: now,
        version: chartNote.version + 1,
      })
      .where(eq(chartNotes.id, input.chartNoteId))
      .returning()

    // 4. Mark draft as accepted
    await tx
      .update(aiChartNoteDrafts)
      .set({ status: 'accepted' })
      .where(eq(aiChartNoteDrafts.id, input.draftId))

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
      },
      events: {
        'aiChartDraft.accepted': { draftId: input.draftId, chartNoteId: input.chartNoteId },
      },
    }
  })
}
