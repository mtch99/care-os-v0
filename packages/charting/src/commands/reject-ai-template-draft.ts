import { eq } from 'drizzle-orm'
import type { DrizzleDB } from '@careos/db'
import { aiTemplateDrafts } from '@careos/db'
import { DraftNotFoundError, DraftAlreadyResolvedError } from '@careos/api-contract'

export interface RejectAiTemplateDraftInput {
  draftId: string
}

export interface RejectAiTemplateDraftResult {
  draftId: string
  status: 'rejected'
}

export interface RejectAiTemplateDraftEvents {
  'aiTemplateDraft.rejected': {
    draftId: string
    discipline: string
    appointmentType: string
  }
}

export async function rejectAiTemplateDraft(
  db: DrizzleDB,
  input: RejectAiTemplateDraftInput,
): Promise<{ result: RejectAiTemplateDraftResult; events: RejectAiTemplateDraftEvents }> {
  // 1. Load draft, verify status
  const draft = await db.query.aiTemplateDrafts.findFirst({
    where: eq(aiTemplateDrafts.id, input.draftId),
  })

  if (!draft || draft.expiresAt < new Date()) {
    throw new DraftNotFoundError()
  }

  if (draft.status !== 'pending') {
    throw new DraftAlreadyResolvedError()
  }

  // 2. Mark draft as rejected
  await db
    .update(aiTemplateDrafts)
    .set({ status: 'rejected' })
    .where(eq(aiTemplateDrafts.id, input.draftId))

  return {
    result: {
      draftId: input.draftId,
      status: 'rejected',
    },
    events: {
      'aiTemplateDraft.rejected': {
        draftId: input.draftId,
        discipline: draft.discipline,
        appointmentType: draft.appointmentType,
      },
    },
  }
}
