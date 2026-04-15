import { describe, it, expect } from 'vitest'
import {
  ChartNoteNotFoundError,
  ChartNoteNotDraftError,
  DraftNotFoundError,
  DraftAlreadyResolvedError,
} from '@careos/api-contract'
import { acceptAiDraft } from '../accept-ai-draft'
import { createFakeDb, makeChartNote, makeAiDraft } from './fakes'

describe('acceptAiDraft', () => {
  it('Given a pending draft and a draft chart note, when accepting, then copies fieldValues to chart note and bumps version', async () => {
    const chartNote = makeChartNote({ version: 1, fieldValues: null })
    const draft = makeAiDraft({
      id: 'draft-1',
      chartNoteId: 'cn-1',
      status: 'pending',
      fieldValues: { chief_complaint: 'Lower back pain', pain_scale: 6 },
    })
    const { db, mutations } = createFakeDb({ draft, chartNote })

    const { result } = await acceptAiDraft(db, {
      chartNoteId: 'cn-1',
      draftId: 'draft-1',
    })

    expect(result.chartNote.fieldValues).toEqual({
      chief_complaint: 'Lower back pain',
      pain_scale: 6,
    })
    expect(mutations.updatedChartNotes).toHaveLength(1)
    expect(mutations.updatedChartNotes[0].updates).toMatchObject({
      fieldValues: { chief_complaint: 'Lower back pain', pain_scale: 6 },
      version: 2,
    })
  })

  it('Given a pending draft and a draft chart note, when accepting, then marks draft as accepted', async () => {
    const chartNote = makeChartNote()
    const draft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-1', status: 'pending' })
    const { db, mutations } = createFakeDb({ draft, chartNote })

    await acceptAiDraft(db, { chartNoteId: 'cn-1', draftId: 'draft-1' })

    expect(mutations.updatedDrafts).toHaveLength(1)
    expect(mutations.updatedDrafts[0].updates).toEqual({ status: 'accepted' })
  })

  it('Given a pending draft, when accepting, then emits aiChartDraft.accepted event', async () => {
    const chartNote = makeChartNote()
    const draft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-1', status: 'pending' })
    const { db } = createFakeDb({ draft, chartNote })

    const { events } = await acceptAiDraft(db, { chartNoteId: 'cn-1', draftId: 'draft-1' })

    expect(events['aiChartDraft.accepted']).toEqual({
      draftId: 'draft-1',
      chartNoteId: 'cn-1',
    })
  })

  it('Given draft does not exist, when accepting, then throws DraftNotFoundError', async () => {
    const { db } = createFakeDb({ draft: null })

    await expect(
      acceptAiDraft(db, { chartNoteId: 'cn-1', draftId: 'nonexistent' }),
    ).rejects.toThrow(DraftNotFoundError)
  })

  it('Given draft belongs to a different chart note, when accepting, then throws DraftNotFoundError', async () => {
    const draft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-other', status: 'pending' })
    const { db } = createFakeDb({ draft })

    await expect(acceptAiDraft(db, { chartNoteId: 'cn-1', draftId: 'draft-1' })).rejects.toThrow(
      DraftNotFoundError,
    )
  })

  it('Given draft is already accepted, when accepting, then throws DraftAlreadyResolvedError', async () => {
    const draft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-1', status: 'accepted' })
    const { db } = createFakeDb({ draft })

    await expect(acceptAiDraft(db, { chartNoteId: 'cn-1', draftId: 'draft-1' })).rejects.toThrow(
      DraftAlreadyResolvedError,
    )
  })

  it('Given draft is already rejected, when accepting, then throws DraftAlreadyResolvedError', async () => {
    const draft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-1', status: 'rejected' })
    const { db } = createFakeDb({ draft })

    await expect(acceptAiDraft(db, { chartNoteId: 'cn-1', draftId: 'draft-1' })).rejects.toThrow(
      DraftAlreadyResolvedError,
    )
  })

  it('Given chart note is in readyForSignature status, when accepting, then throws ChartNoteNotDraftError', async () => {
    const chartNote = makeChartNote({ status: 'readyForSignature' })
    const draft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-1', status: 'pending' })
    const { db } = createFakeDb({ draft, chartNote })

    await expect(acceptAiDraft(db, { chartNoteId: 'cn-1', draftId: 'draft-1' })).rejects.toThrow(
      ChartNoteNotDraftError,
    )
  })

  it('Given chart note does not exist, when accepting, then throws ChartNoteNotFoundError', async () => {
    const draft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-1', status: 'pending' })
    const { db } = createFakeDb({ draft, chartNote: null })

    await expect(acceptAiDraft(db, { chartNoteId: 'cn-1', draftId: 'draft-1' })).rejects.toThrow(
      ChartNoteNotFoundError,
    )
  })
})
