import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { appointments, appointmentTypeEnum } from './scheduling'
import { practitioners } from './shared'

export const sessionStatusEnum = pgEnum('session_status', ['active', 'ended'])

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  appointmentId: uuid('appointment_id')
    .notNull()
    .references(() => appointments.id)
    .unique(),
  practitionerId: uuid('practitioner_id')
    .notNull()
    .references(() => practitioners.id),
  status: sessionStatusEnum('status').notNull().default('active'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const chartNoteStatusEnum = pgEnum('chart_note_status', [
  'draft',
  'readyForSignature',
  'signed',
])

export const chartNoteTemplates = pgTable(
  'chart_note_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    discipline: varchar('discipline', { length: 100 }).notNull(),
    appointmentType: appointmentTypeEnum('appointment_type').notNull(),
    content: jsonb('content').notNull(),
    version: integer('version').notNull().default(1),
    parentTemplateId: uuid('parent_template_id').references(
      (): AnyPgColumn => chartNoteTemplates.id,
    ),
    isDefault: boolean('is_default').notNull().default(false),
    isArchived: boolean('is_archived').notNull().default(false),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => practitioners.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('chart_note_templates_default_idx')
      .on(table.discipline, table.appointmentType)
      .where(sql`${table.isDefault} = true`),
    index('chart_note_templates_lookup_idx').on(
      table.discipline,
      table.appointmentType,
      table.isArchived,
    ),
    uniqueIndex('chart_note_templates_version_idx')
      .on(table.parentTemplateId, table.version)
      .where(sql`${table.parentTemplateId} IS NOT NULL`),
  ],
)

export const chartNotes = pgTable(
  'chart_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id)
      .unique(),
    templateVersionId: uuid('template_version_id')
      .notNull()
      .references(() => chartNoteTemplates.id),
    status: chartNoteStatusEnum('status').notNull().default('draft'),
    fieldValues: jsonb('field_values'),
    prePopulatedFromIntakeId: uuid('pre_populated_from_intake_id'),
    signedAt: timestamp('signed_at'),
    signedBy: uuid('signed_by').references(() => practitioners.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('chart_notes_template_version_idx').on(table.templateVersionId),
    index('chart_notes_status_idx').on(table.status),
  ],
)

export const aiChartNoteDraftStatusEnum = pgEnum('ai_chart_note_draft_status', [
  'pending',
  'accepted',
  'rejected',
])

export const aiChartNoteDrafts = pgTable(
  'ai_chart_note_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chartNoteId: uuid('chart_note_id')
      .notNull()
      .references(() => chartNotes.id),
    rawNotes: text('raw_notes').notNull(),
    fieldValues: jsonb('field_values'),
    status: aiChartNoteDraftStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('ai_chart_note_drafts_chart_note_idx').on(table.chartNoteId),
    uniqueIndex('ai_chart_note_drafts_pending_idx')
      .on(table.chartNoteId)
      .where(sql`${table.status} = 'pending'`),
  ],
)

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type ChartNote = typeof chartNotes.$inferSelect
export type NewChartNote = typeof chartNotes.$inferInsert
export type ChartNoteTemplate = typeof chartNoteTemplates.$inferSelect
export type NewChartNoteTemplate = typeof chartNoteTemplates.$inferInsert
export type AiChartNoteDraft = typeof aiChartNoteDrafts.$inferSelect
export type NewAiChartNoteDraft = typeof aiChartNoteDrafts.$inferInsert
