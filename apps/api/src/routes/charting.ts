import { Hono } from 'hono'
import { db } from '@careos/db'
import { generateAiDraftSchema } from '@careos/api-contract'
import { generateAiDraft, acceptAiDraft, rejectAiDraft } from '@careos/charting'
import { createAnthropicChartingAdapter } from '@careos/ai'
import {
  inngest,
  rawNotesSubmitted,
  aiChartDraftGenerated,
  aiChartDraftAccepted,
  aiChartDraftRejected,
} from '@careos/inngest/client'

export const chartingRoutes = new Hono()

// Wire the AI charting port once at module level (composition root)
const aiCharting = createAnthropicChartingAdapter()

// POST /chart-notes/:id/ai-draft -- generate AI draft
chartingRoutes.post('/chart-notes/:id/ai-draft', async (c) => {
  const { id } = c.req.param()
  const body = generateAiDraftSchema.parse(await c.req.json())

  const { result, events } = await generateAiDraft(db, aiCharting, {
    chartNoteId: id,
    rawNotes: body.rawNotes,
  })

  await inngest
    .send([
      rawNotesSubmitted.create(events['rawNotes.submitted']),
      aiChartDraftGenerated.create(events['aiChartDraft.generated']),
    ])
    .catch((error: unknown) => {
      console.error('[INNGEST_ERROR]: Failed to send events to Inngest', error)
    })

  return c.json({ data: result }, 201)
})

// POST /chart-notes/:id/ai-draft/:draftId/accept -- accept AI draft
chartingRoutes.post('/chart-notes/:id/ai-draft/:draftId/accept', async (c) => {
  const { id, draftId } = c.req.param()

  const { result, events } = await acceptAiDraft(db, {
    chartNoteId: id,
    draftId,
  })

  if (events['aiChartDraft.accepted']) {
    await inngest
      .send(aiChartDraftAccepted.create(events['aiChartDraft.accepted']))
      .catch((error: unknown) => {
        console.error('[INNGEST_ERROR]: Failed to send events to Inngest', error)
      })
  }

  return c.json({ data: result.chartNote })
})

// POST /chart-notes/:id/ai-draft/:draftId/reject -- reject AI draft
chartingRoutes.post('/chart-notes/:id/ai-draft/:draftId/reject', async (c) => {
  const { id, draftId } = c.req.param()

  const { result, events } = await rejectAiDraft(db, {
    chartNoteId: id,
    draftId,
  })

  if (events['aiChartDraft.rejected']) {
    await inngest
      .send(aiChartDraftRejected.create(events['aiChartDraft.rejected']))
      .catch((error: unknown) => {
        console.error('[INNGEST_ERROR]: Failed to send events to Inngest', error)
      })
  }

  return c.json({ data: result })
})
