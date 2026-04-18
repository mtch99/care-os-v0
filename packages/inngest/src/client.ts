import { eventType, Inngest } from 'inngest'
import { z } from 'zod'
import { createSessionStartedFunction } from './functions/clinical/session/session.started'

export const sessionStarted = eventType('clinical/session.started', {
  schema: z.object({
    sessionId: z.string(),
  }),
})

export const userSignup = eventType('user/signup', {
  schema: z.object({
    email: z.email(),
    name: z.string(),
  }),
})

// --- AI Chart Note Draft events (CAR-98) ---

export const rawNotesSubmitted = eventType('charting/rawNotes.submitted', {
  schema: z.object({
    chartNoteId: z.string(),
  }),
})

export const aiChartDraftGenerated = eventType('charting/aiChartDraft.generated', {
  schema: z.object({
    draftId: z.string(),
    chartNoteId: z.string(),
  }),
})

export const aiChartDraftAccepted = eventType('charting/aiChartDraft.accepted', {
  schema: z.object({
    draftId: z.string(),
    chartNoteId: z.string(),
  }),
})

export const aiChartDraftRejected = eventType('charting/aiChartDraft.rejected', {
  schema: z.object({
    draftId: z.string(),
    chartNoteId: z.string(),
  }),
})

// --- Chart Note lifecycle events (CAR-111) ---

export const chartNoteReadyForSignature = eventType('charting/chartNote.readyForSignature', {
  schema: z.object({
    chartNoteId: z.string(),
    markedBy: z.string(),
    markedAt: z.string(),
  }),
})

export const chartNoteReopened = eventType('charting/chartNote.reopened', {
  schema: z.object({
    chartNoteId: z.string(),
    reopenedBy: z.string(),
    reopenedAt: z.string(),
  }),
})

// --- Chart Note Save Draft events (CAR-110) ---

export const chartNoteSaved = eventType('charting/chartNote.saved', {
  schema: z.object({
    chartNoteId: z.string(),
    editedBy: z.string(),
    editedAt: z.string(),
    fieldIdsChanged: z.array(z.string()),
  }),
})

export const inngest = new Inngest({
  id: 'my-app',
})

export const functions = [createSessionStartedFunction(inngest.createFunction)]
