import type { DrizzleDB } from '@careos/db'
import { aiTemplateDrafts } from '@careos/db'
import { AiGenerationFailedError, AiOutputInvalidError } from '@careos/api-contract'
import type { TemplateContentV2 } from '@careos/api-contract'
import type { AIChartingPort } from '@careos/ai'
import { TemplateSchema } from '@careos/clinical'

export interface GenerateAiTemplateDraftInput {
  discipline: string
  appointmentType: string
  preferences: string
  locale: ('fr' | 'en')[]
  practitionerId: string
}

export interface GenerateAiTemplateDraftResult {
  draftId: string
  status: 'pending'
  content: TemplateContentV2
  expiresAt: Date
}

export interface GenerateAiTemplateDraftEvents {
  'aiTemplateDraft.generated': {
    draftId: string
    discipline: string
    appointmentType: string
    generatedBy: string
  }
}

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

export async function generateAiTemplateDraft(
  db: DrizzleDB,
  aiCharting: AIChartingPort,
  input: GenerateAiTemplateDraftInput,
): Promise<{ result: GenerateAiTemplateDraftResult; events: GenerateAiTemplateDraftEvents }> {
  // 1. Call AIChartingPort to generate template content
  let raw: TemplateContentV2
  try {
    raw = await aiCharting.generateTemplateDraft({
      discipline: input.discipline,
      appointmentType: input.appointmentType,
      preferences: input.preferences,
      locale: input.locale,
    })
  } catch (error) {
    console.error('[AI_CHARTING]: Failed to generate template draft', error)
    throw new AiGenerationFailedError()
  }

  // 2. Validate via TemplateSchema.parse() — retry once on failure
  let content: TemplateContentV2
  try {
    content = TemplateSchema.parse(raw)
  } catch {
    // Retry once with the same input
    try {
      const retryRaw = await aiCharting.generateTemplateDraft({
        discipline: input.discipline,
        appointmentType: input.appointmentType,
        preferences: input.preferences,
        locale: input.locale,
      })
      content = TemplateSchema.parse(retryRaw)
    } catch {
      throw new AiOutputInvalidError()
    }
  }

  // 3. Persist draft
  const expiresAt = new Date(Date.now() + DRAFT_TTL_MS)

  const [draft] = await db
    .insert(aiTemplateDrafts)
    .values({
      discipline: input.discipline,
      appointmentType: input.appointmentType as 'initial' | 'follow_up',
      locale: input.locale,
      preferences: input.preferences,
      content,
      status: 'pending',
      createdBy: input.practitionerId,
      expiresAt,
    })
    .returning()

  return {
    result: {
      draftId: draft.id,
      status: 'pending',
      content,
      expiresAt: draft.expiresAt,
    },
    events: {
      'aiTemplateDraft.generated': {
        draftId: draft.id,
        discipline: input.discipline,
        appointmentType: input.appointmentType,
        generatedBy: input.practitionerId,
      },
    },
  }
}
