import { describe, it, expect, beforeEach } from 'vitest'
import { SessionNotFoundError, NoDefaultTemplateError } from '@careos/api-contract'

import { initializeChartNote } from './initialize-chart-note'
import type { TemplateRow, ChartNoteRow } from './ports'
import {
  FakeChartNoteRepository,
  FakeTemplateRepository,
  FakeIntakeLookup,
  FakeSessionLookup,
  FakeClock,
  FakeEventPublisher,
} from './testing'

// ── Test fixtures ──

const SESSION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const PRACTITIONER_ID = '0323c4a0-28e8-48cd-aed0-d57bf170a948'
const TEMPLATE_ID = '29187424-4563-4ebd-b2ee-c710ce251c70'
const INTAKE_ID = 'intake-1111-2222-3333-444444444444'

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

const DEFAULT_TEMPLATE: TemplateRow = {
  id: TEMPLATE_ID,
  name: 'IAF - Physiotherapy',
  discipline: 'physiotherapy',
  appointmentType: 'initial',
  content: TEMPLATE_CONTENT,
  version: 1,
  parentTemplateId: null,
  isDefault: true,
  isArchived: false,
}

// ── Test setup ──

let chartNoteRepo: FakeChartNoteRepository
let templateRepo: FakeTemplateRepository
let intakeLookup: FakeIntakeLookup
let sessionLookup: FakeSessionLookup
let clock: FakeClock
let eventPublisher: FakeEventPublisher

function makePorts() {
  return { chartNoteRepo, templateRepo, intakeLookup, sessionLookup, clock, eventPublisher }
}

function makeInput(
  overrides: Partial<{
    sessionId: string
    discipline: string
    appointmentType: string
    practitionerId: string
  }> = {},
) {
  return {
    sessionId: SESSION_ID,
    discipline: 'physiotherapy',
    appointmentType: 'initial',
    practitionerId: PRACTITIONER_ID,
    ...overrides,
  }
}

beforeEach(() => {
  chartNoteRepo = new FakeChartNoteRepository()
  templateRepo = new FakeTemplateRepository()
  intakeLookup = new FakeIntakeLookup()
  sessionLookup = new FakeSessionLookup()
  clock = new FakeClock()
  eventPublisher = new FakeEventPublisher()

  // Default setup: session exists and default template exists
  sessionLookup.seed(SESSION_ID)
  templateRepo.seedDefault(DEFAULT_TEMPLATE)
})

// ── Tests ──

