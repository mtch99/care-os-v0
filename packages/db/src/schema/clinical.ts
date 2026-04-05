import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
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

export const chartNoteStatusEnum = pgEnum('chart_note_status', ['draft', 'signed'])

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

export const chartNotes = pgTable('chart_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id),
  appointmentId: uuid('appointment_id')
    .notNull()
    .references(() => appointments.id),
  practitionerId: uuid('practitioner_id')
    .notNull()
    .references(() => practitioners.id),
  templateId: uuid('template_id').references(() => chartNoteTemplates.id),
  status: chartNoteStatusEnum('status').notNull().default('draft'),
  content: jsonb('content'),
  signedAt: timestamp('signed_at'),
  signedBy: uuid('signed_by').references(() => practitioners.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type ChartNote = typeof chartNotes.$inferSelect
export type NewChartNote = typeof chartNotes.$inferInsert
export type ChartNoteTemplate = typeof chartNoteTemplates.$inferSelect
export type NewChartNoteTemplate = typeof chartNoteTemplates.$inferInsert
