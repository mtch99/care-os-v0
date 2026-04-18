import { eq } from 'drizzle-orm'
import type { DrizzleDB } from '@careos/db'
import { aiChartNoteDrafts } from '@careos/db'
import { DraftNotFoundError, DraftAlreadyResolvedError } from '@careos/api-contract'

export interface RejectAiDraftInput {
  chartNoteId: string
  draftId: string
}

export interface RejectAiDraftResult {
  draftId: string
  status: 'rejected'
}

export interface RejectAiDraftEvents {
  'aiChartDraft.rejected': { draftId: string; chartNoteId: string }
}

export async function rejectAiDraft(
  db: DrizzleDB,
  input: RejectAiDraftInput,
): Promise<{ result: RejectAiDraftResult; events: RejectAiDraftEvents }> {
  return db.transaction(async (tx) => {
    // 1. Load AI draft, verify it exists and belongs to the chart note
    const draft = await tx.query.aiChartNoteDrafts.findFirst({
      where: eq(aiChartNoteDrafts.id, input.draftId),
    })

    if (!draft || draft.chartNoteId !== input.chartNoteId) {
      throw new DraftNotFoundError()
    }

    // 2. Verify draft is still pending
    if (draft.status !== 'pending') {
      throw new DraftAlreadyResolvedError()
    }

    // 3. Mark draft as rejected
    await tx
      .update(aiChartNoteDrafts)
      .set({ status: 'rejected' })
      .where(eq(aiChartNoteDrafts.id, input.draftId))

    return {
      result: {
        draftId: input.draftId,
        status: 'rejected' as const,
      },
      events: {
        'aiChartDraft.rejected': { draftId: input.draftId, chartNoteId: input.chartNoteId },
      },
    }
  })
}
