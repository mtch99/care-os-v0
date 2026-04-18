import { eq } from 'drizzle-orm'
import type { DrizzleDB } from '@careos/db'
import { chartNotes, chartNoteTemplates, aiChartNoteDrafts } from '@careos/db'
import {
  ChartNoteNotFoundError,
  DraftNotFoundError,
  DraftAlreadyResolvedError,
} from '@careos/api-contract'
import type { TemplateContentV2 } from '@careos/api-contract'
import { ChartNote } from '@careos/scheduling'
import type { FieldValue } from '@careos/scheduling'

export interface AcceptAiDraftInput {
  chartNoteId: string
  draftId: string
  /** Practitioner performing the action. Sourced from auth context at the route layer. */
  acceptedBy: string
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
  'chartNote.saved': {
    chartNoteId: string
    editedBy: string
    editedAt: string
    fieldIdsChanged: string[]
  }
}

/**
 * Accept an AI draft: copy draft fieldValues into the chart note (overwrite strategy),
 * enforce chart-note invariants via the aggregate, mark the draft as accepted.
 *
 * Invariant enforcement (on the aggregate — `ChartNote.acceptAiDraft`):
 * - status must be 'draft'                  → ChartNoteNotDraftError
 * - every incoming key is in the template    → UnknownFieldIdError
 * - every incoming value matches template    → FieldValueValidationError
 *
 * Overwrite (not merge): AI emits the complete field set; merging with partial
 * stale data risks inconsistency. The practitioner can edit individual fields
 * after acceptance via `saveDraft`.
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

    // 2. Load chart note
    const chartNote = await tx.query.chartNotes.findFirst({
      where: eq(chartNotes.id, input.chartNoteId),
    })

    if (!chartNote) {
      throw new ChartNoteNotFoundError(input.chartNoteId)
    }

    // 3. Load template — needed by the aggregate for key + value validation.
    // templateVersionId is an FK; a missing row is a data-integrity failure,
    // not a user error. Reuse ChartNoteNotFoundError for symmetry with
    // generate-ai-draft's defensive branch (charting lacks a dedicated
    // "template-not-found" error class today).
    const template = await tx.query.chartNoteTemplates.findFirst({
      where: eq(chartNoteTemplates.id, chartNote.templateVersionId),
    })

    if (!template) {
      throw new ChartNoteNotFoundError(input.chartNoteId)
    }

    // 4. Reconstitute the aggregate and delegate invariant enforcement.
    // Any invariant violation throws out of the transaction, rolling back
    // both the chart-note update and the draft-status update.
    const aggregate = ChartNote.fromRow({
      ...chartNote,
      fieldValues: chartNote.fieldValues as Record<string, FieldValue> | null,
    })

    const now = new Date()
    const updated = aggregate.acceptAiDraft({
      incomingFieldValues: draft.fieldValues as Record<string, FieldValue>,
      templateContent: template.content as TemplateContentV2,
      acceptedAt: now,
      acceptedBy: input.acceptedBy,
    })

    // 5. Persist the aggregate's new state
    const [updatedChartNote] = await tx
      .update(chartNotes)
      .set({
        fieldValues: updated.fieldValues,
        updatedAt: updated.updatedAt,
        version: updated.version,
      })
      .where(eq(chartNotes.id, input.chartNoteId))
      .returning()

    // 6. Mark draft as accepted
    await tx
      .update(aiChartNoteDrafts)
      .set({ status: 'accepted' })
      .where(eq(aiChartNoteDrafts.id, input.draftId))

    // 7. Surface events from the aggregate alongside the handler-owned draft event
    const savedEvent = updated
      .getUncommittedEvents()
      .find((e) => e.type === 'chartNote.saved')

    const events: Partial<AcceptAiDraftEvents> = {
      'aiChartDraft.accepted': { draftId: input.draftId, chartNoteId: input.chartNoteId },
    }

    if (savedEvent) {
      events['chartNote.saved'] =
        savedEvent.payload as AcceptAiDraftEvents['chartNote.saved']
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
      },
      events,
    }
  })
}
