import { vi } from 'vitest'
import type { AIChartingPort, ChartNoteDraft } from '@careos/ai'

// --- Fake data types matching the DB schema shapes ---

export interface FakeChartNote {
  id: string
  sessionId: string
  templateVersionId: string
  status: 'draft' | 'readyForSignature' | 'signed'
  fieldValues: unknown
  prePopulatedFromIntakeId: string | null
  signedAt: Date | null
  signedBy: string | null
  createdAt: Date
  updatedAt: Date
  version: number
}

export interface FakeAiChartNoteDraft {
  id: string
  chartNoteId: string
  rawNotes: string
  fieldValues: unknown
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: Date
}

export interface FakeChartNoteTemplate {
  id: string
  name: string
  discipline: string
  appointmentType: string
  content: unknown
  version: number
  parentTemplateId: string | null
  isDefault: boolean
  isArchived: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

// --- Fake DB Builder ---

export interface FakeDbConfig {
  chartNote?: FakeChartNote | null
  pendingDraft?: FakeAiChartNoteDraft | null
  template?: FakeChartNoteTemplate | null
  draft?: FakeAiChartNoteDraft | null
}

/**
 * Track all mutations applied to the fake DB so tests can assert state changes.
 */
export interface FakeDbMutations {
  insertedDrafts: FakeAiChartNoteDraft[]
  updatedChartNotes: Array<{ id: string; updates: Record<string, unknown> }>
  updatedDrafts: Array<{ id: string; updates: Record<string, unknown> }>
}

let draftIdSeq = 0

/**
 * Build a fake DrizzleDB that returns preconfigured data for queries
 * and records mutations for assertion.
 *
 * This avoids matching against Drizzle's internal SQL AST by using
 * sequential call tracking: the commands always call findFirst in a
 * known order, so we return data based on call sequence.
 */
export function createFakeDb(config: FakeDbConfig) {
  const mutations: FakeDbMutations = {
    insertedDrafts: [],
    updatedChartNotes: [],
    updatedDrafts: [],
  }

  // Track which findFirst call we're on for each table
  const chartNoteFindCalls: Array<FakeChartNote | undefined> = []
  const draftFindCalls: Array<FakeAiChartNoteDraft | undefined> = []
  const templateFindCalls: Array<FakeChartNoteTemplate | undefined> = []

  // For generate-ai-draft: chartNote -> pendingDraft -> template
  // For accept-ai-draft: draft -> chartNote
  // For reject-ai-draft: draft

  if (config.chartNote !== undefined) {
    chartNoteFindCalls.push(config.chartNote ?? undefined)
  }
  if (config.draft !== undefined) {
    draftFindCalls.push(config.draft ?? undefined)
  }
  if (config.pendingDraft !== undefined) {
    draftFindCalls.push(config.pendingDraft ?? undefined)
  }
  if (config.template !== undefined) {
    templateFindCalls.push(config.template ?? undefined)
  }

  let chartNoteCallIdx = 0
  let draftCallIdx = 0
  let templateCallIdx = 0

  const txProxy = {
    query: {
      chartNotes: {
        findFirst: vi.fn(() => {
          const result = chartNoteFindCalls[chartNoteCallIdx]
          chartNoteCallIdx++
          return Promise.resolve(result)
        }),
      },
      aiChartNoteDrafts: {
        findFirst: vi.fn(() => {
          const result = draftFindCalls[draftCallIdx]
          draftCallIdx++
          return Promise.resolve(result)
        }),
      },
      chartNoteTemplates: {
        findFirst: vi.fn(() => {
          const result = templateFindCalls[templateCallIdx]
          templateCallIdx++
          return Promise.resolve(result)
        }),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn((data: Record<string, unknown>) => ({
        returning: vi.fn(() => {
          const id = `draft-${String(++draftIdSeq)}`
          const record: FakeAiChartNoteDraft = {
            id,
            chartNoteId: data.chartNoteId as string,
            rawNotes: data.rawNotes as string,
            fieldValues: data.fieldValues,
            status: 'pending',
            createdAt: new Date(),
          }
          mutations.insertedDrafts.push(record)
          return Promise.resolve([record])
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((updates: Record<string, unknown>) => ({
        where: vi.fn(() => {
          // Determine if this is a chart note update (has fieldValues or version)
          // or a draft update (has status)
          if ('fieldValues' in updates || 'version' in updates) {
            const note = config.chartNote
            if (note) {
              const updated = { ...note, ...updates }
              mutations.updatedChartNotes.push({ id: note.id, updates })
              return {
                returning: vi.fn(() => Promise.resolve([updated])),
              }
            }
          }

          if ('status' in updates && !('fieldValues' in updates)) {
            const draft = config.draft ?? config.pendingDraft
            if (draft) {
              mutations.updatedDrafts.push({ id: draft.id, updates })
            }
          }

          return {
            returning: vi.fn(() => Promise.resolve([])),
          }
        }),
      })),
    })),
  }

  const fakeDb = {
    ...txProxy,
    transaction: vi.fn((callback: (tx: typeof txProxy) => unknown) => {
      return Promise.resolve(callback(txProxy))
    }),
  }

  return {
    db: fakeDb as unknown as Parameters<
      typeof import('../../commands/generate-ai-draft').generateAiDraft
    >[0],
    mutations,
  }
}

// --- Fake AI Charting Port ---

export function createFakeAiChartingPort(result?: ChartNoteDraft, error?: Error): AIChartingPort {
  return {
    generateTemplateDraft: vi.fn().mockRejectedValue(new Error('Not implemented in fake')),
    generateChartNoteDraft: error
      ? vi.fn().mockRejectedValue(error)
      : vi.fn().mockResolvedValue(result ?? { fields: {} }),
  }
}

// --- Test data factories ---

export function makeChartNote(overrides: Partial<FakeChartNote> = {}): FakeChartNote {
  return {
    id: 'cn-1',
    sessionId: 'session-1',
    templateVersionId: 'template-1',
    status: 'draft',
    fieldValues: null,
    prePopulatedFromIntakeId: null,
    signedAt: null,
    signedBy: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    version: 1,
    ...overrides,
  }
}

export function makeAiDraft(overrides: Partial<FakeAiChartNoteDraft> = {}): FakeAiChartNoteDraft {
  return {
    id: 'draft-existing-1',
    chartNoteId: 'cn-1',
    rawNotes: 'some notes',
    fieldValues: { chief_complaint: 'pain' },
    status: 'pending',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

export function makeTemplate(
  overrides: Partial<FakeChartNoteTemplate> = {},
): FakeChartNoteTemplate {
  return {
    id: 'template-1',
    name: 'Test Template',
    discipline: 'physiotherapy',
    appointmentType: 'initial',
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
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    version: 1,
    parentTemplateId: null,
    isDefault: true,
    isArchived: false,
    createdBy: 'practitioner-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}
