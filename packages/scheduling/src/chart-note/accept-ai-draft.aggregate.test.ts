import { describe, it, expect } from 'vitest'
import {
  ChartNoteNotDraftError,
  FieldValueValidationError,
  UnknownFieldIdError,
} from '@careos/api-contract'
import type { TemplateContentV2 } from '@careos/api-contract'

import { ChartNote } from './chart-note.aggregate'
import type { ChartNoteRow } from './ports'

// ── Test fixtures ──

const CHART_NOTE_ID = 'cn-1111-2222-3333-444444444444'
const SESSION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const ACCEPTED_BY = '0323c4a0-28e8-48cd-aed0-d57bf170a948'
const TEMPLATE_VERSION_ID = '29187424-4563-4ebd-b2ee-c710ce251c70'
const ACCEPTED_AT = new Date('2026-04-18T10:00:00.000Z')

const TEMPLATE_CONTENT: TemplateContentV2 = {
  schemaVersion: '0.2',
  locale: ['fr', 'en'],
  pages: [
    {
      key: 'pg1',
      label: { fr: 'Page 1', en: 'Page 1' },
      sections: [
        {
          key: 's1',
          label: { fr: 'Section', en: 'Section' },
          rows: [
            {
              columns: [
                {
                  key: 'chief_complaint',
                  label: { fr: 'Motif', en: 'Chief complaint' },
                  type: 'narrative',
                  required: true,
                  config: {},
                },
                {
                  key: 'pain_scale',
                  label: { fr: 'Douleur', en: 'Pain' },
                  type: 'scale',
                  required: true,
                  config: { min: 0, max: 10 },
                },
                {
                  key: 'onset_type',
                  label: { fr: 'Apparition', en: 'Onset' },
                  type: 'checkboxGroup',
                  required: false,
                  config: {
                    options: [
                      { fr: 'Traumatique', en: 'Traumatic' },
                      { fr: 'Progressive', en: 'Gradual' },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

function makeDraftChartNote(overrides: Partial<ChartNoteRow> = {}): ChartNoteRow {
  return {
    id: CHART_NOTE_ID,
    sessionId: SESSION_ID,
    templateVersionId: TEMPLATE_VERSION_ID,
    status: 'draft',
    fieldValues: { chief_complaint: 'pre-existing', pain_scale: 3 },
    prePopulatedFromIntakeId: null,
    signedAt: null,
    signedBy: null,
    createdAt: new Date('2026-04-12T09:00:00.000Z'),
    updatedAt: new Date('2026-04-12T09:00:00.000Z'),
    version: 1,
    ...overrides,
  }
}

// ── Tests ──

describe('ChartNote.acceptAiDraft', () => {
  // -- Happy path: overwrite semantics --

  it('Given a valid payload, when accepting, then returns a new ChartNote with overwritten fieldValues and bumped version', () => {
    const aggregate = ChartNote.fromRow(makeDraftChartNote())

    const updated = aggregate.acceptAiDraft({
      incomingFieldValues: { chief_complaint: 'Lower back pain', pain_scale: 7 },
      templateContent: TEMPLATE_CONTENT,
      acceptedAt: ACCEPTED_AT,
      acceptedBy: ACCEPTED_BY,
    })

    expect(updated.id).toBe(CHART_NOTE_ID)
    expect(updated.version).toBe(2)
    expect(updated.status).toBe('draft')
    expect(updated.fieldValues).toEqual({
      chief_complaint: 'Lower back pain',
      pain_scale: 7,
    })
    expect(updated.updatedAt).toEqual(ACCEPTED_AT)
  })

  it('Given a partial payload, when accepting, then fieldValues contains ONLY the payload keys (overwrite, not merge)', () => {
    // Pre-existing: { chief_complaint: 'pre-existing', pain_scale: 3 }
    const aggregate = ChartNote.fromRow(makeDraftChartNote())

    const updated = aggregate.acceptAiDraft({
      incomingFieldValues: { pain_scale: 8 },
      templateContent: TEMPLATE_CONTENT,
      acceptedAt: ACCEPTED_AT,
      acceptedBy: ACCEPTED_BY,
    })

    // Overwrite semantics: chief_complaint is gone, not retained
    expect(updated.fieldValues).toEqual({ pain_scale: 8 })
    expect(updated.fieldValues).not.toHaveProperty('chief_complaint')
  })

  it('Given a valid accept, when inspecting events, then emits exactly one chartNote.saved with the expected payload', () => {
    const aggregate = ChartNote.fromRow(makeDraftChartNote())

    const updated = aggregate.acceptAiDraft({
      incomingFieldValues: { chief_complaint: 'Lower back pain', pain_scale: 7 },
      templateContent: TEMPLATE_CONTENT,
      acceptedAt: ACCEPTED_AT,
      acceptedBy: ACCEPTED_BY,
    })

    const events = updated.getUncommittedEvents()
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      type: 'chartNote.saved',
      payload: {
        chartNoteId: CHART_NOTE_ID,
        editedBy: ACCEPTED_BY,
        editedAt: ACCEPTED_AT.toISOString(),
        fieldIdsChanged: ['chief_complaint', 'pain_scale'],
      },
    })
  })

  it('Given a valid accept, when inspecting the original aggregate, then the original is unchanged (immutability)', () => {
    const original = ChartNote.fromRow(makeDraftChartNote())
    const originalFieldValuesRef = original.fieldValues
    const originalVersion = original.version

    original.acceptAiDraft({
      incomingFieldValues: { pain_scale: 8 },
      templateContent: TEMPLATE_CONTENT,
      acceptedAt: ACCEPTED_AT,
      acceptedBy: ACCEPTED_BY,
    })

    expect(original.fieldValues).toBe(originalFieldValuesRef)
    expect(original.version).toBe(originalVersion)
    expect(original.getUncommittedEvents()).toHaveLength(0)
  })

  // -- Precondition: chart note not in draft status --

  it('Given chart note in readyForSignature, when accepting, then throws ChartNoteNotDraftError and emits no events', () => {
    const aggregate = ChartNote.fromRow(makeDraftChartNote({ status: 'readyForSignature' }))

    expect(() =>
      aggregate.acceptAiDraft({
        incomingFieldValues: { pain_scale: 7 },
        templateContent: TEMPLATE_CONTENT,
        acceptedAt: ACCEPTED_AT,
        acceptedBy: ACCEPTED_BY,
      }),
    ).toThrow(ChartNoteNotDraftError)

    expect(aggregate.getUncommittedEvents()).toHaveLength(0)
  })

  it('Given chart note in signed status, when accepting, then throws ChartNoteNotDraftError', () => {
    const aggregate = ChartNote.fromRow(makeDraftChartNote({ status: 'signed' }))

    expect(() =>
      aggregate.acceptAiDraft({
        incomingFieldValues: { pain_scale: 7 },
        templateContent: TEMPLATE_CONTENT,
        acceptedAt: ACCEPTED_AT,
        acceptedBy: ACCEPTED_BY,
      }),
    ).toThrow(ChartNoteNotDraftError)
  })

  // -- Precondition: unknown field key --

  it('Given a payload with an unknown field key, when accepting, then throws UnknownFieldIdError with the offending keys', () => {
    const aggregate = ChartNote.fromRow(makeDraftChartNote())

    try {
      aggregate.acceptAiDraft({
        incomingFieldValues: { pan_scale: 7 }, // typo
        templateContent: TEMPLATE_CONTENT,
        acceptedAt: ACCEPTED_AT,
        acceptedBy: ACCEPTED_BY,
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(UnknownFieldIdError)
      const error = err as UnknownFieldIdError
      expect(error.code).toBe('UNKNOWN_FIELD_ID')
      expect(error.unknownKeys).toEqual(['pan_scale'])
    }
  })

  // -- Precondition: value validation --

  it('Given a payload with an out-of-range scale value, when accepting, then throws FieldValueValidationError with OUT_OF_RANGE at the field path', () => {
    const aggregate = ChartNote.fromRow(makeDraftChartNote())

    try {
      aggregate.acceptAiDraft({
        incomingFieldValues: { pain_scale: 42 },
        templateContent: TEMPLATE_CONTENT,
        acceptedAt: ACCEPTED_AT,
        acceptedBy: ACCEPTED_BY,
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(FieldValueValidationError)
      const error = err as FieldValueValidationError
      expect(error.code).toBe('FIELD_VALUE_VALIDATION_ERROR')
      expect(error.httpStatus).toBe(422)
      expect(error.errors).toHaveLength(1)
      expect(error.errors[0].code).toBe('OUT_OF_RANGE')
      expect(error.errors[0].path).toEqual(['pain_scale'])
    }
  })

  it('Given a checkboxGroup with an unknown option, when accepting, then throws FieldValueValidationError with the correct path (validator depth propagates)', () => {
    const aggregate = ChartNote.fromRow(makeDraftChartNote())

    try {
      aggregate.acceptAiDraft({
        incomingFieldValues: { onset_type: ['BogusOption'] },
        templateContent: TEMPLATE_CONTENT,
        acceptedAt: ACCEPTED_AT,
        acceptedBy: ACCEPTED_BY,
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(FieldValueValidationError)
      const error = err as FieldValueValidationError
      expect(error.errors[0].path[0]).toBe('onset_type')
    }
  })

  // -- Precondition order: key-check short-circuits value-check --

  it('Given a payload with both an unknown key AND an invalid value, when accepting, then throws UnknownFieldIdError (key check wins)', () => {
    const aggregate = ChartNote.fromRow(makeDraftChartNote())

    try {
      aggregate.acceptAiDraft({
        incomingFieldValues: { pan_scale: 99, pain_scale: 42 },
        templateContent: TEMPLATE_CONTENT,
        acceptedAt: ACCEPTED_AT,
        acceptedBy: ACCEPTED_BY,
      })
      expect.fail('Should have thrown')
    } catch (err) {
      // Key check runs first — value error is not thrown at all.
      expect(err).toBeInstanceOf(UnknownFieldIdError)
    }
  })

  // -- Precondition order: status check short-circuits everything --

  it('Given a signed chart note AND an invalid value, when accepting, then throws ChartNoteNotDraftError (status wins over value check)', () => {
    const aggregate = ChartNote.fromRow(makeDraftChartNote({ status: 'signed' }))

    try {
      aggregate.acceptAiDraft({
        incomingFieldValues: { pain_scale: 42 },
        templateContent: TEMPLATE_CONTENT,
        acceptedAt: ACCEPTED_AT,
        acceptedBy: ACCEPTED_BY,
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ChartNoteNotDraftError)
    }
  })

  // -- Edge cases --

  it('Given a payload with null for any field, when accepting, then value validation passes (null is always valid)', () => {
    const aggregate = ChartNote.fromRow(makeDraftChartNote())

    const updated = aggregate.acceptAiDraft({
      incomingFieldValues: { pain_scale: null, chief_complaint: null },
      templateContent: TEMPLATE_CONTENT,
      acceptedAt: ACCEPTED_AT,
      acceptedBy: ACCEPTED_BY,
    })

    expect(updated.fieldValues).toEqual({ pain_scale: null, chief_complaint: null })
  })

  it('Given an empty payload, when accepting, then accepted and fieldValues becomes {} (overwrite wipes prior values)', () => {
    const aggregate = ChartNote.fromRow(makeDraftChartNote())

    const updated = aggregate.acceptAiDraft({
      incomingFieldValues: {},
      templateContent: TEMPLATE_CONTENT,
      acceptedAt: ACCEPTED_AT,
      acceptedBy: ACCEPTED_BY,
    })

    expect(updated.fieldValues).toEqual({})
    expect(updated.getUncommittedEvents()[0].payload.fieldIdsChanged).toEqual([])
  })
})
