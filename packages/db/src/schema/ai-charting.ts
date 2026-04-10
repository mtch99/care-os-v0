import { sql } from 'drizzle-orm'
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { appointmentTypeEnum } from './scheduling'
import { chartNoteTemplates } from './clinical'

export const aiTemplateDraftStatusEnum = pgEnum('ai_template_draft_status', [
  'pending',
  'accepted',
  'rejected',
  'expired',
])

export const aiTemplateDrafts = pgTable(
  'ai_template_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    discipline: varchar('discipline', { length: 100 }).notNull(),
    appointmentType: appointmentTypeEnum('appointment_type').notNull(),
    locale: jsonb('locale').notNull(),
    preferences: text('preferences').notNull(),
    content: jsonb('content').notNull(),
    status: aiTemplateDraftStatusEnum('status').notNull().default('pending'),
    acceptedTemplateId: uuid('accepted_template_id').references(() => chartNoteTemplates.id),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('ai_template_drafts_status_idx').on(table.status),
    uniqueIndex('ai_template_drafts_pending_unique_idx')
      .on(table.discipline, table.appointmentType)
      .where(sql`${table.status} = 'pending'`),
  ],
)

export type AiTemplateDraft = typeof aiTemplateDrafts.$inferSelect
export type NewAiTemplateDraft = typeof aiTemplateDrafts.$inferInsert
