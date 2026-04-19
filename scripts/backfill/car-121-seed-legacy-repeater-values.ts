#!/usr/bin/env tsx
/**
 * CAR-121 seed augmentation — inject a synthetic "legacy" chart_note row
 * whose rom_table repeater cells are LABEL-shape (matching the pre-CAR-121
 * world). Exists only to give the backfill script something to exercise in
 * the manual-test run: on a fresh seed the template already carries the
 * new keyed shape, so persisted values are key-shape by construction.
 *
 * This is a throwaway, exactly like the backfill itself. Do not reuse.
 *
 * Run: pnpm tsx scripts/backfill/car-121-seed-legacy-repeater-values.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {
  chartNotes,
  chartNoteTemplates,
  sessions,
  appointments,
  clinics,
  patients,
  practitioners,
} from '@careos/db'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Export it or source the appropriate .env first.')
  process.exit(1)
}

const client = postgres(DATABASE_URL, { max: 2 })
const db = drizzle(client, {
  schema: {
    chartNotes,
    chartNoteTemplates,
    sessions,
    appointments,
    clinics,
    patients,
    practitioners,
  },
})

// Fixed ids so re-running with db:nuke + db:seed + this script is reproducible.
const LEGACY_CLINIC_ID = 'c9d2b901-aaaa-4aaa-aaaa-000000000001'
const LEGACY_PRACTITIONER_ID = 'c9d2b901-aaaa-4aaa-aaaa-000000000002'
const LEGACY_PATIENT_ID = 'c9d2b901-aaaa-4aaa-aaaa-000000000003'
const LEGACY_APPT_ID = 'c9d2b901-aaaa-4aaa-aaaa-000000000004'
const LEGACY_SESSION_ID = 'c9d2b901-aaaa-4aaa-aaaa-000000000005'
const LEGACY_CHART_NOTE_ID = 'c9d2b901-aaaa-4aaa-aaaa-000000000006'

// Matches scripts/db/seed.ts — physio initial template id, so the chart_note
// binds to a template with a rom_table/movement column whose options are
// keyed. The backfill walks each persisted cell value and maps the EN label
// back to the corresponding option.key.
const PHYSIO_INITIAL_TEMPLATE_ID = '29187424-4563-4ebd-b2ee-c710ce251c70'

async function main(): Promise<void> {
  await db
    .insert(clinics)
    .values({ id: LEGACY_CLINIC_ID, name: 'Legacy Clinic (CAR-121)' })
    .onConflictDoNothing()

  await db
    .insert(practitioners)
    .values({
      id: LEGACY_PRACTITIONER_ID,
      name: 'Dr. Legacy',
      discipline: 'physiotherapy',
      clinicId: LEGACY_CLINIC_ID,
    })
    .onConflictDoNothing()

  await db
    .insert(patients)
    .values({
      id: LEGACY_PATIENT_ID,
      name: 'Legacy Patient',
      email: 'legacy@car-121.test',
    })
    .onConflictDoNothing()

  await db
    .insert(appointments)
    .values({
      id: LEGACY_APPT_ID,
      clinicId: LEGACY_CLINIC_ID,
      patientId: LEGACY_PATIENT_ID,
      practitionerId: LEGACY_PRACTITIONER_ID,
      appointmentType: 'initial',
      status: 'scheduled',
      scheduledAt: new Date('2026-01-15T09:00:00Z'),
    })
    .onConflictDoNothing()

  await db
    .insert(sessions)
    .values({
      id: LEGACY_SESSION_ID,
      appointmentId: LEGACY_APPT_ID,
      practitionerId: LEGACY_PRACTITIONER_ID,
      status: 'ended',
      startedAt: new Date('2026-01-15T09:00:00Z'),
      endedAt: new Date('2026-01-15T09:30:00Z'),
    })
    .onConflictDoNothing()

  // Legacy field_values: rom_table rows use EN and FR labels for `movement`
  // (the pre-CAR-121 shape). The backfill should rewrite these to the
  // corresponding option.key.
  const legacyFieldValues = {
    rom_table: [
      { joint: 'Shoulder', movement: 'Flexion', active: '160', passive: '170' },
      { joint: 'Elbow', movement: 'Extension', active: '0', passive: '-5' },
      { joint: 'Hip', movement: 'Rotation', active: '30', passive: '35' },
      // Mixed row: key-shape already (idempotent case).
      { joint: 'Knee', movement: 'flexion', active: '120', passive: '130' },
      // Mixed row: unknown value (backfill warns and leaves as-is).
      { joint: 'Ankle', movement: 'NotAMovement', active: '20', passive: '25' },
    ],
  }

  await db
    .insert(chartNotes)
    .values({
      id: LEGACY_CHART_NOTE_ID,
      sessionId: LEGACY_SESSION_ID,
      templateVersionId: PHYSIO_INITIAL_TEMPLATE_ID,
      status: 'draft',
      fieldValues: legacyFieldValues,
      version: 3,
    })
    .onConflictDoNothing()

  console.log('[car-121-seed-legacy] inserted chart_note', LEGACY_CHART_NOTE_ID)
  console.log('[car-121-seed-legacy] rom_table rows:')
  console.log(JSON.stringify(legacyFieldValues.rom_table, null, 2))
  await client.end()
}

main().catch((err) => {
  console.error('[car-121-seed-legacy] fatal:', err)
  process.exit(1)
})
