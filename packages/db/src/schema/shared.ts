import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'

// Cross-context identity stubs — just enough for FK references

export const clinics = pgTable('clinics', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const practitioners = pgTable('practitioners', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  discipline: varchar('discipline', { length: 100 }).notNull(),
  clinicId: uuid('clinic_id')
    .notNull()
    .references(() => clinics.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
