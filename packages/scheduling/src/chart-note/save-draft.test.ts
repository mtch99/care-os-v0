import { describe, it, expect, beforeEach } from 'vitest'
import {
  ChartNoteNotFoundError,
  ChartNoteNotDraftError,
  UnknownFieldIdError,
  VersionConflictError,
  NotSessionOwnerError,
} from '@careos/api-contract'

import { saveDraft } from './save-draft'
import type { SaveDraftInput } from './save-draft'
import type { ChartNoteRow, TemplateRow } from './ports'
import {
  FakeChartNoteRepository,
  FakeTemplateRepository,
  FakeSessionLookup,
  FakeClock,
  FakeEventPublisher,
} from './testing'

// ── Test fixtures ──

const CHART_NOTE_ID = 'cn-1111-2222-3333-444444444444'
const SESSION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const PRACTITIONER_ID = '0323c4a0-28e8-48cd-aed0-d57bf170a948'
const OTHER_PRACTITIONER_ID = '99999999-9999-9999-9999-999999999999'
const TEMPLATE_VERSION_ID = '29187424-4563-4ebd-b2ee-c710ce251c70'

const TEMPLATE_CONTENT = {
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
              ],
            },
          ],
        },
      ],
    },
  ],
}

const TEMPLATE: TemplateRow = {
  id: TEMPLATE_VERSION_ID,
  name: 'IAF - Physiotherapy',
  discipline: 'physiotherapy',
  appointmentType: 'initial',
  content: TEMPLATE_CONTENT,
  version: 1,
  parentTemplateId: null,
  isDefault: true,
  isArchived: false,
}

function makeDraftChartNote(overrides: Partial<ChartNoteRow> = {}): ChartNoteRow {
  return {
    id: CHART_NOTE_ID,
    sessionId: SESSION_ID,
    templateVersionId: TEMPLATE_VERSION_ID,
    status: 'draft',
    fieldValues: { chief_complaint: null, pain_scale: null },
    prePopulatedFromIntakeId: null,
    signedAt: null,
    signedBy: null,
    createdAt: new Date('2026-04-12T09:00:00.000Z'),
    updatedAt: new Date('2026-04-12T09:00:00.000Z'),
    version: 1,
    ...overrides,
  }
}

// ── Test setup ──

let chartNoteRepo: FakeChartNoteRepository
let templateRepo: FakeTemplateRepository
let sessionLookup: FakeSessionLookup
let clock: FakeClock
let eventPublisher: FakeEventPublisher

function makePorts() {
  return { chartNoteRepo, templateRepo, sessionLookup, clock, eventPublisher }
}

function makeInput(overrides: Partial<SaveDraftInput> = {}): SaveDraftInput {
  return {
    chartNoteId: CHART_NOTE_ID,
    fieldValues: { chief_complaint: 'Lower back pain' },
    version: 1,
    practitionerId: PRACTITIONER_ID,
    ...overrides,
  }
}

beforeEach(() => {
  chartNoteRepo = new FakeChartNoteRepository()
  templateRepo = new FakeTemplateRepository()
  sessionLookup = new FakeSessionLookup()
  clock = new FakeClock()
  eventPublisher = new FakeEventPublisher()

  // Default setup: draft chart note exists, session exists with correct owner, template exists
  chartNoteRepo.seed(makeDraftChartNote())
  sessionLookup.seed(SESSION_ID, PRACTITIONER_ID)
  templateRepo.seedById(TEMPLATE)
})

// ── Tests ──

