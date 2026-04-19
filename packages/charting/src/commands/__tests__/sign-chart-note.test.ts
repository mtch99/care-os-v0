import { describe, it, expect } from 'vitest'
import {
  ChartNoteNotFoundError,
  ChartNoteNotReadyForSignatureError,
  VersionConflictError,
} from '@careos/api-contract'
import { signChartNote } from '../sign-chart-note'
import { createFakeDb, makeChartNote } from './fakes'

describe('signChartNote', () => {
  // --- Happy path: readyForSignature -> signed ---

  it('Given a readyForSignature chart note at version 2, when signing with version 2, then transitions to signed and bumps version', async () => {
    const chartNote = makeChartNote({ status: 'readyForSignature', version: 2 })
    const { db, mutations } = createFakeDb({ chartNote })

    const { result } = await signChartNote(db, {
      chartNoteId: 'cn-1',
      version: 2,
      signedBy: 'practitioner-1',
    })

    expect(result.chartNote.status).toBe('signed')
    expect(result.alreadySigned).toBe(false)
    expect(mutations.updatedChartNotes).toHaveLength(1)
    expect(mutations.updatedChartNotes[0].updates).toMatchObject({
      status: 'signed',
      version: 3,
    })
  })

  it('Given a readyForSignature chart note, when signing, then sets signedAt and signedBy on the row', async () => {
    const chartNote = makeChartNote({ status: 'readyForSignature', version: 2 })
    const { db, mutations } = createFakeDb({ chartNote })

    await signChartNote(db, {
      chartNoteId: 'cn-1',
      version: 2,
      signedBy: 'practitioner-1',
    })

    const updates = mutations.updatedChartNotes[0].updates
    expect(updates).toHaveProperty('signedBy', 'practitioner-1')
    expect(updates).toHaveProperty('signedAt')
    expect(updates.signedAt).toBeInstanceOf(Date)
  })

  // --- Event payload ---

  it('Given a readyForSignature chart note, when signing, then emits chartNote.signed event with correct shape', async () => {
    const chartNote = makeChartNote({ status: 'readyForSignature', version: 2 })
    const { db } = createFakeDb({ chartNote })

    const { events } = await signChartNote(db, {
      chartNoteId: 'cn-1',
      version: 2,
      signedBy: 'practitioner-1',
    })

    const event = events['chartNote.signed']
    expect(event).toBeDefined()
    expect(event?.chartNoteId).toBe('cn-1')
    expect(event?.signedBy).toBe('practitioner-1')
    expect(typeof event?.signedAt).toBe('string')
    // signedAt should be a valid ISO date string
    expect(Number.isNaN(new Date(event?.signedAt ?? '').getTime())).toBe(false)
  })

  it('Given a successful sign, when checking event payload, then chartNote.signed has exactly chartNoteId, signedBy, signedAt', async () => {
    const chartNote = makeChartNote({ status: 'readyForSignature', version: 2 })
    const { db } = createFakeDb({ chartNote })

    const { events } = await signChartNote(db, {
      chartNoteId: 'cn-1',
      version: 2,
      signedBy: 'practitioner-1',
    })

    const event = events['chartNote.signed']
    expect(event).toBeDefined()
    expect(Object.keys(event ?? {}).sort()).toEqual(['chartNoteId', 'signedAt', 'signedBy'])
  })

  // --- Idempotency: already signed ---

  it('Given a chart note already in signed status, when signing, then returns alreadySigned true with no events', async () => {
    const chartNote = makeChartNote({
      status: 'signed',
      version: 3,
      signedAt: new Date('2026-01-15'),
      signedBy: 'practitioner-1',
    })
    const { db, mutations } = createFakeDb({ chartNote })

    const { result, events } = await signChartNote(db, {
      chartNoteId: 'cn-1',
      version: 2,
      signedBy: 'practitioner-1',
    })

    expect(result.alreadySigned).toBe(true)
    expect(result.chartNote.status).toBe('signed')
    expect(result.chartNote.signedAt).toEqual(new Date('2026-01-15'))
    expect(result.chartNote.signedBy).toBe('practitioner-1')
    expect(events['chartNote.signed']).toBeUndefined()
    expect(mutations.updatedChartNotes).toHaveLength(0)
  })

  // --- Error: chart note is draft (not ready for signature) ---

  it('Given a draft chart note, when signing, then throws ChartNoteNotReadyForSignatureError', async () => {
    const chartNote = makeChartNote({ status: 'draft', version: 1 })
    const { db } = createFakeDb({ chartNote })

    await expect(
      signChartNote(db, {
        chartNoteId: 'cn-1',
        version: 1,
        signedBy: 'practitioner-1',
      }),
    ).rejects.toThrow(ChartNoteNotReadyForSignatureError)
  })

  // --- Error: chart note not found ---

  it('Given chart note does not exist, when signing, then throws ChartNoteNotFoundError', async () => {
    const { db } = createFakeDb({ chartNote: null })

    await expect(
      signChartNote(db, {
        chartNoteId: 'nonexistent',
        version: 1,
        signedBy: 'practitioner-1',
      }),
    ).rejects.toThrow(ChartNoteNotFoundError)
  })

  // --- Error: version conflict ---

  it('Given a readyForSignature chart note at version 3, when signing with version 1, then throws VersionConflictError', async () => {
    const chartNote = makeChartNote({ status: 'readyForSignature', version: 3 })
    const { db } = createFakeDb({ chartNote })

    await expect(
      signChartNote(db, {
        chartNoteId: 'cn-1',
        version: 1,
        signedBy: 'practitioner-1',
      }),
    ).rejects.toThrow(VersionConflictError)
  })

  it('Given a readyForSignature chart note at version 5, when signing with version 5, then succeeds (no version conflict)', async () => {
    const chartNote = makeChartNote({ status: 'readyForSignature', version: 5 })
    const { db } = createFakeDb({ chartNote })

    const { result } = await signChartNote(db, {
      chartNoteId: 'cn-1',
      version: 5,
      signedBy: 'practitioner-1',
    })

    expect(result.chartNote.status).toBe('signed')
    expect(result.alreadySigned).toBe(false)
  })
})
