import { pgTable, pgEnum, uuid, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { appointments } from './scheduling';
import { practitioners } from './shared';

export const sessionStatusEnum = pgEnum('session_status', ['active', 'ended']);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  appointmentId: uuid('appointment_id').notNull().references(() => appointments.id).unique(),
  practitionerId: uuid('practitioner_id').notNull().references(() => practitioners.id),
  status: sessionStatusEnum('status').notNull().default('active'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const chartNoteStatusEnum = pgEnum('chart_note_status', ['draft', 'signed']);

export const chartNoteTemplates = pgTable('chart_note_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  discipline: varchar('discipline', { length: 100 }).notNull(),
  appointmentType: varchar('appointment_type', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const chartNotes = pgTable('chart_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id),
  appointmentId: uuid('appointment_id').notNull().references(() => appointments.id),
  practitionerId: uuid('practitioner_id').notNull().references(() => practitioners.id),
  templateId: uuid('template_id').references(() => chartNoteTemplates.id),
  status: chartNoteStatusEnum('status').notNull().default('draft'),
  content: jsonb('content'),
  signedAt: timestamp('signed_at'),
  signedBy: uuid('signed_by').references(() => practitioners.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Need this import for chartNoteTemplates
import { varchar } from 'drizzle-orm/pg-core';

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type ChartNote = typeof chartNotes.$inferSelect;
export type NewChartNote = typeof chartNotes.$inferInsert;