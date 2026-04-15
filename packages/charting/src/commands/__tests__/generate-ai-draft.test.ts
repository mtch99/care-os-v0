import { describe, it, expect } from 'vitest'
import {
  ChartNoteNotFoundError,
  ChartNoteNotDraftError,
  AiDraftAlreadyPendingError,
  AiGenerationFailedError,
} from '@careos/api-contract'
import { generateAiDraft } from '../generate-ai-draft'
import {
  createFakeDb,
  createFakeAiChartingPort,
  makeChartNote,
  makeAiDraft,
  makeTemplate,
} from './fakes'

describe('generateAiDraft', () => {
  const AI_RESULT = {
    fields: {
      chief_complaint: 'Cervical pain with limited ROM',
      pain_scale: 7,
      signature: null,
    },
  }

  it('Given a draft chart note with no pending AI draft, when generating, then returns pending draft with field values', async () => {
    const chartNote = makeChartNote()
    const template = makeTemplate()
    const aiPort = createFakeAiChartingPort(AI_RESULT)
    const { db, mutations } = createFakeDb({
      chartNote,
      pendingDraft: null,
      template,
    })

    const { result } = await generateAiDraft(db, aiPort, {
      chartNoteId: 'cn-1',
      rawNotes: 'Patient presents with cervical pain',
    })

    expect(result.status).toBe('pending')
    expect(result.chartNoteId).toBe('cn-1')
    expect(result.fieldValues).toEqual(AI_RESULT.fields)
    expect(result.draftId).toBeTruthy()
    expect(mutations.insertedDrafts).toHaveLength(1)
    expect(mutations.insertedDrafts[0].rawNotes).toBe('Patient presents with cervical pain')
  })

  it('Given a draft chart note, when generating, then emits correct event payloads', async () => {
    const chartNote = makeChartNote()
    const template = makeTemplate()
    const aiPort = createFakeAiChartingPort(AI_RESULT)
    const { db } = createFakeDb({
      chartNote,
      pendingDraft: null,
      template,
    })

    const { events } = await generateAiDraft(db, aiPort, {
      chartNoteId: 'cn-1',
      rawNotes: 'Patient presents with cervical pain',
    })

    expect(events['rawNotes.submitted']).toEqual({ chartNoteId: 'cn-1' })
    expect(events['aiChartDraft.generated']).toEqual({
      draftId: expect.any(String) as string,
      chartNoteId: 'cn-1',
    })
  })

  it('Given no chart note exists, when generating, then throws ChartNoteNotFoundError', async () => {
    const aiPort = createFakeAiChartingPort()
    const { db } = createFakeDb({ chartNote: null })

    await expect(
      generateAiDraft(db, aiPort, { chartNoteId: 'nonexistent', rawNotes: 'notes' }),
    ).rejects.toThrow(ChartNoteNotFoundError)
  })

  it('Given chart note in readyForSignature status, when generating, then throws ChartNoteNotDraftError', async () => {
    const chartNote = makeChartNote({ status: 'readyForSignature' })
    const aiPort = createFakeAiChartingPort()
    const { db } = createFakeDb({ chartNote })

    await expect(
      generateAiDraft(db, aiPort, { chartNoteId: 'cn-1', rawNotes: 'notes' }),
    ).rejects.toThrow(ChartNoteNotDraftError)
  })

  it('Given chart note in signed status, when generating, then throws ChartNoteNotDraftError', async () => {
    const chartNote = makeChartNote({ status: 'signed' })
    const aiPort = createFakeAiChartingPort()
    const { db } = createFakeDb({ chartNote })

    await expect(
      generateAiDraft(db, aiPort, { chartNoteId: 'cn-1', rawNotes: 'notes' }),
    ).rejects.toThrow(ChartNoteNotDraftError)
  })

  it('Given a pending AI draft already exists, when generating, then throws AiDraftAlreadyPendingError', async () => {
    const chartNote = makeChartNote()
    const pendingDraft = makeAiDraft({ status: 'pending' })
    const aiPort = createFakeAiChartingPort()
    const { db } = createFakeDb({ chartNote, pendingDraft })

    await expect(
      generateAiDraft(db, aiPort, { chartNoteId: 'cn-1', rawNotes: 'notes' }),
    ).rejects.toThrow(AiDraftAlreadyPendingError)
  })

  it('Given the AI service fails, when generating, then throws AiGenerationFailedError', async () => {
    const chartNote = makeChartNote()
    const template = makeTemplate()
    const aiPort = createFakeAiChartingPort(undefined, new Error('LLM timeout'))
    const { db } = createFakeDb({ chartNote, pendingDraft: null, template })

    await expect(
      generateAiDraft(db, aiPort, { chartNoteId: 'cn-1', rawNotes: 'notes' }),
    ).rejects.toThrow(AiGenerationFailedError)
  })

  it('Given a valid chart note, when generating, then calls AIChartingPort with template content and raw notes', async () => {
    const chartNote = makeChartNote()
    const template = makeTemplate()
    const aiPort = createFakeAiChartingPort(AI_RESULT)
    const { db } = createFakeDb({ chartNote, pendingDraft: null, template })

    await generateAiDraft(db, aiPort, {
      chartNoteId: 'cn-1',
      rawNotes: 'Patient presents with cervical pain',
    })

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(aiPort.generateChartNoteDraft).toHaveBeenCalledWith({
      rawNotes: 'Patient presents with cervical pain',
      templateContent: template.content,
    })
  })
})
