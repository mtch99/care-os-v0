import { describe, it, expect } from 'vitest'
import { ChartNoteNotFoundError, VersionConflictError } from '@careos/api-contract'
import { markReadyForSignature } from '../mark-ready-for-signature'
import { createFakeDb, makeChartNote, makeAiDraft } from './fakes'

describe('markReadyForSignature', () => {
  // --- Happy path: draft -> readyForSignature ---

  it('Given a draft chart note at version 1, when marking ready for signature with version 1, then transitions to readyForSignature and bumps version', async () => {
    const chartNote = makeChartNote({ version: 1 })
    const { db, mutations } = createFakeDb({ chartNote })

    const { result } = await markReadyForSignature(db, {
      chartNoteId: 'cn-1',
      version: 1,
      markedBy: 'practitioner-1',
    })

    expect(result.chartNote.status).toBe('readyForSignature')
    expect(result.alreadyReady).toBe(false)
    expect(mutations.updatedChartNotes).toHaveLength(1)
    expect(mutations.updatedChartNotes[0].updates).toMatchObject({
      status: 'readyForSignature',
      version: 2,
    })
  })

  it('Given a draft chart note, when marking ready for signature, then emits chartNote.readyForSignature event with correct shape', async () => {
    const chartNote = makeChartNote({ version: 1 })
    const { db } = createFakeDb({ chartNote })

    const { events } = await markReadyForSignature(db, {
      chartNoteId: 'cn-1',
      version: 1,
      markedBy: 'practitioner-1',
    })

    const event = events['chartNote.readyForSignature']
    expect(event).toBeDefined()
    expect(event?.chartNoteId).toBe('cn-1')
    expect(event?.markedBy).toBe('practitioner-1')
    expect(typeof event?.markedAt).toBe('string')
    // markedAt should be a valid ISO date string
    expect(Number.isNaN(new Date(event?.markedAt ?? '').getTime())).toBe(false)
  })

  // --- Idempotency: already readyForSignature ---

  it('Given a chart note already in readyForSignature status, when marking ready for signature, then returns alreadyReady true with no events', async () => {
    const chartNote = makeChartNote({ status: 'readyForSignature', version: 2 })
    const { db, mutations } = createFakeDb({ chartNote })

    const { result, events } = await markReadyForSignature(db, {
      chartNoteId: 'cn-1',
      version: 1,
      markedBy: 'practitioner-1',
    })

    expect(result.alreadyReady).toBe(true)
    expect(result.chartNote.status).toBe('readyForSignature')
    expect(events['chartNote.readyForSignature']).toBeUndefined()
    expect(events['aiChartDraft.rejected']).toBeUndefined()
    expect(mutations.updatedChartNotes).toHaveLength(0)
  })

  // --- Idempotency: signed implies past ready ---

  it('Given a signed chart note, when marking ready for signature, then returns alreadyReady true with no events', async () => {
    const chartNote = makeChartNote({ status: 'signed', version: 3 })
    const { db, mutations } = createFakeDb({ chartNote })

    const { result, events } = await markReadyForSignature(db, {
      chartNoteId: 'cn-1',
      version: 1,
      markedBy: 'practitioner-1',
    })

    expect(result.alreadyReady).toBe(true)
    expect(result.chartNote.status).toBe('signed')
    expect(events['chartNote.readyForSignature']).toBeUndefined()
    expect(mutations.updatedChartNotes).toHaveLength(0)
  })

  // --- Cross-aggregate: auto-reject pending AI drafts ---

  it('Given a draft chart note with a pending AI draft, when marking ready for signature, then auto-rejects the pending draft', async () => {
    const chartNote = makeChartNote({ version: 1 })
    const pendingDraft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-1', status: 'pending' })
    const { db, mutations } = createFakeDb({
      chartNote,
      pendingDrafts: [pendingDraft],
    })

    await markReadyForSignature(db, {
      chartNoteId: 'cn-1',
      version: 1,
      markedBy: 'practitioner-1',
    })

    expect(mutations.updatedDrafts).toHaveLength(1)
    expect(mutations.updatedDrafts[0].updates).toEqual({ status: 'rejected' })
  })

  it('Given a draft chart note with a pending AI draft, when marking ready for signature, then emits aiChartDraft.rejected events', async () => {
    const chartNote = makeChartNote({ version: 1 })
    const pendingDraft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-1', status: 'pending' })
    const { db } = createFakeDb({
      chartNote,
      pendingDrafts: [pendingDraft],
    })

    const { events } = await markReadyForSignature(db, {
      chartNoteId: 'cn-1',
      version: 1,
      markedBy: 'practitioner-1',
    })

    expect(events['aiChartDraft.rejected']).toEqual([
      {
        draftId: 'draft-1',
        chartNoteId: 'cn-1',
        reason: 'auto-rejected on ready-for-signature',
      },
    ])
  })

  it('Given a draft chart note with no pending AI drafts, when marking ready for signature, then does not emit aiChartDraft.rejected events', async () => {
    const chartNote = makeChartNote({ version: 1 })
    const { db } = createFakeDb({ chartNote, pendingDrafts: [] })

    const { events } = await markReadyForSignature(db, {
      chartNoteId: 'cn-1',
      version: 1,
      markedBy: 'practitioner-1',
    })

    expect(events['aiChartDraft.rejected']).toBeUndefined()
  })

  // --- Error: chart note not found ---

  it('Given chart note does not exist, when marking ready for signature, then throws ChartNoteNotFoundError', async () => {
    const { db } = createFakeDb({ chartNote: null })

    await expect(
      markReadyForSignature(db, {
        chartNoteId: 'nonexistent',
        version: 1,
        markedBy: 'practitioner-1',
      }),
    ).rejects.toThrow(ChartNoteNotFoundError)
  })

  // --- Error: version conflict ---

  it('Given a draft chart note at version 3, when marking ready with version 1, then throws VersionConflictError', async () => {
    const chartNote = makeChartNote({ version: 3 })
    const { db } = createFakeDb({ chartNote })

    await expect(
      markReadyForSignature(db, {
        chartNoteId: 'cn-1',
        version: 1,
        markedBy: 'practitioner-1',
      }),
    ).rejects.toThrow(VersionConflictError)
  })

  it('Given a draft chart note at version 2, when marking ready with version 2, then succeeds (no version conflict)', async () => {
    const chartNote = makeChartNote({ version: 2 })
    const { db } = createFakeDb({ chartNote })

    const { result } = await markReadyForSignature(db, {
      chartNoteId: 'cn-1',
      version: 2,
      markedBy: 'practitioner-1',
    })

    expect(result.chartNote.status).toBe('readyForSignature')
    expect(result.alreadyReady).toBe(false)
  })

  // --- Event payload: no extra or missing fields ---

  it('Given a successful transition, when checking event payloads, then chartNote.readyForSignature has exactly chartNoteId, markedBy, markedAt', async () => {
    const chartNote = makeChartNote({ version: 1 })
    const { db } = createFakeDb({ chartNote })

    const { events } = await markReadyForSignature(db, {
      chartNoteId: 'cn-1',
      version: 1,
      markedBy: 'practitioner-1',
    })

    const event = events['chartNote.readyForSignature']
    expect(event).toBeDefined()
    expect(Object.keys(event ?? {}).sort()).toEqual(['chartNoteId', 'markedAt', 'markedBy'])
  })

  it('Given auto-rejected drafts, when checking event payloads, then each aiChartDraft.rejected has exactly draftId, chartNoteId, reason', async () => {
    const chartNote = makeChartNote({ version: 1 })
    const pendingDraft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-1', status: 'pending' })
    const { db } = createFakeDb({
      chartNote,
      pendingDrafts: [pendingDraft],
    })

    const { events } = await markReadyForSignature(db, {
      chartNoteId: 'cn-1',
      version: 1,
      markedBy: 'practitioner-1',
    })

    const rejections = events['aiChartDraft.rejected']
    expect(rejections).toBeDefined()
    expect(rejections).toHaveLength(1)
    expect(Object.keys(rejections?.[0] ?? {}).sort()).toEqual(['chartNoteId', 'draftId', 'reason'])
  })
})