describe('saveDraft', () => {
  // -- Happy path: edit a draft chart note --

  describe('Given a draft chart note, when saving field values', () => {
    it('then returns the updated chart note with bumped version', async () => {
      const result = await saveDraft(makeInput(), makePorts())

      expect(result.chartNote.id).toBe(CHART_NOTE_ID)
      expect(result.chartNote.version).toBe(2)
      expect(result.chartNote.status).toBe('draft')
      expect(result.chartNote.fieldValues.chief_complaint).toBe('Lower back pain')
    })

    it('then emits chartNote.saved event with exact shape', async () => {
      await saveDraft(makeInput(), makePorts())

      const events = eventPublisher.getPublished()
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({
        type: 'chartNote.saved',
        payload: {
          chartNoteId: CHART_NOTE_ID,
          editedBy: PRACTITIONER_ID,
          editedAt: '2026-04-12T10:00:00.000Z',
          fieldIdsChanged: ['chief_complaint'],
        },
      })
    })
  })

  // -- Merge semantics: partial update --

  describe('Given a draft chart note with existing values, when saving partial keys', () => {
    it('then only submitted keys change, omitted keys retain previous values', async () => {
      // First save: set chief_complaint
      await saveDraft(
        makeInput({ fieldValues: { chief_complaint: 'Lower back pain' } }),
        makePorts(),
      )

      // Second save: set pain_scale only
      const result = await saveDraft(
        makeInput({ fieldValues: { pain_scale: 7 }, version: 2 }),
        makePorts(),
      )

      expect(result.chartNote.fieldValues.chief_complaint).toBe('Lower back pain')
      expect(result.chartNote.fieldValues.pain_scale).toBe(7)
      expect(result.chartNote.version).toBe(3)
    })
  })

  // -- Merge semantics: null clears a field --

  describe('Given a draft chart note with a field value, when saving null for that field', () => {
    it('then the field value is cleared to null', async () => {
      // First save: set chief_complaint
      await saveDraft(
        makeInput({ fieldValues: { chief_complaint: 'Lower back pain' } }),
        makePorts(),
      )

      // Second save: clear chief_complaint with null
      const result = await saveDraft(
        makeInput({ fieldValues: { chief_complaint: null }, version: 2 }),
        makePorts(),
      )

      expect(result.chartNote.fieldValues.chief_complaint).toBeNull()
      expect(result.chartNote.version).toBe(3)
    })
  })

  // -- Precondition: chart note not found --

  describe('Given chart note does not exist, when saving draft', () => {
    it('then throws ChartNoteNotFoundError', async () => {
      const input = makeInput({ chartNoteId: 'nonexistent-id' })

      await expect(saveDraft(input, makePorts())).rejects.toThrow(ChartNoteNotFoundError)
    })
  })

  // -- Precondition: chart note not in draft status --

  describe('Given chart note is in readyForSignature status, when saving draft', () => {
    it('then throws ChartNoteNotDraftError', async () => {
      chartNoteRepo = new FakeChartNoteRepository()
      chartNoteRepo.seed(makeDraftChartNote({ status: 'readyForSignature' }))

      await expect(saveDraft(makeInput(), makePorts())).rejects.toThrow(ChartNoteNotDraftError)
    })
  })

  describe('Given chart note is in signed status, when saving draft', () => {
    it('then throws ChartNoteNotDraftError', async () => {
      chartNoteRepo = new FakeChartNoteRepository()
      chartNoteRepo.seed(makeDraftChartNote({ status: 'signed' }))

      await expect(saveDraft(makeInput(), makePorts())).rejects.toThrow(ChartNoteNotDraftError)
    })
  })

  // -- Precondition: unknown field ID --

  describe('Given an incoming field ID not in the template, when saving draft', () => {
    it('then throws UnknownFieldIdError with the unknown keys', async () => {
      const input = makeInput({ fieldValues: { nonexistent_field: 'value' } })

      try {
        await saveDraft(input, makePorts())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(UnknownFieldIdError)
        const error = err as UnknownFieldIdError
        expect(error.code).toBe('UNKNOWN_FIELD_ID')
        expect(error.unknownKeys).toEqual(['nonexistent_field'])
      }
    })
  })

  // -- Precondition: version mismatch (optimistic lock) --

  describe('Given chart note at version 1, when saving with stale version 0', () => {
    it('then throws VersionConflictError', async () => {
      const input = makeInput({ version: 0 })

      try {
        await saveDraft(input, makePorts())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(VersionConflictError)
        const error = err as VersionConflictError
        expect(error.code).toBe('VERSION_CONFLICT')
        expect(error.expected).toBe(1)
        expect(error.actual).toBe(0)
      }
    })
  })

  // -- Precondition: practitioner not session owner --

  describe('Given a different practitioner, when saving draft', () => {
    it('then throws NotSessionOwnerError', async () => {
      const input = makeInput({ practitionerId: OTHER_PRACTITIONER_ID })

      await expect(saveDraft(input, makePorts())).rejects.toThrow(NotSessionOwnerError)
    })
  })

  // -- Event payload: no PHI in values --

  describe('Given a successful save, when checking event payload', () => {
    it('then event contains field IDs only, not field values (no PHI)', async () => {
      const input = makeInput({
        fieldValues: { chief_complaint: 'Sensitive patient complaint data' },
      })

      await saveDraft(input, makePorts())

      const events = eventPublisher.getPublished()
      expect(events).toHaveLength(1)
      const payload = events[0].payload
      // Only IDs, no values
      expect(payload).toHaveProperty('fieldIdsChanged')
      expect(payload).not.toHaveProperty('fieldValues')
      expect(payload.fieldIdsChanged).toEqual(['chief_complaint'])
    })
  })

  // -- Concurrency: DB-level version mismatch --

  describe('Given two concurrent saves at version 1, when second save hits DB', () => {
    it('then second save throws VersionConflictError', async () => {
      // Simulate: first save succeeds at version 1 -> 2
      await saveDraft(makeInput(), makePorts())

      // Second save arrives with version 1 (stale)
      try {
        await saveDraft(makeInput({ fieldValues: { pain_scale: 5 } }), makePorts())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(VersionConflictError)
        const error = err as VersionConflictError
        expect(error.code).toBe('VERSION_CONFLICT')
      }
    })
  })

  // -- No events on failure --

  describe('Given any precondition failure, when saving draft', () => {
    it('then no events are emitted', async () => {
      const input = makeInput({ version: 0 }) // stale version

      try {
        await saveDraft(input, makePorts())
      } catch {
        // expected
      }

      expect(eventPublisher.getPublished()).toHaveLength(0)
    })
  })
})
