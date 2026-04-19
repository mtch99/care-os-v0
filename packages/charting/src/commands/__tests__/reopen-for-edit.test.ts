import { describe, it, expect } from 'vitest'
import {
  ChartNoteNotFoundError,
  ChartNoteAlreadySignedError,
  VersionConflictError,
} from '@careos/api-contract'
import { reopenForEdit } from '../reopen-for-edit'
import { createFakeDb, makeChartNote } from './fakes'

describe('reopenForEdit', () => {
  // --- Happy path: readyForSignature -> draft ---

  it('Given a readyForSignature chart note at version 2, when reopening with version 2, then transitions to draft and bumps version', async () => {
    const chartNote = makeChartNote({ status: 'readyForSignature', version: 2 })
    const { db, mutations } = createFakeDb({ chartNote })

    const { result } = await reopenForEdit(db, {
      chartNoteId: 'cn-1',
      version: 2,
      reopenedBy: 'practitioner-1',
    })

    expect(result.chartNote.status).toBe('draft')
    expect(result.alreadyDraft).toBe(false)
    expect(mutations.updatedChartNotes).toHaveLength(1)
    expect(mutations.updatedChartNotes[0].updates).toMatchObject({
      status: 'draft',
      version: 3,
    })
  })

  it('Given a readyForSignature chart note, when reopening, then fieldValues are carried over unchanged', async () => {
    const fieldValues = { chief_complaint: 'headache', assessment: 'migraine' }
    const chartNote = makeChartNote({
      status: 'readyForSignature',
      version: 2,
      fieldValues,
    })
    const { db } = createFakeDb({ chartNote })

    const { result } = await reopenForEdit(db, {
      chartNoteId: 'cn-1',
      version: 2,
      reopenedBy: 'practitioner-1',
    })

    // fieldValues on the returned chartNote come from the updated row;
    // the update only sets status/version/updatedAt, not fieldValues,
    // so the fake DB spread preserves the original fieldValues.
    expect(result.chartNote.fieldValues).toEqual(fieldValues)
  })

  // --- Event payload ---

  it('Given a readyForSignature chart note, when reopening, then emits chartNote.reopened event with correct shape', async () => {
    const chartNote = makeChartNote({ status: 'readyForSignature', version: 2 })
    const { db } = createFakeDb({ chartNote })

    const { events } = await reopenForEdit(db, {
      chartNoteId: 'cn-1',
      version: 2,
      reopenedBy: 'practitioner-1',
    })

    const event = events['chartNote.reopened']
    expect(event).toBeDefined()
    expect(event?.chartNoteId).toBe('cn-1')
    expect(event?.reopenedBy).toBe('practitioner-1')
    expect(typeof event?.reopenedAt).toBe('string')
    expect(Number.isNaN(new Date(event?.reopenedAt ?? '').getTime())).toBe(false)
  })

  it('Given a successful reopen, when checking event payload, then chartNote.reopened has exactly chartNoteId, reopenedBy, reopenedAt', async () => {
    const chartNote = makeChartNote({ status: 'readyForSignature', version: 2 })
    const { db } = createFakeDb({ chartNote })

    const { events } = await reopenForEdit(db, {
      chartNoteId: 'cn-1',
      version: 2,
      reopenedBy: 'practitioner-1',
    })

    const event = events['chartNote.reopened']
    expect(event).toBeDefined()
    expect(Object.keys(event ?? {}).sort()).toEqual(['chartNoteId', 'reopenedAt', 'reopenedBy'])
  })

  // --- Idempotency: already draft ---

  it('Given a chart note already in draft status, when reopening, then returns alreadyDraft true with no events', async () => {
    const chartNote = makeChartNote({ status: 'draft', version: 1 })
    const { db, mutations } = createFakeDb({ chartNote })

    const { result, events } = await reopenForEdit(db, {
      chartNoteId: 'cn-1',
      version: 1,
      reopenedBy: 'practitioner-1',
    })

    expect(result.alreadyDraft).toBe(true)
    expect(result.chartNote.status).toBe('draft')
    expect(events['chartNote.reopened']).toBeUndefined()
    expect(mutations.updatedChartNotes).toHaveLength(0)
  })

  // --- Error: chart note is signed ---

  it('Given a signed chart note, when reopening, then throws ChartNoteAlreadySignedError', async () => {
    const chartNote = makeChartNote({ status: 'signed', version: 3 })
    const { db } = createFakeDb({ chartNote })

    await expect(
      reopenForEdit(db, {
        chartNoteId: 'cn-1',
        version: 3,
        reopenedBy: 'practitioner-1',
      }),
    ).rejects.toThrow(ChartNoteAlreadySignedError)
  })

  // --- Error: chart note not found ---

  it('Given chart note does not exist, when reopening, then throws ChartNoteNotFoundError', async () => {
    const { db } = createFakeDb({ chartNote: null })

    await expect(
      reopenForEdit(db, {
        chartNoteId: 'nonexistent',
        version: 1,
        reopenedBy: 'practitioner-1',
      }),
    ).rejects.toThrow(ChartNoteNotFoundError)
  })

  // --- Error: version conflict ---

  it('Given a readyForSignature chart note at version 3, when reopening with version 1, then throws VersionConflictError', async () => {
    const chartNote = makeChartNote({ status: 'readyForSignature', version: 3 })
    const { db } = createFakeDb({ chartNote })

    await expect(
      reopenForEdit(db, {
        chartNoteId: 'cn-1',
        version: 1,
        reopenedBy: 'practitioner-1',
      }),
    ).rejects.toThrow(VersionConflictError)
  })

  it('Given a readyForSignature chart note at version 5, when reopening with version 5, then succeeds (no version conflict)', async () => {
    const chartNote = makeChartNote({ status: 'readyForSignature', version: 5 })
    const { db } = createFakeDb({ chartNote })

    const { result } = await reopenForEdit(db, {
      chartNoteId: 'cn-1',
      version: 5,
      reopenedBy: 'practitioner-1',
    })

    expect(result.chartNote.status).toBe('draft')
    expect(result.alreadyDraft).toBe(false)
  })
})
