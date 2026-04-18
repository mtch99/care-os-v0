import { eq, and } from 'drizzle-orm'
import type { DrizzleDB } from '@careos/db'
import { chartNotes, chartNoteTemplates, aiChartNoteDrafts } from '@careos/db'
import {
  ChartNoteNotFoundError,
  ChartNoteNotDraftError,
  AiGenerationFailedError,
} from '@careos/api-contract'
import type { TemplateContentV2 } from '@careos/api-contract'
import type { AIChartingPort } from '@careos/ai'

export interface GenerateAiDraftInput {
  chartNoteId: string
  rawNotes: string
}

export interface GenerateAiDraftResult {
  draftId: string
  chartNoteId: string
  status: 'pending'
  fieldValues: Record<string, unknown>
}

export interface GenerateAiDraftEvents {
  'rawNotes.submitted': { chartNoteId: string }
  'aiChartDraft.generated': { draftId: string; chartNoteId: string }
  'aiChartDraft.rejected'?: Array<{ draftId: string; chartNoteId: string; reason: string }>
}

export async function generateAiDraft(
  db: DrizzleDB,
  aiCharting: AIChartingPort,
  input: GenerateAiDraftInput,
): Promise<{ result: GenerateAiDraftResult; events: GenerateAiDraftEvents }> {
  return db.transaction(async (tx) => {
    // 1. Load chart note, verify it exists and is in draft status
    const chartNote = await tx.query.chartNotes.findFirst({
      where: eq(chartNotes.id, input.chartNoteId),
    })

    if (!chartNote) {
      throw new ChartNoteNotFoundError(input.chartNoteId)
    }

    if (chartNote.status !== 'draft') {
      throw new ChartNoteNotDraftError()
    }

    // 2. Auto-reject any pending AI drafts for this chart note
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
      try {
        await tx
          .update(aiChartNoteDrafts)
          .set({ status: 'rejected' })
          .where(eq(aiChartNoteDrafts.id, draft.id))

        rejectedDraftEvents.push({
          draftId: draft.id,
          chartNoteId: input.chartNoteId,
          reason: 'auto-rejected on regenerate',
        })
      } catch (error) {
        // Continue with other drafts even if one fails, and do not fail the entire transaction since this is a best-effort cleanup step
        console.error(`[AI_CHARTING]: Failed to auto-reject pending draft ${draft.id}`, error)
      }
    }

    // 3. Resolve the template version via the chart note's templateVersionId
    const template = await tx.query.chartNoteTemplates.findFirst({
      where: eq(chartNoteTemplates.id, chartNote.templateVersionId),
    })

    // Template must exist since it's a FK — defensive check
    if (!template) {
      throw new ChartNoteNotFoundError(input.chartNoteId)
    }

    // 4. Call AIChartingPort to generate the draft
    let draft
    try {
      draft = await aiCharting.generateChartNoteDraft({
        rawNotes: input.rawNotes,
        templateContent: template.content as TemplateContentV2,
      })
    } catch (error) {
      console.error('[AI_CHARTING]: Failed to generate draft', error)
      throw new AiGenerationFailedError()
    }

    // 5. Persist AI draft with status "pending"
    const [aiDraft] = await tx
      .insert(aiChartNoteDrafts)
      .values({
        chartNoteId: input.chartNoteId,
        rawNotes: input.rawNotes,
        fieldValues: draft.fields,
        status: 'pending',
      })
      .returning()

    // 6. Return result and events
    const events: GenerateAiDraftEvents = {
      'rawNotes.submitted': { chartNoteId: input.chartNoteId },
      'aiChartDraft.generated': { draftId: aiDraft.id, chartNoteId: input.chartNoteId },
    }

    if (rejectedDraftEvents.length > 0) {
      events['aiChartDraft.rejected'] = rejectedDraftEvents
    }

    return {
      result: {
        draftId: aiDraft.id,
        chartNoteId: aiDraft.chartNoteId,
        status: 'pending' as const,
        fieldValues: draft.fields,
      },
      events,
    }
  })
}
