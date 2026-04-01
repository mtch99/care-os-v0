import { pgTable, pgEnum, uuid, timestamp } from 'drizzle-orm/pg-core';
import { clinics, patients, practitioners } from './shared';

export const appointmentTypeEnum = pgEnum('appointment_type', ['initial', 'follow_up']);

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'scheduled',
  'in_session',
  'awaiting_completion',
  'completed',
  'canceled',
  'no_show',
]);

export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').notNull().references(() => clinics.id),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  practitionerId: uuid('practitioner_id').notNull().references(() => practitioners.id),
  appointmentType: appointmentTypeEnum('appointment_type').notNull(),
  status: appointmentStatusEnum('status').notNull().default('scheduled'),
  scheduledAt: timestamp('scheduled_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;