import { describe, it, expect } from 'vitest'
import { DraftNotFoundError, DraftAlreadyResolvedError } from '@careos/api-contract'
import { rejectAiDraft } from '../reject-ai-draft'
import { createFakeDb, makeAiDraft } from './fakes'

describe('rejectAiDraft', () => {
  it('Given a pending draft, when rejecting, then returns rejected status', async () => {
    const draft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-1', status: 'pending' })
    const { db } = createFakeDb({ draft })

    const { result } = await rejectAiDraft(db, { chartNoteId: 'cn-1', draftId: 'draft-1' })

    expect(result.draftId).toBe('draft-1')
    expect(result.status).toBe('rejected')
  })

  it('Given a pending draft, when rejecting, then marks draft as rejected in DB', async () => {
    const draft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-1', status: 'pending' })
    const { db, mutations } = createFakeDb({ draft })

    await rejectAiDraft(db, { chartNoteId: 'cn-1', draftId: 'draft-1' })

    expect(mutations.updatedDrafts).toHaveLength(1)
    expect(mutations.updatedDrafts[0].updates).toEqual({ status: 'rejected' })
  })

  it('Given a pending draft, when rejecting, then emits aiChartDraft.rejected event', async () => {
    const draft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-1', status: 'pending' })
    const { db } = createFakeDb({ draft })

    const { events } = await rejectAiDraft(db, { chartNoteId: 'cn-1', draftId: 'draft-1' })

    expect(events['aiChartDraft.rejected']).toEqual({
      draftId: 'draft-1',
      chartNoteId: 'cn-1',
    })
  })

  it('Given draft does not exist, when rejecting, then throws DraftNotFoundError', async () => {
    const { db } = createFakeDb({ draft: null })

    await expect(
      rejectAiDraft(db, { chartNoteId: 'cn-1', draftId: 'nonexistent' }),
    ).rejects.toThrow(DraftNotFoundError)
  })

  it('Given draft belongs to a different chart note, when rejecting, then throws DraftNotFoundError', async () => {
    const draft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-other', status: 'pending' })
    const { db } = createFakeDb({ draft })

    await expect(rejectAiDraft(db, { chartNoteId: 'cn-1', draftId: 'draft-1' })).rejects.toThrow(
      DraftNotFoundError,
    )
  })

  it('Given draft is already accepted, when rejecting, then throws DraftAlreadyResolvedError', async () => {
    const draft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-1', status: 'accepted' })
    const { db } = createFakeDb({ draft })

    await expect(rejectAiDraft(db, { chartNoteId: 'cn-1', draftId: 'draft-1' })).rejects.toThrow(
      DraftAlreadyResolvedError,
    )
  })

  it('Given draft is already rejected, when rejecting, then throws DraftAlreadyResolvedError', async () => {
    const draft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-1', status: 'rejected' })
    const { db } = createFakeDb({ draft })

    await expect(rejectAiDraft(db, { chartNoteId: 'cn-1', draftId: 'draft-1' })).rejects.toThrow(
      DraftAlreadyResolvedError,
    )
  })
})