describe('initializeChartNote', () => {
  // -- Happy path --

  describe('Given a valid session and default template, when initializing', () => {
    it('then creates a chart note in draft status with created: true', async () => {
      const result = await initializeChartNote(makeInput(), makePorts())

      expect(result.created).toBe(true)
      expect(result.chartNote.status).toBe('draft')
      expect(result.chartNote.sessionId).toBe(SESSION_ID)
      expect(result.chartNote.templateVersionId).toBe(TEMPLATE_ID)
      expect(result.chartNote.version).toBe(1)
    })

    it('then initializes fieldValues as empty map keyed by template field IDs', async () => {
      const result = await initializeChartNote(makeInput(), makePorts())

      expect(result.chartNote.fieldValues).toEqual({
        chief_complaint: null,
        pain_scale: null,
      })
    })

    it('then sets prePopulatedFromIntakeId to null when no intake exists', async () => {
      const result = await initializeChartNote(makeInput(), makePorts())

      expect(result.chartNote.prePopulatedFromIntakeId).toBeNull()
    })
  })

  // -- Idempotency --

  describe('Given a chart note already exists for the session, when initializing again', () => {
    it('then returns existing chart note with created: false', async () => {
      const existingRow: ChartNoteRow = {
        id: 'existing-note-id',
        sessionId: SESSION_ID,
        templateVersionId: TEMPLATE_ID,
        status: 'draft',
        fieldValues: { chief_complaint: null, pain_scale: null },
        prePopulatedFromIntakeId: null,
        signedAt: null,
        signedBy: null,
        createdAt: new Date('2026-04-12T09:00:00.000Z'),
        updatedAt: new Date('2026-04-12T09:00:00.000Z'),
        version: 1,
      }
      chartNoteRepo.seed(existingRow)

      const result = await initializeChartNote(makeInput(), makePorts())

      expect(result.created).toBe(false)
      expect(result.chartNote.id).toBe('existing-note-id')
    })

    it('then does not emit any events', async () => {
      const existingRow: ChartNoteRow = {
        id: 'existing-note-id',
        sessionId: SESSION_ID,
        templateVersionId: TEMPLATE_ID,
        status: 'draft',
        fieldValues: { chief_complaint: null },
        prePopulatedFromIntakeId: null,
        signedAt: null,
        signedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      }
      chartNoteRepo.seed(existingRow)

      await initializeChartNote(makeInput(), makePorts())

      expect(eventPublisher.getPublished()).toHaveLength(0)
    })
  })

  // -- Precondition: session not found --

  describe('Given session does not exist, when initializing', () => {
    it('then throws SessionNotFoundError', async () => {
      const input = makeInput({ sessionId: 'nonexistent-session-id' })

      await expect(initializeChartNote(input, makePorts())).rejects.toThrow(SessionNotFoundError)
    })
  })

  // -- Precondition: no default template --

  describe('Given no default template for discipline x appointmentType, when initializing', () => {
    it('then throws NoDefaultTemplateError with available templates', async () => {
      templateRepo = new FakeTemplateRepository()
      templateRepo.seedList([
        {
          id: 'alt-template',
          name: 'Alternative Template',
          discipline: 'physiotherapy',
          appointmentType: 'initial',
        },
      ])

      try {
        await initializeChartNote(makeInput(), makePorts())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(NoDefaultTemplateError)
        const error = err as NoDefaultTemplateError
        expect(error.code).toBe('NO_DEFAULT_TEMPLATE')
        expect(error.availableTemplates).toHaveLength(1)
        expect(error.availableTemplates[0].id).toBe('alt-template')
      }
    })
  })

  // -- Pre-population from intake --

  describe('Given a signed intake form exists for the session, when initializing', () => {
    it('then sets prePopulatedFromIntakeId', async () => {
      intakeLookup.setResult({
        intakeId: INTAKE_ID,
        fieldIds: ['chief_complaint'],
      })

      const result = await initializeChartNote(makeInput(), makePorts())

      expect(result.chartNote.prePopulatedFromIntakeId).toBe(INTAKE_ID)
    })

    it('then emits chartNote.prePopulated event with field IDs only (no PHI)', async () => {
      intakeLookup.setResult({
        intakeId: INTAKE_ID,
        fieldIds: ['chief_complaint'],
      })

      await initializeChartNote(makeInput(), makePorts())

      const events = eventPublisher.getPublished()
      const prePopEvent = events.find((e) => e.type === 'chartNote.prePopulated')
      expect(prePopEvent).toBeDefined()
      expect(prePopEvent?.payload).toEqual({
        chartNoteId: expect.any(String) as unknown,
        intakeId: INTAKE_ID,
        fieldIdsPopulated: ['chief_complaint'],
      })
    })
  })

  // -- Event payloads --

  describe('Given a successful initialization, when checking events', () => {
    it('then emits chartNote.initialized with exact shape', async () => {
      const result = await initializeChartNote(makeInput(), makePorts())

      const events = eventPublisher.getPublished()
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({
        type: 'chartNote.initialized',
        payload: {
          chartNoteId: result.chartNote.id,
          sessionId: SESSION_ID,
          templateVersionId: TEMPLATE_ID,
          initializedAt: '2026-04-12T10:00:00.000Z',
          initializedBy: PRACTITIONER_ID,
        },
      })
    })

    it('then emits both initialized and prePopulated events when intake exists', async () => {
      intakeLookup.setResult({ intakeId: INTAKE_ID, fieldIds: ['chief_complaint'] })

      await initializeChartNote(makeInput(), makePorts())

      const events = eventPublisher.getPublished()
      expect(events).toHaveLength(2)
      expect(events[0].type).toBe('chartNote.initialized')
      expect(events[1].type).toBe('chartNote.prePopulated')
    })
  })
})
