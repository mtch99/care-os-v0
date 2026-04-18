import { Hono } from 'hono'
import { db } from '@careos/db'
import { generateAiDraftSchema, markReadyForSignatureSchema } from '@careos/api-contract'
import {
  generateAiDraft,
  acceptAiDraft,
  rejectAiDraft,
  markReadyForSignature,
} from '@careos/charting'
import { createAnthropicChartingAdapter } from '@careos/ai'
import {
  inngest,
  rawNotesSubmitted,
  aiChartDraftGenerated,
  aiChartDraftAccepted,
  aiChartDraftRejected,
  chartNoteReadyForSignature,
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
      ...(events['aiChartDraft.rejected']?.map((rejection) => aiChartDraftRejected.create(rejection)) ?? []),
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

// Decision: markedBy uses HARDCODED_PRACTITIONER_ID since auth is not implemented (see CLAUDE.md).
// Same pattern as the scheduling and clinical routes.
const HARDCODED_PRACTITIONER_ID = '0323c4a0-28e8-48cd-aed0-d57bf170a948'

// POST /chart-notes/:id/mark-ready-for-signature -- lock chart note for review
chartingRoutes.post('/chart-notes/:id/mark-ready-for-signature', async (c) => {
  const { id } = c.req.param()
  const body = markReadyForSignatureSchema.parse(await c.req.json())

  const { result, events } = await markReadyForSignature(db, {
    chartNoteId: id,
    version: body.version,
    markedBy: HARDCODED_PRACTITIONER_ID,
  })

  // Emit events only when a real transition happened (not idempotent return)
  if (events['chartNote.readyForSignature']) {
    await inngest
      .send(chartNoteReadyForSignature.create(events['chartNote.readyForSignature']))
      .catch((error: unknown) => {
        console.error('[INNGEST_ERROR]: Failed to send events to Inngest', error)
      })

    // Auto-rejected drafts also emit individual rejection events
    if (events['aiChartDraft.rejected']) {
      for (const rejection of events['aiChartDraft.rejected']) {
        await inngest.send(aiChartDraftRejected.create(rejection)).catch((error: unknown) => {
          console.error('[INNGEST_ERROR]: Failed to send events to Inngest', error)
        })
      }
    }
  }

  return c.json({ data: result })
})
