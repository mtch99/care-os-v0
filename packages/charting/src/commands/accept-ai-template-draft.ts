import { eq } from 'drizzle-orm'
import type { DrizzleDB } from '@careos/db'
import { aiTemplateDrafts } from '@careos/db'
import { DraftNotFoundError, DraftAlreadyResolvedError } from '@careos/api-contract'
import { createTemplate } from '@careos/scheduling'

export interface AcceptAiTemplateDraftInput {
  draftId: string
  name: string
  isDefault: boolean
  practitionerId: string
}

export interface AcceptAiTemplateDraftEvents {
  'aiTemplateDraft.accepted': {
    draftId: string
    templateId: string
    discipline: string
    appointmentType: string
  }
}

export async function acceptAiTemplateDraft(
  db: DrizzleDB,
  input: AcceptAiTemplateDraftInput,
): Promise<{
  result: { template: Awaited<ReturnType<typeof createTemplate>>['template'] }
  events: AcceptAiTemplateDraftEvents
}> {
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

  // 2. Delegate to CreateTemplate with fields carried from the draft
  const { template } = await createTemplate(db, {
    name: input.name,
    discipline: draft.discipline,
    appointmentType: draft.appointmentType,
    content: draft.content,
    isDefault: input.isDefault,
    createdBy: input.practitionerId,
  })

  // 3. Mark draft as accepted, link to created template
  await db
    .update(aiTemplateDrafts)
    .set({ status: 'accepted', acceptedTemplateId: template.id })
    .where(eq(aiTemplateDrafts.id, input.draftId))

  return {
    result: { template },
    events: {
      'aiTemplateDraft.accepted': {
        draftId: input.draftId,
        templateId: template.id,
        discipline: draft.discipline,
        appointmentType: draft.appointmentType,
      },
    },
  }
}
