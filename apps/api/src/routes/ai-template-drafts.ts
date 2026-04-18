import { Hono } from 'hono'
import { db } from '@careos/db'
import { generateAiTemplateDraftSchema, acceptAiTemplateDraftSchema } from '@careos/api-contract'
import {
  generateAiTemplateDraft,
  acceptAiTemplateDraft,
  rejectAiTemplateDraft,
} from '@careos/charting'
import { createAnthropicChartingAdapter } from '@careos/ai'
import {
  inngest,
  aiTemplateDraftGenerated,
  aiTemplateDraftAccepted,
  aiTemplateDraftRejected,
} from '@careos/inngest/client'

export const aiTemplateDraftRoutes = new Hono()

// Wire the AI charting port once at module level (composition root)
const aiCharting = createAnthropicChartingAdapter()

// POST /ai-generate — generate AI template draft
aiTemplateDraftRoutes.post('/ai-generate', async (c) => {
  const body = generateAiTemplateDraftSchema.parse(await c.req.json())

  const { result, events } = await generateAiTemplateDraft(db, aiCharting, {
    discipline: body.discipline,
    appointmentType: body.appointmentType,
    preferences: body.preferences,
    locale: body.locale,
    practitionerId: body.practitionerId,
  })

  await inngest
    .send(aiTemplateDraftGenerated.create(events['aiTemplateDraft.generated']))
    .catch((error: unknown) => {
      console.error('[INNGEST_ERROR]: Failed to send aiTemplateDraft.generated event', error)
    })

  return c.json({ data: result }, 201)
})

// POST /ai-generate/:draftId/accept — accept AI template draft
aiTemplateDraftRoutes.post('/ai-generate/:draftId/accept', async (c) => {
  const { draftId } = c.req.param()
  const body = acceptAiTemplateDraftSchema.parse(await c.req.json())

  const { result, events } = await acceptAiTemplateDraft(db, {
    draftId,
    name: body.name,
    isDefault: body.isDefault,
    practitionerId: body.practitionerId,
  })

  await inngest
    .send(aiTemplateDraftAccepted.create(events['aiTemplateDraft.accepted']))
    .catch((error: unknown) => {
      console.error('[INNGEST_ERROR]: Failed to send aiTemplateDraft.accepted event', error)
    })

  return c.json({ data: result.template }, 201)
})

// POST /ai-generate/:draftId/reject — reject AI template draft
aiTemplateDraftRoutes.post('/ai-generate/:draftId/reject', async (c) => {
  const { draftId } = c.req.param()

  const { result, events } = await rejectAiTemplateDraft(db, { draftId })

  await inngest
    .send(aiTemplateDraftRejected.create(events['aiTemplateDraft.rejected']))
    .catch((error: unknown) => {
      console.error('[INNGEST_ERROR]: Failed to send aiTemplateDraft.rejected event', error)
    })

  return c.json({ data: result })
})
