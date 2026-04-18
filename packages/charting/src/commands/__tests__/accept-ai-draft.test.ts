import { describe, it, expect } from 'vitest'
import {
  ChartNoteNotFoundError,
  ChartNoteNotDraftError,
  DraftNotFoundError,
  DraftAlreadyResolvedError,
  FieldValueValidationError,
  UnknownFieldIdError,
} from '@careos/api-contract'
import { acceptAiDraft } from '../accept-ai-draft'
import { createFakeDb, makeChartNote, makeAiDraft, makeTemplate } from './fakes'

const ACCEPTED_BY = '0323c4a0-28e8-48cd-aed0-d57bf170a948'

// Template with chief_complaint (narrative) + pain_scale (0..10 scale)
// Used by cases that reach the aggregate invariant chain.
const TEMPLATE_WITH_SCALE = makeTemplate({
  content: {
    schemaVersion: '0.2',
    locale: ['en'],
    pages: [
      {
        key: 'pg1',
        label: { en: 'Page 1' },
        sections: [
          {
            key: 's1',
            label: { en: 'Section 1' },
            rows: [
              {
                columns: [
                  {
                    key: 'chief_complaint',
                    label: { en: 'Chief complaint' },
                    type: 'narrative',
                    required: true,
                    config: {},
                  },
                  {
                    key: 'pain_scale',
                    label: { en: 'Pain' },
                    type: 'scale',
                    required: true,
                    config: { min: 0, max: 10 },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
})

describe('acceptAiDraft', () => {
  it('Given a pending draft and a draft chart note, when accepting, then copies fieldValues to chart note and bumps version', async () => {
    const chartNote = makeChartNote({ version: 1, fieldValues: null })
    const draft = makeAiDraft({
      id: 'draft-1',
      chartNoteId: 'cn-1',
      status: 'pending',
      fieldValues: { chief_complaint: 'Lower back pain', pain_scale: 6 },
    })
    const { db, mutations } = createFakeDb({
      draft,
      chartNote,
      template: TEMPLATE_WITH_SCALE,
    })

    const { result } = await acceptAiDraft(db, {
      chartNoteId: 'cn-1',
      draftId: 'draft-1',
      acceptedBy: ACCEPTED_BY,
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
    const draft = makeAiDraft({
      id: 'draft-1',
      chartNoteId: 'cn-1',
      status: 'pending',
      fieldValues: { chief_complaint: 'Something' },
    })
    const { db, mutations } = createFakeDb({
      draft,
      chartNote,
      template: TEMPLATE_WITH_SCALE,
    })

    await acceptAiDraft(db, {
      chartNoteId: 'cn-1',
      draftId: 'draft-1',
      acceptedBy: ACCEPTED_BY,
    })

    expect(mutations.updatedDrafts).toHaveLength(1)
    expect(mutations.updatedDrafts[0].updates).toEqual({ status: 'accepted' })
  })

  it('Given a pending draft, when accepting, then emits aiChartDraft.accepted event', async () => {
    const chartNote = makeChartNote()
    const draft = makeAiDraft({
      id: 'draft-1',
      chartNoteId: 'cn-1',
      status: 'pending',
      fieldValues: { chief_complaint: 'x' },
    })
    const { db } = createFakeDb({ draft, chartNote, template: TEMPLATE_WITH_SCALE })

    const { events } = await acceptAiDraft(db, {
      chartNoteId: 'cn-1',
      draftId: 'draft-1',
      acceptedBy: ACCEPTED_BY,
    })

    expect(events['aiChartDraft.accepted']).toEqual({
      draftId: 'draft-1',
      chartNoteId: 'cn-1',
    })
  })

  it('Given a successful accept, when inspecting events, then also surfaces chartNote.saved with the supplied acceptedBy', async () => {
    const chartNote = makeChartNote()
    const draft = makeAiDraft({
      id: 'draft-1',
      chartNoteId: 'cn-1',
      status: 'pending',
      fieldValues: { chief_complaint: 'x', pain_scale: 4 },
    })
    const { db } = createFakeDb({ draft, chartNote, template: TEMPLATE_WITH_SCALE })

    const { events } = await acceptAiDraft(db, {
      chartNoteId: 'cn-1',
      draftId: 'draft-1',
      acceptedBy: ACCEPTED_BY,
    })

    expect(events['chartNote.saved']).toMatchObject({
      chartNoteId: 'cn-1',
      editedBy: ACCEPTED_BY,
      fieldIdsChanged: ['chief_complaint', 'pain_scale'],
    })
    expect(events['chartNote.saved']?.editedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('Given draft does not exist, when accepting, then throws DraftNotFoundError', async () => {
    const { db } = createFakeDb({ draft: null })

    await expect(
      acceptAiDraft(db, {
        chartNoteId: 'cn-1',
        draftId: 'nonexistent',
        acceptedBy: ACCEPTED_BY,
      }),
    ).rejects.toThrow(DraftNotFoundError)
  })

  it('Given draft belongs to a different chart note, when accepting, then throws DraftNotFoundError', async () => {
    const draft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-other', status: 'pending' })
    const { db } = createFakeDb({ draft })

    await expect(
      acceptAiDraft(db, {
        chartNoteId: 'cn-1',
        draftId: 'draft-1',
        acceptedBy: ACCEPTED_BY,
      }),
    ).rejects.toThrow(DraftNotFoundError)
  })

  it('Given draft is already accepted, when accepting, then returns chart note without emitting events or loading template', async () => {
    const chartNote = makeChartNote({
      version: 2,
      fieldValues: { chief_complaint: 'Lower back pain', pain_scale: 6 },
    })
    const draft = makeAiDraft({
      id: 'draft-1',
      chartNoteId: 'cn-1',
      status: 'accepted',
      fieldValues: { chief_complaint: 'Lower back pain', pain_scale: 6 },
    })
    // No template supplied — idempotent branch must return before the template load.
    const { db, mutations } = createFakeDb({ draft, chartNote })

    const { result, events } = await acceptAiDraft(db, {
      chartNoteId: 'cn-1',
      draftId: 'draft-1',
      acceptedBy: ACCEPTED_BY,
    })

    expect(result.chartNote.id).toBe('cn-1')
    expect(result.chartNote.fieldValues).toEqual({
      chief_complaint: 'Lower back pain',
      pain_scale: 6,
    })
    expect(result.chartNote.version).toBe(2)
    expect(events).toEqual({})
    expect(mutations.updatedChartNotes).toHaveLength(0)
    expect(mutations.updatedDrafts).toHaveLength(0)
  })

  it('Given draft is already rejected, when accepting, then throws DraftAlreadyResolvedError', async () => {
    const draft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-1', status: 'rejected' })
    const { db } = createFakeDb({ draft })

    await expect(
      acceptAiDraft(db, {
        chartNoteId: 'cn-1',
        draftId: 'draft-1',
        acceptedBy: ACCEPTED_BY,
      }),
    ).rejects.toThrow(DraftAlreadyResolvedError)
  })

  it('Given chart note is in readyForSignature status, when accepting, then throws ChartNoteNotDraftError', async () => {
    const chartNote = makeChartNote({ status: 'readyForSignature' })
    const draft = makeAiDraft({
      id: 'draft-1',
      chartNoteId: 'cn-1',
      status: 'pending',
      fieldValues: { chief_complaint: 'x' },
    })
    const { db, mutations } = createFakeDb({
      draft,
      chartNote,
      template: TEMPLATE_WITH_SCALE,
    })

    await expect(
      acceptAiDraft(db, {
        chartNoteId: 'cn-1',
        draftId: 'draft-1',
        acceptedBy: ACCEPTED_BY,
      }),
    ).rejects.toThrow(ChartNoteNotDraftError)

    expect(mutations.updatedChartNotes).toHaveLength(0)
    expect(mutations.updatedDrafts).toHaveLength(0)
  })

  it('Given chart note does not exist, when accepting, then throws ChartNoteNotFoundError', async () => {
    const draft = makeAiDraft({ id: 'draft-1', chartNoteId: 'cn-1', status: 'pending' })
    const { db } = createFakeDb({ draft, chartNote: null })

    await expect(
      acceptAiDraft(db, {
        chartNoteId: 'cn-1',
        draftId: 'draft-1',
        acceptedBy: ACCEPTED_BY,
      }),
    ).rejects.toThrow(ChartNoteNotFoundError)
  })

  // -- New: template FK dangle (defensive) --

  it('Given template does not exist for the chart note, when accepting, then throws and makes no writes', async () => {
    const chartNote = makeChartNote()
    const draft = makeAiDraft({
      id: 'draft-1',
      chartNoteId: 'cn-1',
      status: 'pending',
      fieldValues: { chief_complaint: 'x' },
    })
    const { db, mutations } = createFakeDb({ draft, chartNote, template: null })

    await expect(
      acceptAiDraft(db, {
        chartNoteId: 'cn-1',
        draftId: 'draft-1',
        acceptedBy: ACCEPTED_BY,
      }),
    ).rejects.toThrow(ChartNoteNotFoundError)

    expect(mutations.updatedChartNotes).toHaveLength(0)
    expect(mutations.updatedDrafts).toHaveLength(0)
  })

  // -- New: unknown field key rejection --

  it('Given a draft with an unknown field key, when accepting, then throws UnknownFieldIdError and rolls back', async () => {
    const chartNote = makeChartNote()
    const draft = makeAiDraft({
      id: 'draft-1',
      chartNoteId: 'cn-1',
      status: 'pending',
      fieldValues: { pan_scale: 6 }, // typo — unknown key
    })
    const { db, mutations } = createFakeDb({
      draft,
      chartNote,
      template: TEMPLATE_WITH_SCALE,
    })

    try {
      await acceptAiDraft(db, {
        chartNoteId: 'cn-1',
        draftId: 'draft-1',
        acceptedBy: ACCEPTED_BY,
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(UnknownFieldIdError)
      const error = err as UnknownFieldIdError
      expect(error.unknownKeys).toEqual(['pan_scale'])
    }

    expect(mutations.updatedChartNotes).toHaveLength(0)
    expect(mutations.updatedDrafts).toHaveLength(0)
  })

  // -- New: invalid value rejection --

  it('Given a draft with an out-of-range scale value, when accepting, then throws FieldValueValidationError and rolls back', async () => {
    const chartNote = makeChartNote()
    const draft = makeAiDraft({
      id: 'draft-1',
      chartNoteId: 'cn-1',
      status: 'pending',
      fieldValues: { pain_scale: 42 }, // out of 0..10 range
    })
    const { db, mutations } = createFakeDb({
      draft,
      chartNote,
      template: TEMPLATE_WITH_SCALE,
    })

    try {
      await acceptAiDraft(db, {
        chartNoteId: 'cn-1',
        draftId: 'draft-1',
        acceptedBy: ACCEPTED_BY,
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(FieldValueValidationError)
      const error = err as FieldValueValidationError
      expect(error.httpStatus).toBe(422)
      expect(error.errors[0].code).toBe('OUT_OF_RANGE')
      expect(error.errors[0].path).toEqual(['pain_scale'])
    }

    expect(mutations.updatedChartNotes).toHaveLength(0)
    expect(mutations.updatedDrafts).toHaveLength(0)
  })
})
