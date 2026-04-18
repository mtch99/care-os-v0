import { eq, and } from 'drizzle-orm'
import type { DrizzleDB } from '@careos/db'
import { chartNotes, chartNoteTemplates, aiChartNoteDrafts } from '@careos/db'
import {
  ChartNoteNotFoundError,
  ChartNoteNotDraftError,
  AiDraftAlreadyPendingError,
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

    // 2. Verify no pending AI draft exists for this chart note
    const existingDraft = await tx.query.aiChartNoteDrafts.findFirst({
      where: and(
        eq(aiChartNoteDrafts.chartNoteId, input.chartNoteId),
        eq(aiChartNoteDrafts.status, 'pending'),
      ),
    })

    if (existingDraft) {
      throw new AiDraftAlreadyPendingError()
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
    return {
      result: {
        draftId: aiDraft.id,
        chartNoteId: aiDraft.chartNoteId,
        status: 'pending' as const,
        fieldValues: draft.fields,
      },
      events: {
        'rawNotes.submitted': { chartNoteId: input.chartNoteId },
        'aiChartDraft.generated': { draftId: aiDraft.id, chartNoteId: input.chartNoteId },
      },
    }
  })
}
