import { db } from './index'
import { clinics, patients, practitioners } from './schema/shared'
import { appointments } from './schema/scheduling'
import { chartNoteTemplates } from './schema/clinical'
import { physioInitialEval, physioFollowUpSoap } from './fixtures'

const CLINIC_ID = 'a5514ace-7a45-4315-8809-e2aa2277aefc'
const PHYSIO_ID = '0323c4a0-28e8-48cd-aed0-d57bf170a948'
const ERGO_ID = '01beaf78-bfde-4e6e-97bb-4a25f7ccc59c'
const ALICE_ID = '69afb1ea-c204-43f7-a346-d0f4346c5b3f'
const BOB_ID = '52380868-78bc-4594-8db4-3045be4ab003'
const APPT_1_ID = '988930cb-8255-4883-9899-cc2b0c5e44c4'
const APPT_2_ID = '37d6720e-6b0b-4930-88e6-b4f545142558'
const APPT_3_ID = '7d7bb66a-e722-4c8f-aaf5-c8f196befdc5'
const TEMPLATE_1_ID = '29187424-4563-4ebd-b2ee-c710ce251c70'
const TEMPLATE_2_ID = 'e55a96e5-fbc2-4bef-a261-c70e824c1a4e'
const TEMPLATE_3_ID = '9a78491a-380b-4a67-b2d7-856a3bc29c4b'
const TEMPLATE_4_ID = 'f720c816-4907-4ee8-8d3f-ee0b04a1ae63'
const TEMPLATE_V2_INITIAL_ID = 'b3a1c7d2-5e4f-4a89-9c12-d8f6e2a1b3c4'
const TEMPLATE_V2_SOAP_ID = 'c4d2e8f3-6a5b-4b90-ad23-e9f7f3b2c4d5'

async function seed() {
  console.log('Seeding...')

  // Clinic
  await db
    .insert(clinics)
    .values({
      id: CLINIC_ID,
      name: 'Clinique Partenaire MTL',
    })
    .onConflictDoNothing()

  // Practitioners
  await db
    .insert(practitioners)
    .values([
      { id: PHYSIO_ID, name: 'Dr. Physio', discipline: 'physiotherapy', clinicId: CLINIC_ID },
      { id: ERGO_ID, name: 'Dr. Ergo', discipline: 'ergotherapy', clinicId: CLINIC_ID },
    ])
    .onConflictDoNothing()

  // Patients
  await db
    .insert(patients)
    .values([
      { id: ALICE_ID, name: 'Alice Patient', email: 'alice@test.com' },
      { id: BOB_ID, name: 'Bob Patient', email: 'bob@test.com' },
    ])
    .onConflictDoNothing()

  // Appointments
  const today = new Date()
  today.setHours(9, 0, 0, 0)
  const today10 = new Date(today)
  today10.setHours(10)
  const today11 = new Date(today)
  today11.setHours(11)

  await db
    .insert(appointments)
    .values([
      {
        id: APPT_1_ID,
        clinicId: CLINIC_ID,
        patientId: ALICE_ID,
        practitionerId: PHYSIO_ID,
        appointmentType: 'initial',
        status: 'scheduled',
        scheduledAt: today,
      },
      {
        id: APPT_2_ID,
        clinicId: CLINIC_ID,
        patientId: BOB_ID,
        practitionerId: ERGO_ID,
        appointmentType: 'follow_up',
        status: 'scheduled',
        scheduledAt: today10,
      },
      {
        id: APPT_3_ID,
        clinicId: CLINIC_ID,
        patientId: ALICE_ID,
        practitionerId: PHYSIO_ID,
        appointmentType: 'follow_up',
        status: 'canceled',
        scheduledAt: today11,
      },
    ])
    .onConflictDoNothing()

  // Chart note templates
  await db
    .insert(chartNoteTemplates)
    .values([
      {
        id: TEMPLATE_1_ID,
        name: 'IAF — Physiotherapy',
        discipline: 'physiotherapy',
        appointmentType: 'initial',
        content: { sections: ['subjective', 'objective', 'assessment', 'plan', 'goals'] },
        isDefault: true,
        createdBy: PHYSIO_ID,
      },
      {
        id: TEMPLATE_2_ID,
        name: 'SOAP Note — Physiotherapy',
        discipline: 'physiotherapy',
        appointmentType: 'follow_up',
        content: { sections: ['subjective', 'objective', 'assessment', 'plan'] },
        isDefault: true,
        createdBy: PHYSIO_ID,
      },
      {
        id: TEMPLATE_3_ID,
        name: 'IAF — Ergotherapy',
        discipline: 'ergotherapy',
        appointmentType: 'initial',
        content: { sections: ['subjective', 'objective', 'assessment', 'plan', 'goals'] },
        isDefault: true,
        createdBy: ERGO_ID,
      },
      {
        id: TEMPLATE_4_ID,
        name: 'SOAP Note — Ergotherapy',
        discipline: 'ergotherapy',
        appointmentType: 'follow_up',
        content: { sections: ['subjective', 'objective', 'assessment', 'plan'] },
        isDefault: true,
        createdBy: ERGO_ID,
      },
    ])
    .onConflictDoNothing()

  // Chart note templates (v0.2 — rich content, alongside v0.1 seeds)
  await db
    .insert(chartNoteTemplates)
    .values([
      {
        id: TEMPLATE_V2_INITIAL_ID,
        name: 'IAF v0.2 — Physiotherapy',
        discipline: 'physiotherapy',
        appointmentType: 'initial',
        content: physioInitialEval,
        isDefault: false,
        createdBy: PHYSIO_ID,
      },
      {
        id: TEMPLATE_V2_SOAP_ID,
        name: 'SOAP Note v0.2 — Physiotherapy',
        discipline: 'physiotherapy',
        appointmentType: 'follow_up',
        content: physioFollowUpSoap,
        isDefault: false,
        createdBy: PHYSIO_ID,
      },
    ])
    .onConflictDoNothing()

  console.log('Done!')
  process.exit(0)
}

seed().catch(console.error)
